import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createApp } from '../apps/api/server.mjs';
import { INTERNAL_MODELS, selectInternalMode, generateChatReply, messageNeedsTools, messageNeedsComputerTools, messageNeedsExternalTools } from '../apps/api/chat.mjs';

test('automatic routing covers casual, technical, and agentic requests',()=>{
  for(const message of ['Hi','Okay','How are you?','Tell me a joke']) assert.equal(selectInternalMode(message),'everyday',message);
  for(const message of ['Debug this Python function','What is 24 * 36?','Analyze the trade-offs','Plan this in several steps','Use tools to do this','Okay, let’s do this']) assert.equal(selectInternalMode(message),'reasoning',message);
  assert.equal(INTERNAL_MODELS.everyday.openai,'gpt-6-luna');
  assert.equal(INTERNAL_MODELS.reasoning.openai,'gpt-6.1-sol');
  assert.equal(INTERNAL_MODELS.everyday.gemini,'gemini-3.1-flash-lite');
  assert.equal(INTERNAL_MODELS.reasoning.gemini,'gemini-3.1-flash-lite');
});

test('simple conversation defers the heavy agent tool catalogue',()=>{
  assert.equal(messageNeedsTools('Hi, how are you?'),false);
  assert.equal(messageNeedsTools('Open Chrome on your computer and search for the policy.'),true);
  assert.equal(messageNeedsComputerTools('Open Chrome on your computer.'),true);
  assert.equal(messageNeedsExternalTools('Open Chrome on your computer.'),false);
  assert.equal(messageNeedsExternalTools('Draft and send an email through Gmail.'),true);
  assert.equal(messageNeedsComputerTools('Draft and send an email through Gmail.'),false);
  assert.equal(messageNeedsTools('Create a lesson plan for next week.'),false);
});

test('Gemini Flash-Lite uses the fast native route without exposing its key',async()=>{
  const calls=[];
  const fetchImpl=async(url,options)=>{
    calls.push({url,headers:options.headers,payload:JSON.parse(options.body)});
    return new Response(JSON.stringify({candidates:[{content:{parts:[{text:'Gemini answer'}]}}]}),{status:200});
  };
  const agent={name:'CHIEF',role:'Assistant',instructions:''};
  assert.equal(await generateChatReply({agent,message:'Hi',provider:'gemini',fetchImpl,apiKey:'gemini-test-key'}),'Gemini answer');
  assert.equal(await generateChatReply({agent,message:'Analyze this plan',provider:'gemini',fetchImpl,apiKey:'gemini-test-key'}),'Gemini answer');
  assert.ok(calls.every(call=>call.url==='https://generativelanguage.googleapis.com/v1beta/models/gemini-3.1-flash-lite:generateContent'));
  assert.ok(calls.every(call=>Array.isArray(call.payload.contents)&&call.payload.generationConfig.maxOutputTokens>0));
  assert.ok(calls.every(call=>call.headers['x-goog-api-key']==='gemini-test-key'&&!JSON.stringify(call.payload).includes('gemini-test-key')));
  await assert.rejects(generateChatReply({agent,message:'Hello',provider:'gemini',apiKey:''}),/GEMINI_API_KEY/);
});

test('Gemini retries one transient provider failure before showing an error',async()=>{
  let attempts=0;const fetchImpl=async()=>{attempts+=1;return attempts===1?new Response('{}',{status:503}):new Response(JSON.stringify({candidates:[{content:{parts:[{text:'Recovered quickly.'}]}}]}),{status:200});};
  const reply=await generateChatReply({agent:{name:'CHIEF',role:'Assistant',instructions:''},message:'Hello',provider:'gemini',fetchImpl,apiKey:'test-key'});
  assert.equal(reply,'Recovered quickly.');assert.equal(attempts,2);
});

test('health reports the selected AI provider without exposing its key',async()=>{
  const dir=mkdtempSync(join(tmpdir(),'build-provider-health-'));
  const app=createApp({databasePath:join(dir,'app.sqlite'),aiProvider:'gemini',geminiApiKey:'gemini-test-key'});
  await new Promise(resolve=>app.server.listen(0,'127.0.0.1',resolve));
  try {
    const response=await fetch(`http://127.0.0.1:${app.server.address().port}/api/health`);
    const health=await response.json();
    assert.equal(health.ai,'gemini');
    assert.equal(health.aiConfigured,true);
    assert.doesNotMatch(JSON.stringify(health),/gemini-test-key/);
  } finally {await app.close();rmSync(dir,{recursive:true,force:true});}
});

test('a chat PDF request creates a tenant-scoped downloadable artifact',async()=>{
  const dir=mkdtempSync(join(tmpdir(),'build-chat-pdf-'));
  const app=createApp({databasePath:join(dir,'app.sqlite'),artifactRoot:join(dir,'artifacts'),aiProvider:'gemini',geminiApiKey:'test-key',chatFetch:async()=>new Response(JSON.stringify({candidates:[{content:{parts:[{text:'Private Equity in South Africa\n\nA complete researched briefing with sources and conclusions.'}]}}]}),{status:200})});
  await new Promise(resolve=>app.server.listen(0,'127.0.0.1',resolve));
  const base=`http://127.0.0.1:${app.server.address().port}/api`,request=async(path,method='GET',payload,cookie='')=>{const response=await fetch(base+path,{method,headers:{...(payload?{'content-type':'application/json'}:{}),...(cookie?{cookie}:{})},body:payload?JSON.stringify(payload):undefined});return {response,body:response.headers.get('content-type')?.includes('json')?await response.json():null,cookie:response.headers.get('set-cookie')?.split(';')[0]};};
  try{
    const registered=await request('/auth/register','POST',{email:'pdf@example.com',password:'secure-password',organization:'PDF test'}),cookie=registered.cookie,state=(await request('/state','GET',undefined,cookie)).body,chief=state.agents.find(agent=>agent.slug==='chief');
    await request(`/agents/${chief.id}/activate`,'POST',{},cookie);
    const result=await request('/chat','POST',{message:'Research private equity in South Africa and put it into a PDF.'},cookie);
    assert.equal(result.response.status,200);assert.equal(result.body.artifact.mimeType,'application/pdf');assert.match(result.body.reply,/\[\[artifact:/);
    const download=await fetch(`http://127.0.0.1:${app.server.address().port}${result.body.artifact.downloadUrl}`,{headers:{cookie}}),bytes=Buffer.from(await download.arrayBuffer());
    assert.equal(download.status,200);assert.equal(download.headers.get('content-type'),'application/pdf');assert.equal(bytes.subarray(0,5).toString(),'%PDF-');
  }finally{await app.close();rmSync(dir,{recursive:true,force:true});}
});

test('OpenAI request keeps its key server-side and does not reveal internal names in its reply',async()=>{
  const calls=[];
  const fetchImpl=async(url,options)=>{
    calls.push({url,headers:options.headers,payload:JSON.parse(options.body)});
    return new Response(JSON.stringify({output:[{type:'message',content:[{type:'output_text',text:'Ready to help.'}]}]}),{status:200});
  };
  const agent={name:'CHIEF',role:'Assistant',instructions:''};
  assert.equal(await generateChatReply({agent,message:'Hi',provider:'openai',fetchImpl,apiKey:'test-key'}),'Ready to help.');
  assert.equal(await generateChatReply({agent,message:'Solve 2 + 2',provider:'openai',fetchImpl,apiKey:'test-key'}),'Ready to help.');
  assert.ok(calls.every(call=>call.url==='https://api.openai.com/v1/responses'));
  assert.deepEqual(calls.map(call=>call.payload.model),['gpt-6-luna','gpt-6.1-sol']);
  assert.ok(calls.every(call=>call.headers.Authorization==='Bearer test-key'&&call.payload.store===false&&!JSON.stringify(call.payload).includes('test-key')));
  await assert.rejects(
    generateChatReply({agent,message:'Hello',provider:'openai',fetchImpl:async()=>{throw new Error('connection refused');},apiKey:'test-key'}),
    /temporarily unavailable/
  );
  await assert.rejects(generateChatReply({agent,message:'Hello',provider:'openai',apiKey:''}),/OPENAI_API_KEY/);
});

test('chat and group creation/deletion work through the app without a model selector',async()=>{
  const dir=mkdtempSync(join(tmpdir(),'build-local-chat-'));
  const calls=[];
  const app=createApp({databasePath:join(dir,'app.sqlite'),aiProvider:'openai',openaiApiKey:'test-key',chatFetch:async(url,options)=>{
    const payload=JSON.parse(options.body);calls.push(payload.model);
    return new Response(JSON.stringify({output_text:'Hosted answer'}),{status:200});
  }});
  await new Promise(resolve=>app.server.listen(0,'127.0.0.1',resolve));
  const base=`http://127.0.0.1:${app.server.address().port}/api`;
  const call=async(path,method='GET',payload,cookie='')=>{
    const response=await fetch(base+path,{method,headers:{...(payload?{'content-type':'application/json'}:{}),...(cookie?{cookie}:{})},body:payload?JSON.stringify(payload):undefined});
    return {status:response.status,body:await response.json(),cookie:response.headers.get('set-cookie')?.split(';')[0]};
  };
  try {
    const registration=await call('/auth/register','POST',{email:'local@example.com',password:'secure-password',organization:'Local'});
    const cookie=registration.cookie;
    const initial=(await call('/state','GET',undefined,cookie)).body;
    const chief=initial.agents.find(a=>a.slug==='chief');
    const manager=initial.agents.find(a=>a.slug==='academic-research');
    assert.equal((await call(`/agents/${chief.id}/activate`,'POST',{},cookie)).status,200);
    const chiefOnlyGroup=await call('/groups','POST',{title:'Chief team',agentIds:[]},cookie);
    assert.equal(chiefOnlyGroup.status,201);
    assert.equal((await call('/chat','POST',{conversationId:chiefOnlyGroup.body.groupId,message:'HI'},cookie)).status,200);
    assert.equal((await call(`/groups/${chiefOnlyGroup.body.groupId}`,'DELETE',undefined,cookie)).status,200);
    for(const bot of initial.agents.filter(a=>a.slug!=='chief')) {
      assert.equal((await call(`/agents/${bot.id}/activate`,'POST',{},cookie)).status,200);
      assert.equal((await call(`/agents/${bot.id}/chat`,'POST',{message:'HI'},cookie)).status,200,bot.slug);
    }
    const custom=await call('/agents','POST',{name:'My bot',role:'General assistant',instructions:'Be useful.',accent:'#4F46E5'},cookie);
    assert.equal(custom.status,201);
    assert.equal((await call(`/agents/${custom.body.agentId}/chat`,'POST',{message:'Okay lets do this'},cookie)).status,200);
    assert.equal((await call(`/agents/${custom.body.agentId}/chat`,'POST',{message:'x'},cookie)).status,200);
    assert.equal((await call('/chat','POST',{message:'Hi'},cookie)).status,200);
    assert.equal((await call('/chat','POST',{message:'Debug my code'},cookie)).status,200);
    const group=await call('/groups','POST',{title:'Local team',agentIds:[manager.id]},cookie);
    assert.equal(group.status,201);
    assert.equal((await call('/chat','POST',{conversationId:group.body.groupId,message:'Okay'},cookie)).status,200);
    const populated=(await call('/state','GET',undefined,cookie)).body;
    assert.equal(populated.groups.length,1);
    assert.ok(populated.groupMessages.some(m=>m.conversation_id===group.body.groupId));
    assert.equal((await call(`/groups/${group.body.groupId}`,'DELETE',undefined,cookie)).status,200);
    const after=(await call('/state','GET',undefined,cookie)).body;
    assert.equal(after.groups.length,0);
    assert.ok(after.groupMessages.every(m=>m.conversation_id!==group.body.groupId));
    assert.equal(calls.length,16);
    assert.equal(calls.filter(model=>model==='gpt-6.1-sol').length,2);
    assert.ok(calls.every(model=>['gpt-6-luna','gpt-6.1-sol'].includes(model)));
  } finally {await app.close();rmSync(dir,{recursive:true,force:true});}
});
