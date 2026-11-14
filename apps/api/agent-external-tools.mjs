import { describeTool, executeToolRequest, proposeToolExecution, requestWithReceipts, searchTools } from './tool-execution.mjs';

export const EXTERNAL_AGENT_TOOLS=Object.freeze([
  {type:'function',function:{name:'external_tool_search',description:'Search the governed external tool catalog only when a task needs an outside application. Returns compact matches without loading full schemas.',parameters:{type:'object',properties:{query:{type:'string'},risk:{type:'string',enum:['read','draft','reversible_write','consequential_write']},limit:{type:'integer',minimum:1,maximum:12}},required:['query'],additionalProperties:false}}},
  {type:'function',function:{name:'external_tool_describe',description:'Load the full input schema and permission decision for one governed external tool.',parameters:{type:'object',properties:{catalogToolId:{type:'string'},connectionId:{type:'string'}},required:['catalogToolId','connectionId'],additionalProperties:false}}},
  {type:'function',function:{name:'external_tool_request',description:'Request a governed external tool action. Read-only actions may execute immediately; writes pause for exact human approval.',parameters:{type:'object',properties:{catalogToolId:{type:'string'},connectionId:{type:'string'},arguments:{type:'object'},reason:{type:'string'}},required:['catalogToolId','connectionId','arguments','reason'],additionalProperties:false}}},
  {type:'function',function:{name:'external_tool_status',description:'Check an external action request and its evidence receipts.',parameters:{type:'object',properties:{requestId:{type:'string'}},required:['requestId'],additionalProperties:false}}}
]);

export function createExternalToolExecutor(db,{organizationId,userId,botId,runId=null,missionId=null,providerToolExecutor,fetchImpl=fetch,lookupImpl,environment=process.env}){
  return async(name,rawArgs={})=>{
    let args=rawArgs;try{if(typeof rawArgs==='string')args=JSON.parse(rawArgs||'{}');}catch{throw new Error('External tool arguments are invalid JSON.');}
    if(!args||Array.isArray(args)||typeof args!=='object')throw new Error('External tool arguments must be an object.');
    if(name==='external_tool_search')return {tools:searchTools(db,{organizationId,botId,query:String(args.query||''),risk:args.risk,limit:args.limit||8,includeSchema:false}).map(tool=>({catalogToolId:tool.id,connectionId:tool.connection_id,name:tool.tool_name,description:tool.description,risk:tool.risk_class,policy:tool.policy.decision}))};
    if(name==='external_tool_describe'){const found=describeTool(db,{organizationId,botId,catalogToolId:args.catalogToolId,connectionId:args.connectionId});if(!found)throw new Error('Tool is unavailable or denied for this bot.');return {catalogToolId:found.id,connectionId:found.connection_id,name:found.tool_name,description:found.description,risk:found.risk_class,inputSchema:found.input_schema,policy:found.policy};}
    if(name==='external_tool_request'){
      const request=proposeToolExecution(db,{organizationId,userId,botId,connectionId:args.connectionId,catalogToolId:args.catalogToolId,arguments:args.arguments||{},reason:args.reason||'',missionId,runId});
      if(request.status==='approved')return executeToolRequest(db,{organizationId,requestId:request.id,providerToolExecutor,fetchImpl,lookupImpl,environment});
      return {requestId:request.id,status:request.status,requiresApproval:request.requiresApproval,actionHash:request.actionHash,humanEffect:request.humanEffect,policy:request.policyDecision};
    }
    if(name==='external_tool_status'){const request=requestWithReceipts(db,{organizationId,requestId:args.requestId});if(!request)throw new Error('External action request not found.');return request;}
    throw new Error(`Unknown external tool: ${name}`);
  };
}
