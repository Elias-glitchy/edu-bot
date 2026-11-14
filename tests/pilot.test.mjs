import test from 'node:test';
import assert from 'node:assert/strict';
import { createApp } from '../apps/api/server.mjs';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

test('owner can sign in again and receives a fresh working session', async()=>{
  const dir=mkdtempSync(join(tmpdir(),'build-bot-auth-'));
  const app=createApp({databasePath:join(dir,'app.sqlite'),fixtureResearch:true});
  await new Promise(resolve=>app.server.listen(0,'127.0.0.1',resolve));
  const base=`http://127.0.0.1:${app.server.address().port}/api`;
  const send=async(path,payload,cookie='')=>{
    const res=await fetch(base+path,{method:payload?'POST':'GET',headers:{...(payload?{'content-type':'application/json'}:{}),...(cookie?{cookie}:{})},body:payload?JSON.stringify(payload):undefined});
    return {status:res.status,body:await res.json(),cookie:res.headers.get('set-cookie')?.split(';')[0]};
  };
  try {
    const credentials={email:'signin@example.com',password:'secure-password-123',organization:'Sign In Test'};
    const registration=await send('/auth/register',credentials);
    assert.equal(registration.status,201);
    const rejected=await send('/auth/login',{email:credentials.email,password:'wrong-password'});
    assert.equal(rejected.status,401);
    const login=await send('/auth/login',{email:credentials.email.toUpperCase(),password:credentials.password});
    assert.equal(login.status,200,JSON.stringify(login.body));
    assert.ok(login.cookie?.startsWith('bb_colleague_zero_session='));
    assert.notEqual(login.cookie,registration.cookie);
    const state=await send('/state',undefined,login.cookie);
    assert.equal(state.status,200);
    assert.equal(state.body.me.email,credentials.email);
    assert.equal(state.body.organization.name,credentials.organization);
  } finally {
    await app.close();
    rmSync(dir,{recursive:true,force:true});
  }
});

test('owner delegates research, receives a persisted result, and cannot access another tenant task', async()=>{
  const dir=mkdtempSync(join(tmpdir(),'build-bot-'));
  const file=join(dir,'app.sqlite');
  let app=createApp({databasePath:file,fixtureResearch:true});
  await new Promise(resolve=>app.server.listen(0,'127.0.0.1',resolve));
  let url=`http://127.0.0.1:${app.server.address().port}`;
  const call=async(path,method='GET',payload,cookie='')=>{
    const res=await fetch(url+'/api'+path,{method,headers:{...(payload?{'content-type':'application/json'}:{}),...(cookie?{cookie}:{})},body:payload?JSON.stringify(payload):undefined});
    return {status:res.status,body:await res.json(),cookie:res.headers.get('set-cookie')?.split(';')[0]};
  };
  try {
    const a=await call('/auth/register','POST',{email:'a@example.com',password:'secure-password-a',organization:'Alpha'});
    assert.equal(a.status,201);
    const b=await call('/auth/register','POST',{email:'b@example.com',password:'secure-password-b',organization:'Beta'});
    assert.equal(b.status,201);
    const first=await call('/state','GET',undefined,a.cookie);
    assert.equal(first.body.agents.length,11);
    assert.ok(first.body.agents.every(agent=>agent.enabled===0));
    assert.equal(first.body.tasks.length,0);
    assert.equal((await call('/state')).status,401);
    for(const slug of ['chief','academic-research']) {
      const agent=first.body.agents.find(item=>item.slug===slug);
      assert.equal((await call(`/agents/${agent.id}/activate`,'POST',{},a.cookie)).status,200);
    }
    const task=await call('/research','POST',{objective:'Research circular construction'},a.cookie);
    assert.equal(task.status,201,JSON.stringify(task.body));
    await app.work();
    const completed=await call('/state','GET',undefined,a.cookie);
    assert.equal(completed.body.tasks[0].status,'completed');
    assert.equal(completed.body.tasks[0].result.sources[0].url,'https://example.org/fixture');
    assert.ok(completed.body.events.some(e=>e.type==='task.delegated'));
    assert.ok(completed.body.events.some(e=>e.type==='task.completed'));
    assert.equal((await call(`/tasks/${task.body.taskId}/cancel`,'POST',{},b.cookie)).status,404);
    assert.equal((await call('/state','GET',undefined,b.cookie)).body.tasks.length,0);
    await app.close();
    app=createApp({databasePath:file,fixtureResearch:true});
    await new Promise(resolve=>app.server.listen(0,'127.0.0.1',resolve));
    url=`http://127.0.0.1:${app.server.address().port}`;
    const reload=await call('/state','GET',undefined,a.cookie);
    assert.equal(reload.body.tasks[0].status,'completed');
    assert.equal(reload.body.messages.length,3);
  } finally {
    await app.close();
    rmSync(dir,{recursive:true,force:true});
  }
});

test('research requests have a narrow, truthful scope', async()=>{
  const dir=mkdtempSync(join(tmpdir(),'build-bot-'));
  const app=createApp({databasePath:join(dir,'app.sqlite'),fixtureResearch:true});
  await new Promise(resolve=>app.server.listen(0,'127.0.0.1',resolve));
  const base=`http://127.0.0.1:${app.server.address().port}/api`;
  try {
    const create=await fetch(base+'/auth/register',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({email:'c@example.com',password:'secure-password-c',organization:'Gamma'})});
    const cookie=create.headers.get('set-cookie').split(';')[0];
    const res=await fetch(base+'/research',{method:'POST',headers:{'content-type':'application/json',cookie},body:JSON.stringify({objective:'Send an email to everyone'})});
    assert.equal(res.status,400);
    assert.match((await res.json()).error,/research requests/i);
  } finally {
    await app.close();
    rmSync(dir,{recursive:true,force:true});
  }
});

test('owner can pause, resume, and cancel a running task', async()=>{
  const dir=mkdtempSync(join(tmpdir(),'build-bot-'));
  const app=createApp({databasePath:join(dir,'app.sqlite'),fixtureResearch:true,fixtureDelayMs:120});
  await new Promise(resolve=>app.server.listen(0,'127.0.0.1',resolve));
  const base=`http://127.0.0.1:${app.server.address().port}/api`;
  const send=async(path,method='GET',payload,cookie='')=>{
    const res=await fetch(base+path,{method,headers:{...(payload?{'content-type':'application/json'}:{}),...(cookie?{cookie}:{})},body:payload?JSON.stringify(payload):undefined});
    return {status:res.status,body:await res.json(),cookie:res.headers.get('set-cookie')?.split(';')[0]};
  };
  try {
    const owner=await send('/auth/register','POST',{email:'d@example.com',password:'secure-password-d',organization:'Delta'});
    const agents=(await send('/state','GET',undefined,owner.cookie)).body.agents;
    for(const slug of ['chief','academic-research']) assert.equal((await send(`/agents/${agents.find(agent=>agent.slug===slug).id}/activate`,'POST',{},owner.cookie)).status,200);
    const a=await send('/research','POST',{objective:'Research clean building materials'},owner.cookie);
    assert.equal((await send(`/tasks/${a.body.taskId}/pause`,'POST',{},owner.cookie)).body.status,'paused');
    await app.work();
    assert.equal((await send('/state','GET',undefined,owner.cookie)).body.tasks[0].status,'paused');
    assert.equal((await send(`/tasks/${a.body.taskId}/resume`,'POST',{},owner.cookie)).body.status,'queued');
    await new Promise(resolve=>setTimeout(resolve,500));
    assert.equal((await send('/state','GET',undefined,owner.cookie)).body.tasks[0].status,'completed');
    const b=await send('/research','POST',{objective:'Research regional logistics'},owner.cookie);
    assert.equal((await send(`/tasks/${b.body.taskId}/cancel`,'POST',{},owner.cookie)).body.status,'cancelled');
    await new Promise(resolve=>setTimeout(resolve,250));
    assert.equal((await send('/state','GET',undefined,owner.cookie)).body.tasks[0].status,'cancelled');
  } finally {
    await app.close();rmSync(dir,{recursive:true,force:true});
  }
});
