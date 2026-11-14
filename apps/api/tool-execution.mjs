import { createHash, randomUUID } from 'node:crypto';
import { callMcpTool, verifyMcpConnector } from './mcp-connectors.mjs';
import { assertUsageBudget } from './usage-runtime.mjs';

const now=()=>new Date().toISOString();
const stable=value=>Array.isArray(value)?value.map(stable):value&&typeof value==='object'?Object.fromEntries(Object.keys(value).sort().map(key=>[key,stable(value[key])])):value;
const hash=value=>createHash('sha256').update(JSON.stringify(stable(value))).digest('hex');
const parse=value=>typeof value==='string'?JSON.parse(value):value;
const safeJson=value=>JSON.stringify(value??null,(key,item)=>/(token|secret|password|authorization|api.?key|credential)/i.test(key)?'[REDACTED]':item);

export function classifyMcpTool(tool){
  const name=`${tool.name||tool.tool_name||''} ${tool.description||''}`.toLowerCase(),annotations=tool.annotations||{};
  if(annotations.destructiveHint===true||/(delete|destroy|remove_account|drop_database|transfer_money)/.test(name))return 'consequential_write';
  if(annotations.readOnlyHint===true||/^(get|list|read|search|find|lookup|fetch|query|view|inspect)[_.-]/.test(String(tool.name||tool.tool_name||'').toLowerCase()))return 'read';
  if(/(draft|preview|compose|prepare)/.test(name))return 'draft';
  if(/(send|create|update|write|post|publish|schedule|enrol|grade|record|upload)/.test(name))return 'consequential_write';
  return 'reversible_write';
}

export async function syncToolCatalog(db,{organizationId,connectionId,fetchImpl=fetch,lookupImpl,environment=process.env}){
  const connection=db.prepare('SELECT * FROM connector_connections WHERE id=? AND organization_id=?').get(connectionId,organizationId);
  if(!connection)throw new Error('Connector not found.');
  const result=await verifyMcpConnector(connection,{fetchImpl,lookupImpl,environment}),timestamp=now();
  const version=(db.prepare('SELECT COALESCE(MAX(catalog_version),0)+1 AS version FROM mcp_tool_catalog WHERE organization_id=? AND connection_id=?').get(organizationId,connectionId).version);
  db.prepare("UPDATE mcp_tool_catalog SET status='removed',updated_at=? WHERE organization_id=? AND connection_id=? AND status='available'").run(timestamp,organizationId,connectionId);
  const insert=db.prepare('INSERT INTO mcp_tool_catalog(id,organization_id,connection_id,tool_name,description,input_schema,annotations,schema_hash,risk_class,status,catalog_version,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,\'available\',?,?,?)');
  for(const tool of result.tools){const inputSchema=tool.inputSchema||{type:'object',properties:{}},annotations=tool.annotations||{};insert.run(randomUUID(),organizationId,connectionId,tool.name,tool.description,JSON.stringify(inputSchema),JSON.stringify(annotations),hash({inputSchema,annotations}),classifyMcpTool(tool),version,timestamp,timestamp);}
  db.prepare("UPDATE connector_connections SET status='verified',scopes=?,last_verified_at=?,updated_at=? WHERE id=? AND organization_id=?").run(JSON.stringify(result.tools.map(tool=>tool.name)),timestamp,timestamp,connectionId,organizationId);
  return {connectionId,catalogVersion:version,count:result.tools.length,tools:listCatalogTools(db,{organizationId,connectionId})};
}

export function syncStaticToolCatalog(db,{organizationId,connectionId,tools}){
  const connection=db.prepare('SELECT * FROM connector_connections WHERE id=? AND organization_id=?').get(connectionId,organizationId);if(!connection)throw new Error('Connector not found.');
  const timestamp=now(),version=db.prepare('SELECT COALESCE(MAX(catalog_version),0)+1 AS version FROM mcp_tool_catalog WHERE organization_id=? AND connection_id=?').get(organizationId,connectionId).version;
  db.prepare("UPDATE mcp_tool_catalog SET status='removed',updated_at=? WHERE organization_id=? AND connection_id=? AND status='available'").run(timestamp,organizationId,connectionId);
  const insert=db.prepare("INSERT INTO mcp_tool_catalog(id,organization_id,connection_id,tool_name,description,input_schema,annotations,schema_hash,risk_class,status,catalog_version,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,'available',?,?,?)");
  for(const definition of tools){const inputSchema=definition.inputSchema||{type:'object',properties:{}},annotations=definition.annotations||{};insert.run(randomUUID(),organizationId,connectionId,definition.name,definition.description||'',JSON.stringify(inputSchema),JSON.stringify(annotations),hash({inputSchema,annotations}),definition.risk||classifyMcpTool(definition),version,timestamp,timestamp);}
  db.prepare('UPDATE connector_connections SET updated_at=? WHERE id=? AND organization_id=?').run(timestamp,connectionId,organizationId);
  return {connectionId,catalogVersion:version,count:tools.length,tools:listCatalogTools(db,{organizationId,connectionId})};
}

export function listCatalogTools(db,{organizationId,connectionId,query='',risk,cursor=0,limit=50}){
  const values=[organizationId,connectionId],clauses=["organization_id=?","connection_id=?","status='available'"];
  if(query){clauses.push('(lower(tool_name) LIKE ? OR lower(description) LIKE ?)');values.push(`%${query.toLowerCase()}%`,`%${query.toLowerCase()}%`);}
  if(risk){clauses.push('risk_class=?');values.push(risk);}
  values.push(Math.min(100,Math.max(1,limit)),Math.max(0,Number(cursor)||0));
  return db.prepare(`SELECT id,connection_id,tool_name,description,input_schema,annotations,risk_class,catalog_version FROM mcp_tool_catalog WHERE ${clauses.join(' AND ')} ORDER BY tool_name LIMIT ? OFFSET ?`).all(...values).map(row=>({...row,input_schema:parse(row.input_schema),annotations:parse(row.annotations)}));
}

export function searchTools(db,{organizationId,botId,query='',risk,limit=25,includeSchema=true}){
  const bot=db.prepare('SELECT id,role_key,allowed_tools FROM agents WHERE id=? AND organization_id=? AND deleted_at IS NULL AND archived_at IS NULL').get(botId,organizationId);
  if(!bot)throw new Error('Bot not found.');
  return db.prepare("SELECT c.id,c.connection_id,c.tool_name,c.description,c.input_schema,c.risk_class FROM mcp_tool_catalog c WHERE c.organization_id=? AND c.status='available' AND (lower(c.tool_name) LIKE ? OR lower(c.description) LIKE ?) ORDER BY c.tool_name LIMIT ?").all(organizationId,`%${query.toLowerCase()}%`,`%${query.toLowerCase()}%`,Math.min(100,limit*4)).filter(tool=>(!risk||tool.risk_class===risk)&&policyFor(db,{organizationId,bot,tool}).decision!=='deny').slice(0,Math.min(50,limit)).map(tool=>({...tool,...(includeSchema?{input_schema:parse(tool.input_schema)}:{input_schema:undefined}),policy:policyFor(db,{organizationId,bot,tool})}));
}

export function policyFor(db,{organizationId,bot,tool}){
  const grants=db.prepare("SELECT * FROM tool_policy_grants WHERE organization_id=? AND revoked_at IS NULL AND tool_name IN (?, '*') AND (connection_id IS NULL OR connection_id=?) ORDER BY policy_version DESC").all(organizationId,tool.tool_name,tool.connection_id);
  const matching=grants.filter(grant=>(grant.subject_type==='bot'&&grant.subject_id===bot.id)||(grant.subject_type==='role'&&grant.subject_id===bot.role_key)||(grant.subject_type==='organization'&&grant.subject_id===organizationId));
  const botDeny=matching.find(grant=>grant.subject_type==='bot'&&grant.permission==='deny');
  const rank=grant=>(grant.subject_type==='bot'?300:grant.subject_type==='role'?200:100)+(grant.tool_name==='*'?0:20)+(grant.connection_id?5:0);
  const applicable=botDeny||matching.sort((a,b)=>rank(b)-rank(a)||b.policy_version-a.policy_version)[0];
  if(!applicable)return {decision:'deny',reason:'No active tool policy grant exists.',policyVersion:1};
  if(applicable.permission==='deny')return {decision:'deny',reason:'An explicit deny policy applies.',policyVersion:applicable.policy_version};
  if(tool.risk_class==='read'&&applicable.permission==='allow_read')return {decision:'allow',reason:'Read-only action is covered by policy.',policyVersion:applicable.policy_version};
  if(applicable.permission==='allow_propose')return {decision:'propose',reason:'Policy permits a governed proposal.',policyVersion:applicable.policy_version};
  return {decision:'deny',reason:'Policy does not permit this risk class.',policyVersion:applicable.policy_version};
}

export function listToolPolicies(db,{organizationId}){return db.prepare('SELECT * FROM tool_policy_grants WHERE organization_id=? ORDER BY revoked_at IS NOT NULL,policy_version DESC').all(organizationId).map(row=>({...row,constraints:parse(row.constraints)}));}
export function revokeToolPolicy(db,{organizationId,grantId}){const changed=db.prepare('UPDATE tool_policy_grants SET revoked_at=? WHERE id=? AND organization_id=? AND revoked_at IS NULL').run(now(),grantId,organizationId).changes;return {ok:Boolean(changed)};}

export function describeTool(db,{organizationId,botId,catalogToolId,connectionId}){
  const bot=db.prepare('SELECT id,role_key FROM agents WHERE id=? AND organization_id=? AND deleted_at IS NULL AND archived_at IS NULL').get(botId,organizationId),tool=db.prepare("SELECT * FROM mcp_tool_catalog WHERE id=? AND connection_id=? AND organization_id=? AND status='available'").get(catalogToolId,connectionId,organizationId);if(!bot||!tool)return null;
  const policy=policyFor(db,{organizationId,bot,tool});if(policy.decision==='deny')return null;
  return {...tool,input_schema:parse(tool.input_schema),annotations:parse(tool.annotations),policy};
}

export function grantToolPolicy(db,{organizationId,subjectType,subjectId,connectionId=null,toolName='*',permission,createdBy,constraints={}}){
  if(!['bot','role','organization'].includes(subjectType)||!['allow_read','allow_propose','deny'].includes(permission))throw new Error('Invalid tool policy grant.');
  const policyVersion=(db.prepare('SELECT COALESCE(MAX(policy_version),0)+1 AS version FROM tool_policy_grants WHERE organization_id=?').get(organizationId).version),record={id:randomUUID(),organizationId,subjectType,subjectId,connectionId,toolName,permission,policyVersion};
  db.prepare('INSERT INTO tool_policy_grants(id,organization_id,subject_type,subject_id,connection_id,tool_name,permission,constraints,policy_version,created_by,created_at) VALUES(?,?,?,?,?,?,?,?,?,?,?)').run(record.id,organizationId,subjectType,subjectId,connectionId,toolName,permission,JSON.stringify(constraints),policyVersion,createdBy,now());return record;
}

export function proposeToolExecution(db,{organizationId,userId,botId,connectionId,catalogToolId,arguments:args={},reason='',missionId=null,runId=null,idempotencyKey}){
  const bot=db.prepare('SELECT * FROM agents WHERE id=? AND organization_id=? AND enabled=1 AND deleted_at IS NULL AND archived_at IS NULL').get(botId,organizationId),tool=db.prepare("SELECT * FROM mcp_tool_catalog WHERE id=? AND connection_id=? AND organization_id=? AND status='available'").get(catalogToolId,connectionId,organizationId);
  if(!bot)throw new Error('Active bot not found.');if(!tool)throw new Error('Available catalog tool not found.');
  if(!args||Array.isArray(args)||typeof args!=='object')throw new Error('Tool arguments must be an object.');
  const normalized=stable(args),argumentsHash=hash({connectionId,tool:tool.tool_name,arguments:normalized}),policy=policyFor(db,{organizationId,bot,tool}),requestId=randomUUID(),timestamp=now(),expiresAt=new Date(Date.now()+15*60_000).toISOString(),key=idempotencyKey||hash({organizationId,botId,argumentsHash,reason,missionId,runId});
  const existing=db.prepare('SELECT * FROM tool_execution_requests WHERE organization_id=? AND idempotency_key=?').get(organizationId,key);if(existing)return hydrateRequest(existing,policy);
  const status=policy.decision==='deny'?'denied':tool.risk_class==='read'&&policy.decision==='allow'?'approved':'pending_approval';
  db.prepare('INSERT INTO tool_execution_requests(id,organization_id,mission_id,run_id,bot_id,user_id,connection_id,catalog_tool_id,risk_class,normalized_arguments,arguments_hash,destination_summary,reason,status,policy_version,idempotency_key,expires_at,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)').run(requestId,organizationId,missionId,runId,botId,userId,connectionId,catalogToolId,tool.risk_class,JSON.stringify(normalized),argumentsHash,`${tool.tool_name} via connector ${connectionId}`,String(reason).slice(0,1000),status,policy.policyVersion,key,expiresAt,timestamp,timestamp);
  return hydrateRequest(db.prepare('SELECT * FROM tool_execution_requests WHERE id=?').get(requestId),policy);
}

const hydrateRequest=(row,policy)=>({...row,normalized_arguments:parse(row.normalized_arguments),policyDecision:policy||null,requiresApproval:row.status==='pending_approval',humanEffect:`Run ${row.destination_summary}.`,actionHash:row.arguments_hash});

export async function executeToolRequest(db,{organizationId,requestId,fetchImpl=fetch,lookupImpl,environment=process.env,providerToolExecutor}){
  const request=db.prepare('SELECT * FROM tool_execution_requests WHERE id=? AND organization_id=?').get(requestId,organizationId);if(!request)throw new Error('Tool execution request not found.');
  if(request.status!=='approved')throw new Error('Tool execution is not approved.');if(request.expires_at&&request.expires_at<now())throw new Error('Tool execution approval expired.');
  const tool=db.prepare('SELECT * FROM mcp_tool_catalog WHERE id=? AND organization_id=?').get(request.catalog_tool_id,organizationId),connection=db.prepare('SELECT * FROM connector_connections WHERE id=? AND organization_id=?').get(request.connection_id,organizationId);if(!tool||!connection)throw new Error('Tool or connector is no longer available.');
  assertUsageBudget(db,{organizationId,prospectiveEvents:1});
  const budget=db.prepare('SELECT * FROM connector_budgets WHERE organization_id=? AND connection_id=? ORDER BY updated_at DESC LIMIT 1').get(organizationId,request.connection_id);
  if(budget){const limits=parse(budget.limits),consumed=parse(budget.consumed);if(Number(consumed.calls||0)>=Number(limits.calls||0))throw new Error('Connector call budget is exhausted.');consumed.calls=Number(consumed.calls||0)+1;db.prepare('UPDATE connector_budgets SET consumed=?,updated_at=? WHERE id=? AND organization_id=?').run(JSON.stringify(consumed),now(),budget.id,organizationId);}
  const attempt=db.prepare('SELECT COALESCE(MAX(attempt),0)+1 AS attempt FROM tool_execution_receipts WHERE request_id=?').get(requestId).attempt,receiptId=randomUUID(),started=now();
  db.prepare("UPDATE tool_execution_requests SET status='running',updated_at=? WHERE id=?").run(started,requestId);
  db.prepare("INSERT INTO tool_execution_receipts(id,organization_id,request_id,attempt,status,policy_decision,before_evidence,after_evidence,usage,started_at) VALUES(?,?,?,?,'running',?,'[]','[]','{}',?)").run(receiptId,organizationId,requestId,attempt,JSON.stringify({approved:true,policyVersion:request.policy_version}),started);
  try{const args=parse(request.normalized_arguments),output=providerToolExecutor?await providerToolExecutor({organizationId,connection,tool,args}):await callMcpTool(connection,{name:tool.tool_name,arguments:args},{fetchImpl,lookupImpl,environment}),sanitized=JSON.parse(safeJson(output.result)),before=JSON.parse(safeJson(output.beforeEvidence||[])),after=JSON.parse(safeJson(output.afterEvidence||[])),rollback=output.rollback?JSON.parse(safeJson(output.rollback)):null,resourceIds=JSON.parse(safeJson(output.externalResourceIds||[]));db.prepare("UPDATE tool_execution_receipts SET status='succeeded',sanitized_result=?,result_hash=?,external_request_id=?,provider_request_id=?,before_evidence=?,after_evidence=?,rollback_metadata=?,external_resource_ids=?,usage=?,finished_at=? WHERE id=?").run(JSON.stringify(sanitized),hash(sanitized),output.externalRequestId||output.providerRequestId||null,output.providerRequestId||null,JSON.stringify(before),JSON.stringify(after),rollback?JSON.stringify(rollback):null,JSON.stringify(resourceIds),JSON.stringify({calls:1}),now(),receiptId);db.prepare("UPDATE tool_execution_requests SET status='succeeded',updated_at=? WHERE id=?").run(now(),requestId);db.prepare('INSERT INTO usage_ledger(id,organization_id,user_id,agent_id,mission_id,provider,connection_id,usage_type,units,estimated_cost,occurred_at) VALUES(?,?,?,?,?,?,?,?,?,?,?)').run(randomUUID(),organizationId,request.user_id,request.bot_id,request.mission_id,connection.connector_type==='google_workspace'?'google_workspace':'mcp',request.connection_id,'tool_call',JSON.stringify({calls:1}),null,now());return {requestId,receiptId,status:'succeeded',result:sanitized,evidence:{before,after,externalResourceIds:resourceIds},rollback};}
  catch(error){db.prepare("UPDATE tool_execution_receipts SET status='failed',error=?,finished_at=? WHERE id=?").run(String(error.message).slice(0,1000),now(),receiptId);db.prepare("UPDATE tool_execution_requests SET status='failed',updated_at=? WHERE id=?").run(now(),requestId);throw error;}
}

export async function decideToolExecution(db,args){
  const request=db.prepare('SELECT * FROM tool_execution_requests WHERE id=? AND organization_id=?').get(args.requestId,args.organizationId);if(!request)throw new Error('Tool execution request not found.');
  if(request.status!=='pending_approval')throw new Error('Tool execution is not awaiting approval.');if(request.arguments_hash!==args.actionHash)throw new Error('Action fingerprint mismatch; review the current exact action.');
  const status=args.decision==='approve'?'approved':'rejected';db.prepare('UPDATE tool_execution_requests SET status=?,approval_id=?,updated_at=? WHERE id=?').run(status,randomUUID(),now(),request.id);
  if(status==='approved')return executeToolRequest(db,args);return {requestId:request.id,status};
}

export function requestWithReceipts(db,{organizationId,requestId}){const request=db.prepare('SELECT * FROM tool_execution_requests WHERE id=? AND organization_id=?').get(requestId,organizationId);if(!request)return null;return {...hydrateRequest(request),receipts:db.prepare('SELECT * FROM tool_execution_receipts WHERE request_id=? AND organization_id=? ORDER BY attempt').all(requestId,organizationId).map(row=>({...row,policy_decision:parse(row.policy_decision),sanitized_result:row.sanitized_result?parse(row.sanitized_result):null,before_evidence:parse(row.before_evidence),after_evidence:parse(row.after_evidence),rollback_metadata:row.rollback_metadata?parse(row.rollback_metadata):null,external_resource_ids:row.external_resource_ids?parse(row.external_resource_ids):[],usage:parse(row.usage)}))};}
