import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createApp } from '../apps/api/server.mjs';
import { renderMessenger } from '../apps/web/messenger-view.js';

test('built-in bots start outside the Inbox, activate per workspace, and cannot be deleted',async()=>{
  const dir=mkdtempSync(join(tmpdir(),'build-bot-workforce-'));
  const app=createApp({databasePath:join(dir,'app.sqlite'),fixtureResearch:true});
  await new Promise(resolve=>app.server.listen(0,'127.0.0.1',resolve));
  const base=`http://127.0.0.1:${app.server.address().port}/api`;
  const call=async(path,method='GET',payload,cookie='')=>{
    const response=await fetch(base+path,{method,headers:{...(payload?{'content-type':'application/json'}:{}),...(cookie?{cookie}:{})},body:payload?JSON.stringify(payload):undefined});
    return {status:response.status,body:await response.json(),cookie:response.headers.get('set-cookie')?.split(';')[0]};
  };
  const originalStorage=globalThis.localStorage;
  globalThis.localStorage={getItem:()=>null};
  try{
    const owner=await call('/auth/register','POST',{email:'workforce-owner@example.com',password:'test-password-123',organization:'Alpha'});
    const other=await call('/auth/register','POST',{email:'workforce-other@example.com',password:'test-password-456',organization:'Beta'});
    const state=(await call('/state','GET',undefined,owner.cookie)).body;
    assert.equal(state.agents.length,11);
    assert.ok(state.agents.every(agent=>agent.enabled===0));
    const html=renderMessenger({data:state,view:'chief',activeAgentId:null,activeGroupId:null,mobileThreadOpen:false,notice:'',theme:'dark',filter:'',esc:value=>String(value),time:value=>value,taskCard:()=>''});
    assert.match(html,/Your Inbox starts empty/);
    assert.doesNotMatch(html,/data-inbox-agent=/);
    const chief=state.agents.find(agent=>agent.slug==='chief');
    const finance=state.agents.find(agent=>agent.slug==='finance-manager');
    assert.equal((await call(`/agents/${chief.id}/activate`,'POST',{},other.cookie)).status,404);
    assert.equal((await call(`/agents/${chief.id}`,'DELETE',undefined,owner.cookie)).status,404);
    assert.equal((await call(`/agents/${finance.id}/activate`,'POST',{},owner.cookie)).status,200);
    let next=(await call('/state','GET',undefined,owner.cookie)).body;
    assert.equal(next.agents.filter(agent=>agent.enabled).length,1);
    assert.match(renderMessenger({data:next,view:'chief',activeAgentId:null,activeGroupId:null,mobileThreadOpen:false,notice:'',theme:'dark',filter:'',esc:value=>String(value),time:value=>value,taskCard:()=>''}),/data-inbox-agent="/);
    assert.equal((await call(`/agents/${finance.id}/deactivate`,'POST',{},owner.cookie)).status,200);
    next=(await call('/state','GET',undefined,owner.cookie)).body;
    assert.equal(next.agents.find(agent=>agent.id===finance.id).enabled,0);
    assert.doesNotMatch(renderMessenger({data:next,view:'chief',activeAgentId:null,activeGroupId:null,mobileThreadOpen:false,notice:'',theme:'dark',filter:'',esc:value=>String(value),time:value=>value,taskCard:()=>''}),new RegExp(`data-inbox-agent="${finance.id}"`));
    assert.equal((await call(`/agents/${finance.id}/activate`,'POST',{},owner.cookie)).status,200);
    next=(await call('/state','GET',undefined,owner.cookie)).body;
    assert.match(renderMessenger({data:next,view:'chief',activeAgentId:null,activeGroupId:null,mobileThreadOpen:false,notice:'',theme:'dark',filter:'',esc:value=>String(value),time:value=>value,taskCard:()=>''}),new RegExp(`data-inbox-agent="${finance.id}"`));
    assert.equal((await call('/research','POST',{objective:'Research public concrete'},owner.cookie)).status,409);
    assert.equal((await call('/state','GET',undefined,other.cookie)).body.agents.filter(agent=>agent.enabled).length,0);
  }finally{globalThis.localStorage=originalStorage;await app.close();rmSync(dir,{recursive:true,force:true});}
});

test('custom-bot deletion removes the bot but preserves its historical research',async()=>{
  const dir=mkdtempSync(join(tmpdir(),'build-bot-delete-'));
  const app=createApp({databasePath:join(dir,'app.sqlite'),fixtureResearch:true});
  await new Promise(resolve=>app.server.listen(0,'127.0.0.1',resolve));
  const base=`http://127.0.0.1:${app.server.address().port}/api`;
  const call=async(path,method='GET',payload,cookie='')=>{
    const response=await fetch(base+path,{method,headers:{...(payload?{'content-type':'application/json'}:{}),...(cookie?{cookie}:{})},body:payload?JSON.stringify(payload):undefined});
    return {status:response.status,body:await response.json(),cookie:response.headers.get('set-cookie')?.split(';')[0]};
  };
  try{
    const owner=await call('/auth/register','POST',{email:'delete-owner@example.com',password:'test-password-123',organization:'Alpha'});
    const other=await call('/auth/register','POST',{email:'delete-other@example.com',password:'test-password-456',organization:'Beta'});
    const created=await call('/agents','POST',{name:'My researcher',role:'Public research',instructions:'Use public sources',accent:'#4F46E5'},owner.cookie);
    assert.equal(created.status,201);
    const agentId=created.body.agentId;
    const task=await call(`/agents/${agentId}/research`,'POST',{objective:'Research public masonry'},owner.cookie);
    assert.equal(task.status,201);
    await app.work();
    const schedule=await call('/schedules','POST',{kind:'research',title:'Daily masonry',agentId,objective:'Research public masonry',localTime:'09:00',weekdays:[1,2,3]},owner.cookie);
    assert.equal(schedule.status,201);
    assert.equal((await call(`/agents/${agentId}`,'DELETE',undefined,other.cookie)).status,404);
    assert.equal((await call(`/agents/${agentId}`,'DELETE',undefined,owner.cookie)).status,200);
    const after=(await call('/state','GET',undefined,owner.cookie)).body;
    assert.equal(after.agents.some(agent=>agent.id===agentId),false);
    assert.equal(after.tasks.find(item=>item.id===task.body.taskId).status,'completed');
    assert.equal(after.schedules.find(item=>item.id===schedule.body.scheduleId).enabled,0);
    assert.equal((await call(`/agents/${agentId}/research`,'POST',{objective:'Research public masonry'},owner.cookie)).status,404);
    assert.equal((await call(`/agents/${agentId}`,'DELETE',undefined,owner.cookie)).status,404);
  }finally{await app.close();rmSync(dir,{recursive:true,force:true});}
});
