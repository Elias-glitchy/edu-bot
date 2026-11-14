import test from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes, randomUUID } from 'node:crypto';
import { openStore, seedAgents } from '../apps/api/store.mjs';
import { createTokenVault } from '../apps/api/token-vault.mjs';
import { createOAuthRuntime } from '../apps/api/oauth-runtime.mjs';
import { createGoogleWorkspace, GOOGLE_WORKSPACE_TOOLS } from '../apps/api/google-workspace.mjs';
import { grantToolPolicy, policyFor, syncStaticToolCatalog } from '../apps/api/tool-execution.mjs';
import { createExternalToolExecutor, EXTERNAL_AGENT_TOOLS } from '../apps/api/agent-external-tools.mjs';

const setup=()=>{
  const db=openStore(':memory:'),organizationId=randomUUID(),userId=randomUUID(),timestamp=new Date().toISOString();
  db.prepare('INSERT INTO organizations(id,name,created_at) VALUES(?,?,?)').run(organizationId,'Test academy',timestamp);
  db.prepare('INSERT INTO users(id,email,salt,password_hash) VALUES(?,?,?,?)').run(userId,'owner@example.test','salt','hash');
  db.prepare("INSERT INTO memberships(user_id,organization_id,role) VALUES(?,?,'owner')").run(userId,organizationId);seedAgents(db,organizationId);db.prepare('UPDATE agents SET enabled=1,activation_state=1 WHERE organization_id=?').run(organizationId);
  const bot=db.prepare("SELECT * FROM agents WHERE organization_id=? AND slug='chief'").get(organizationId),connectionId=randomUUID();
  db.prepare("INSERT INTO connector_connections(id,organization_id,connector_type,display_name,status,scopes,created_at,updated_at,config) VALUES(?,?, 'google_workspace','Google Workspace','configured','[]',?,?,'{}')").run(connectionId,organizationId,timestamp,timestamp);
  return {db,organizationId,userId,bot,connectionId};
};

test('credential vault encrypts OAuth tokens and enforces tenant-scoped reads',()=>{
  const {db,organizationId,connectionId}=setup(),vault=createTokenVault(db,{encryptionKey:randomBytes(32).toString('base64')});
  vault.put({organizationId,connectionId,values:{accessToken:'top-secret-access',refreshToken:'top-secret-refresh'},scopeSet:['drive.file']});
  const stored=db.prepare('SELECT ciphertext FROM connection_credentials WHERE connection_id=?').get(connectionId);
  assert.doesNotMatch(stored.ciphertext,/top-secret/);assert.equal(vault.get({organizationId,connectionId}).values.refreshToken,'top-secret-refresh');assert.equal(vault.get({organizationId:randomUUID(),connectionId}),null);db.close();
});

test('Google OAuth uses PKCE, consumes state once and stores only encrypted tokens',async()=>{
  const {db,organizationId,userId,connectionId}=setup(),vault=createTokenVault(db,{encryptionKey:randomBytes(32).toString('base64')}),calls=[];
  const fetchImpl=async(url,options={})=>{calls.push({url:String(url),options});if(String(url).includes('/token'))return new Response(JSON.stringify({access_token:'access-secret',refresh_token:'refresh-secret',expires_in:3600,scope:'openid email'}),{status:200});return new Response(JSON.stringify({email:'lecturer@example.test'}),{status:200});};
  const runtime=createOAuthRuntime(db,{vault,environment:{COLLEAGUE_ZERO_GOOGLE_CLIENT_ID:'client',COLLEAGUE_ZERO_GOOGLE_CLIENT_SECRET:'secret',COLLEAGUE_ZERO_GOOGLE_REDIRECT_URI:'http://localhost:3005/api/connectors/oauth/callback'},fetchImpl});
  const started=await runtime.start({organizationId,connectionId,userId}),authorization=new URL(started.authorizationUrl),state=authorization.searchParams.get('state');
  assert.equal(authorization.searchParams.get('code_challenge_method'),'S256');assert.ok(authorization.searchParams.get('code_challenge'));
  const completed=await runtime.callback({state,code:'one-time-code'});assert.equal(completed.accountEmail,'lecturer@example.test');assert.equal(runtime.health({organizationId,connectionId}).status,'verified');
  await assert.rejects(()=>runtime.callback({state,code:'replay'}),/No active OAuth flow/);assert.doesNotMatch(db.prepare('SELECT ciphertext FROM connection_credentials').get().ciphertext,/access-secret/);assert.equal(calls.length,2);db.close();
});

test('bot-level deny overrides wider grants and external tools load schemas only on describe',async()=>{
  const {db,organizationId,userId,bot,connectionId}=setup(),tools=[{name:'google.drive.listFiles',description:'List files',risk:'read',inputSchema:{type:'object',properties:{query:{type:'string'}}},annotations:{readOnlyHint:true}}];
  const synced=syncStaticToolCatalog(db,{organizationId,connectionId,tools}),catalog=synced.tools[0];
  grantToolPolicy(db,{organizationId,subjectType:'organization',subjectId:organizationId,connectionId,toolName:'*',permission:'allow_read',createdBy:'owner'});
  grantToolPolicy(db,{organizationId,subjectType:'bot',subjectId:bot.id,connectionId,toolName:'*',permission:'deny',createdBy:'owner'});
  assert.equal(policyFor(db,{organizationId,bot,tool:{...catalog,tool_name:catalog.tool_name}}).decision,'deny');
  db.prepare('UPDATE tool_policy_grants SET revoked_at=? WHERE subject_type=\'bot\'').run(new Date().toISOString());
  assert.ok(EXTERNAL_AGENT_TOOLS.every(item=>item.type==='function'&&item.function?.name&&item.function?.parameters));
  const executor=createExternalToolExecutor(db,{organizationId,userId,botId:bot.id,providerToolExecutor:async()=>({result:{files:[{id:'1'}]},afterEvidence:[],externalResourceIds:[]})});
  const search=await executor('external_tool_search',{query:'files'});assert.equal(search.tools.length,1);assert.equal('inputSchema' in search.tools[0],false);
  const described=await executor('external_tool_describe',{catalogToolId:catalog.id,connectionId});assert.equal(described.inputSchema.type,'object');
  const describedFromGemini=await executor('external_tool_describe',JSON.stringify({catalogToolId:catalog.id,connectionId}));assert.equal(describedFromGemini.inputSchema.type,'object');
  const executed=await executor('external_tool_request',{catalogToolId:catalog.id,connectionId,arguments:{query:'lesson'},reason:'Find lesson files'});assert.equal(executed.status,'succeeded');assert.equal(executed.result.files[0].id,'1');db.close();
});

test('Google Workspace adapter exposes stable academic tools and records write evidence',async()=>{
  const calls=[],workspace=createGoogleWorkspace({oauthRuntime:{accessToken:async()=> 'access'},fetchImpl:async(url,options)=>{calls.push({url:String(url),options});return new Response(JSON.stringify({id:'event-1',htmlLink:'https://calendar.test/event-1'}),{status:200,headers:{'content-type':'application/json','x-request-id':'request-1'}});}});
  assert.ok(GOOGLE_WORKSPACE_TOOLS.some(tool=>tool.name==='google.gmail.createDraft'));assert.ok(GOOGLE_WORKSPACE_TOOLS.some(tool=>tool.name==='google.sheets.validateRubricTotal'));
  const output=await workspace.call({organizationId:'org',connectionId:'connection',name:'google.calendar.createEvent',args:{calendarId:'primary',summary:'Lesson',start:{dateTime:'2026-11-13T09:00:00+02:00'},end:{dateTime:'2026-11-13T10:00:00+02:00'}}});
  assert.equal(output.providerRequestId,'request-1');assert.deepEqual(output.externalResourceIds,['event-1']);assert.equal(output.rollback.toolName,'google.calendar.cancelEvent');assert.equal(calls.length,1);
});
