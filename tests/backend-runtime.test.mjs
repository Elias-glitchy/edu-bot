import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { openStore, seedAgents, now } from '../apps/api/store.mjs';
import { createFakeComputerProvider } from '../apps/api/computer-provider.mjs';
import { startComputer } from '../apps/api/computers.mjs';
import { createCredentialBroker } from '../apps/api/credential-broker.mjs';
import { beginAgentRun, createAgentToolExecutor, decideAgentAction, finishAgentRun, GEMINI_AGENT_TOOLS } from '../apps/api/agent-runtime.mjs';
import { enqueueJob, claimNextJob, completeJob, failJob } from '../apps/api/durable-jobs.mjs';
import { queueGeminiBatch, refreshGeminiBatch, submitGeminiBatch } from '../apps/api/gemini-batch.mjs';
import { generateChatReply } from '../apps/api/chat.mjs';
import { createGoogleSheetsProvider } from '../apps/api/google-sheets-provider.mjs';
import { generateKeyPairSync } from 'node:crypto';
import { applySecurityHeaders, RateLimiter } from '../apps/api/security.mjs';

function workspace(){
  const dir=mkdtempSync(join(tmpdir(),'build-backend-runtime-')),db=openStore(join(dir,'app.sqlite')),organizationId='org-test';
  db.prepare('INSERT INTO organizations(id,name,created_at) VALUES(?,?,?)').run(organizationId,'Runtime Test',now());seedAgents(db,organizationId);
  const agent=db.prepare("SELECT * FROM agents WHERE organization_id=? AND slug='chief'").get(organizationId);db.prepare('UPDATE agents SET enabled=1,activation_state=1 WHERE id=?').run(agent.id);
  return {dir,db,organizationId,agent,close(){db.close();rmSync(dir,{recursive:true,force:true});}};
}

test('agent computer tools are bounded and credential values never persist',async()=>{
  const scope=workspace(),provider=createFakeComputerProvider(),broker=createCredentialBroker();
  try{
    const computer=scope.db.prepare('SELECT * FROM computers WHERE organization_id=? AND agent_id=?').get(scope.organizationId,scope.agent.id);
    await startComputer(scope.db,provider,{organizationId:scope.organizationId,computerId:computer.id,ownerId:'owner-test',actor:'owner@example.invalid'});
    const run=beginAgentRun(scope.db,{organizationId:scope.organizationId,agentId:scope.agent.id,objective:'Read a page then sign in'}),credential=broker.issue({organizationId:scope.organizationId,values:{password:'never-store-this-secret'}});
    let captured;
    const original=provider.browserAction.bind(provider);provider.browserAction=async(target,payload)=>{captured=payload;return original(target,payload);};
    const execute=createAgentToolExecutor({db:scope.db,provider,credentialBroker:broker,organizationId:scope.organizationId,agent:scope.agent,actor:'chief',runId:run.id,lookupImpl:async()=>[{address:'93.184.215.14'}]});
    assert.equal((await execute('computer_status','{}')).ready,true);
    assert.equal((await execute('computer_read',JSON.stringify({action:'navigate',url:'https://example.org/'}))).ok,true);
    const proposal=await execute('computer_propose_action',JSON.stringify({action:'fill_credential',selector:'#password',credentialLeaseId:credential.leaseId,credentialField:'password',reason:'Sign in to the approved demonstration account'}));
    assert.equal(proposal.approvalRequired,true);assert.doesNotMatch(JSON.stringify(scope.db.prepare('SELECT * FROM agent_action_proposals').all()),/never-store-this-secret/);
    const result=await decideAgentAction(scope.db,provider,broker,{organizationId:scope.organizationId,proposalId:proposal.proposalId,decision:'approve',actionHash:proposal.actionHash,actor:'owner@example.invalid'});
    assert.equal(result.status,'executed');assert.equal(captured.value,'never-store-this-secret');assert.equal(broker.count(),0);
    assert.equal(scope.db.prepare('SELECT status FROM agent_action_proposals WHERE id=?').get(proposal.proposalId).status,'executed');
    assert.equal(scope.db.prepare('SELECT COUNT(*) count FROM agent_run_steps WHERE run_id=?').get(run.id).count,3);finishAgentRun(scope.db,{organizationId:scope.organizationId,runId:run.id});
  }finally{scope.close();}
});

test('local computer capacity stops an idle desktop before starting another',async()=>{
  const scope=workspace(),provider=createFakeComputerProvider();provider.maxRunningComputers=1;
  try{
    const secondAgent=scope.db.prepare("SELECT * FROM agents WHERE organization_id=? AND slug!='chief' ORDER BY name LIMIT 1").get(scope.organizationId);
    scope.db.prepare('UPDATE agents SET enabled=1,activation_state=1 WHERE id=?').run(secondAgent.id);
    const first=scope.db.prepare('SELECT * FROM computers WHERE organization_id=? AND agent_id=?').get(scope.organizationId,scope.agent.id),second=scope.db.prepare('SELECT * FROM computers WHERE organization_id=? AND agent_id=?').get(scope.organizationId,secondAgent.id);
    await startComputer(scope.db,provider,{organizationId:scope.organizationId,computerId:first.id,ownerId:'owner-test',actor:'owner@example.invalid'});
    const firstVolume=scope.db.prepare('SELECT volume_ref FROM computers WHERE id=?').get(first.id).volume_ref;
    await startComputer(scope.db,provider,{organizationId:scope.organizationId,computerId:second.id,ownerId:'owner-test',actor:'owner@example.invalid'});
    assert.equal(scope.db.prepare('SELECT state FROM computers WHERE id=?').get(first.id).state,'stopped');
    assert.equal(scope.db.prepare('SELECT volume_ref FROM computers WHERE id=?').get(first.id).volume_ref,firstVolume);
    assert.equal(scope.db.prepare('SELECT state FROM computers WHERE id=?').get(second.id).state,'running');
  }finally{scope.close();}
});

test('durable jobs provide idempotency, leases, retries and budgets',()=>{
  const scope=workspace();
  try{
    const first=enqueueJob(scope.db,{organizationId:scope.organizationId,kind:'report',idempotencyKey:'daily-1',payload:{date:'2026-10-29'},maxAttempts:2,budgetUnits:10}),duplicate=enqueueJob(scope.db,{organizationId:scope.organizationId,kind:'report',idempotencyKey:'daily-1',payload:{date:'changed'}});assert.equal(duplicate.id,first.id);
    const claim=claimNextJob(scope.db,{kinds:['report']});assert.equal(claim.job.attempt,1);
    const retry=failJob(scope.db,{jobId:first.id,leaseToken:claim.leaseToken,error:'temporary',transient:true,retryDelayMs:100,consumedUnits:2});assert.equal(retry.status,'retrying');
    scope.db.prepare('UPDATE durable_jobs SET next_attempt_at=? WHERE id=?').run('2000-01-01T00:00:00.000Z',first.id);
    const second=claimNextJob(scope.db,{kinds:['report']});assert.equal(second.job.attempt,2);
    const completed=completeJob(scope.db,{jobId:first.id,leaseToken:second.leaseToken,consumedUnits:3});assert.equal(completed.status,'completed');assert.equal(completed.consumed_units,5);
  }finally{scope.close();}
});

test('Gemini batches queue idempotently and submit without putting the key in payloads',async()=>{
  const scope=workspace(),calls=[];
  try{
    const input={organizationId:scope.organizationId,displayName:'Nightly summaries',requests:[{key:'one',text:'Summarize the fictional report.'}]},queued=queueGeminiBatch(scope.db,input),duplicate=queueGeminiBatch(scope.db,input);assert.equal(duplicate.id,queued.id);assert.equal(queued.status,'awaiting_credentials');
    const submitFetch=async(url,options)=>{calls.push({url,headers:options.headers,body:options.body});return new Response(JSON.stringify({name:'batches/demo-1',state:'BATCH_STATE_PENDING'}),{status:200});};
    const submitted=await submitGeminiBatch(scope.db,{batchId:queued.id,organizationId:scope.organizationId,apiKey:'gemini-secret-key',fetchImpl:submitFetch});assert.equal(submitted.provider_ref,'batches/demo-1');assert.equal(calls[0].headers['x-goog-api-key'],'gemini-secret-key');assert.doesNotMatch(calls[0].body,/gemini-secret-key/);
    const refreshed=await refreshGeminiBatch(scope.db,{batchId:queued.id,organizationId:scope.organizationId,apiKey:'gemini-secret-key',fetchImpl:async()=>new Response(JSON.stringify({name:'batches/demo-1',state:'BATCH_STATE_SUCCEEDED',batchStats:{requestCount:'1',successfulRequestCount:'1'}}),{status:200})});assert.equal(refreshed.status,'succeeded');
  }finally{scope.close();}
});

test('Gemini tool calls execute through the allowlisted loop and return tool evidence',async()=>{
  let call=0,secondPayload,toolExecutions=0;
  const fetchImpl=async(_url,options)=>{
    call+=1;const payload=JSON.parse(options.body);
    if(call===1)return new Response(JSON.stringify({candidates:[{content:{role:'model',parts:[{functionCall:{id:'tool-1',name:'computer_status',args:{}}}]}}]}),{status:200});
    secondPayload=payload;return new Response(JSON.stringify({candidates:[{content:{role:'model',parts:[{text:'The computer is stopped.'}]}}]}),{status:200});
  };
  const reply=await generateChatReply({agent:{name:'CHIEF',role:'Assistant',instructions:''},message:'Check your computer',provider:'gemini',apiKey:'test-key',fetchImpl,tools:GEMINI_AGENT_TOOLS,toolExecutor:async(name)=>{toolExecutions+=1;return {name,state:'stopped'};}});
  assert.equal(reply,'The computer is stopped.');assert.equal(toolExecutions,1);assert.ok(secondPayload.contents.some(item=>item.parts?.some(part=>part.functionResponse?.id==='tool-1'&&part.functionResponse?.name==='computer_status')));
});

test('Google Sheets provider uses a scoped service-account token without exposing its private key',async()=>{
  const {privateKey}=generateKeyPairSync('rsa',{modulusLength:2048}),pem=privateKey.export({type:'pkcs8',format:'pem'}),calls=[];
  const fetchImpl=async(url,options)=>{calls.push({url,options});if(url==='https://oauth2.googleapis.com/token')return new Response(JSON.stringify({access_token:'scoped-access-token',expires_in:3600}),{status:200});return new Response(JSON.stringify({spreadsheetId:'abcDEF_12345678901234567890',properties:{title:'Fictional Grades'}}),{status:200});};
  const provider=createGoogleSheetsProvider({client_email:'build-bot@example.invalid',private_key:pem},{fetchImpl}),result=await provider.verify('abcDEF_12345678901234567890');
  assert.equal(result.verified,true);assert.equal(calls[1].options.headers.Authorization,'Bearer scoped-access-token');assert.doesNotMatch(JSON.stringify(calls),/BEGIN PRIVATE KEY/);
});

test('rate limiter enforces a bounded window and recovers after expiry',()=>{
  let instant=0;const limiter=new RateLimiter({windowMs:1000,limit:2,clock:()=>instant});assert.equal(limiter.consume('tenant').allowed,true);assert.equal(limiter.consume('tenant').allowed,true);assert.equal(limiter.consume('tenant').allowed,false);instant=1001;assert.equal(limiter.consume('tenant').allowed,true);
});

test('only same-origin computer streams may render inside the BUILD BOT viewer',()=>{
  const capture=url=>{const headers=new Map();applySecurityHeaders({url,headers:{},socket:{}},{setHeader:(name,value)=>headers.set(name,value)},'request-id');return headers.get('Content-Security-Policy');};
  assert.match(capture('/computer-stream/token/vnc.html'),/frame-ancestors 'self'/);
  assert.match(capture('/'),/frame-ancestors 'none'/);
});
