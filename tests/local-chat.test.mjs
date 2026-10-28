import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createApp } from '../apps/api/server.mjs';
import { INTERNAL_MODELS, selectInternalMode, generateChatReply } from '../apps/api/chat.mjs';

test('automatic routing covers casual, technical, and agentic requests',()=>{
  for(const message of ['Hi','Okay','How are you?','Tell me a joke']) assert.equal(selectInternalMode(message),'everyday',message);
  for(const message of ['Debug this Python function','What is 24 * 36?','Analyze the trade-offs','Plan this in several steps','Use tools to do this','Okay, let’s do this']) assert.equal(selectInternalMode(message),'reasoning',message);
  assert.equal(INTERNAL_MODELS.everyday.ollama,'llama3.2:3b');
  assert.equal(INTERNAL_MODELS.reasoning.ollama,'qwen2.5:3b');
});

test('Ollama request stays local and does not reveal internal names in its reply',async()=>{
  const calls=[];
  const fetchImpl=async(url,options)=>{
    calls.push({url,payload:JSON.parse(options.body)});
    return new Response(JSON.stringify({message:{content:'Ready to help.'}}),{status:200});
  };
  const agent={name:'CHIEF',role:'Assistant',instructions:''};
  assert.equal(await generateChatReply({agent,message:'Hi',fetchImpl}),'Ready to help.');
  assert.equal(await generateChatReply({agent,message:'Solve 2 + 2',fetchImpl}),'Ready to help.');
  assert.ok(calls.every(call=>call.url==='http://localhost:11434/api/chat'));
  assert.deepEqual(calls.map(call=>call.payload.model),['llama3.2:3b','qwen2.5:3b']);
  assert.ok(calls.every(call=>call.payload.keep_alive===0&&call.payload.options.num_ctx===2048));
  await assert.rejects(
    generateChatReply({agent,message:'Hello',fetchImpl:async()=>{throw new Error('connection refused');}}),
    /Start Ollama/
  );
});

test('chat and group creation/deletion work through the app without a model selector',async()=>{
  const dir=mkdtempSync(join(tmpdir(),'build-local-chat-'));
  const calls=[];
  const app=createApp({databasePath:join(dir,'app.sqlite'),chatFetch:async(url,options)=>{
    const payload=JSON.parse(options.body);calls.push(payload.model);
    return new Response(JSON.stringify({message:{content:'Local answer'}}),{status:200});
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
    const manager=initial.agents.find(a=>a.slug==='intelligence-manager');
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
    assert.equal(calls.filter(model=>model==='qwen2.5:3b').length,2);
    assert.ok(calls.every(model=>['llama3.2:3b','qwen2.5:3b'].includes(model)));
  } finally {await app.close();rmSync(dir,{recursive:true,force:true});}
});
