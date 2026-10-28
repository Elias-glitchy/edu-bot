import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createApp } from '../apps/api/server.mjs';
import { AVATARS, DEFAULT_AVATAR_ID, agentAvatarSrc, isValidAvatarId } from '../apps/web/avatar-library.js';

test('all 75 corrected avatar assets have stable unique IDs and square PNG files',()=>{
  assert.equal(AVATARS.length,75);
  assert.equal(new Set(AVATARS.map(avatar=>avatar.id)).size,75);
  assert.equal(DEFAULT_AVATAR_ID,'bot_avatar_001');
  assert.equal(AVATARS.at(-1).id,'bot_avatar_075');
  for(const avatar of AVATARS){
    assert.equal(isValidAvatarId(avatar.id),true);
    const path=join(process.cwd(),'apps','web',avatar.src.slice(1));
    assert.equal(existsSync(path),true,path);
    const header=readFileSync(path).subarray(0,24);
    assert.deepEqual([...header.subarray(0,8)],[137,80,78,71,13,10,26,10]);
    assert.equal(header.readUInt32BE(16),header.readUInt32BE(20),'avatar is square');
    assert.ok(header.readUInt32BE(16)>=512,'avatar is large enough for display');
  }
  assert.equal(isValidAvatarId('bot_avatar_076'),false);
  assert.equal(agentAvatarSrc({kind:'custom',avatar_id:'bot_avatar_075'}),AVATARS[74].src);
  assert.equal(agentAvatarSrc({kind:'custom'}),AVATARS[0].src);
  assert.equal(agentAvatarSrc({kind:'built_in',slug:'chief'}),'/assets/agents/chief.png');
});

test('changing only avatar leaves a bot configuration, scheduled work, and research behavior unchanged',async()=>{
  const dir=mkdtempSync(join(tmpdir(),'build-bot-avatar-'));
  const app=createApp({databasePath:join(dir,'app.sqlite'),fixtureResearch:true});
  await new Promise(resolve=>app.server.listen(0,'127.0.0.1',resolve));
  const base=`http://127.0.0.1:${app.server.address().port}`;
  const call=async(path,method='GET',payload,cookie='')=>{
    const response=await fetch(base+path,{method,headers:{...(payload?{'content-type':'application/json'}:{}),...(cookie?{cookie}:{})},body:payload?JSON.stringify(payload):undefined});
    return {status:response.status,body:await response.json(),cookie:response.headers.get('set-cookie')?.split(';')[0]};
  };
  try{
    const image=await fetch(`${base}/assets/bot-avatars-v2/bot-avatar-075.png`);
    assert.equal(image.status,200);
    assert.match(image.headers.get('content-type'),/image\/png/);
    const owner=await call('/api/auth/register','POST',{email:'avatar-owner@example.com',password:'test-password-123',organization:'Avatar Test'});
    const other=await call('/api/auth/register','POST',{email:'avatar-other@example.com',password:'test-password-456',organization:'Other Test'});
    const configuration={name:'Market Researcher',role:'Public market research',instructions:'Use public sources only.',accent:'#4F46E5'};
    assert.equal((await call('/api/agents','POST',{...configuration,avatarId:'bot_avatar_999'},owner.cookie)).status,400);
    const created=await call('/api/agents','POST',{...configuration,avatarId:'bot_avatar_001'},owner.cookie);
    assert.equal(created.status,201);
    const second=await call('/api/agents','POST',{...configuration,avatarId:'bot_avatar_001'},owner.cookie);
    assert.equal(second.status,201,'avatars are reusable by multiple bots');
    const agentId=created.body.agentId;
    const routine=await call('/api/schedules','POST',{kind:'research',title:'Weekday scan',agentId,objective:'Research public building materials',localTime:'09:00',weekdays:[1,2,3,4,5]},owner.cookie);
    assert.equal(routine.status,201,JSON.stringify(routine.body));
    const before=(await call('/api/state','GET',undefined,owner.cookie)).body;
    const beforeAgent=before.agents.find(agent=>agent.id===agentId);
    assert.equal(beforeAgent.avatar_id,'bot_avatar_001');
    assert.equal(before.agents.find(agent=>agent.id===second.body.agentId).avatar_id,'bot_avatar_001');
    const firstTask=await call(`/api/agents/${agentId}/research`,'POST',{objective:'Research public building methods'},owner.cookie);
    assert.equal(firstTask.status,201);
    await app.work();
    assert.equal((await call(`/api/agents/${agentId}/avatar`,'PATCH',{avatarId:'bot_avatar_075'},other.cookie)).status,404);
    assert.equal((await call(`/api/agents/${agentId}/avatar`,'PATCH',{avatarId:'bot_avatar_999'},owner.cookie)).status,400);
    assert.equal((await call(`/api/agents/${agentId}/avatar`,'PATCH',{avatarId:'bot_avatar_075'},owner.cookie)).status,200);
    const after=(await call('/api/state','GET',undefined,owner.cookie)).body;
    const afterAgent=after.agents.find(agent=>agent.id===agentId);
    assert.equal(afterAgent.avatar_id,'bot_avatar_075');
    for(const field of ['id','slug','name','role','instructions','accent','enabled','version'])assert.equal(afterAgent[field],beforeAgent[field],field);
    assert.deepEqual(after.schedules,before.schedules,'avatar change leaves the scheduled routine intact');
    assert.equal(after.tasks.find(task=>task.id===firstTask.body.taskId).status,'completed');
    const secondTask=await call(`/api/agents/${agentId}/research`,'POST',{objective:'Research public building methods'},owner.cookie);
    assert.equal(secondTask.status,201);
    await app.work();
    const final=(await call('/api/state','GET',undefined,owner.cookie)).body;
    const firstResult=final.tasks.find(task=>task.id===firstTask.body.taskId);
    const secondResult=final.tasks.find(task=>task.id===secondTask.body.taskId);
    assert.deepEqual({query:firstResult.query,plan:firstResult.plan,result:firstResult.result,status:firstResult.status},{query:secondResult.query,plan:secondResult.plan,result:secondResult.result,status:secondResult.status});
    assert.equal(final.agents.find(agent=>agent.id===second.body.agentId).avatar_id,'bot_avatar_001');
  }finally{await app.close();rmSync(dir,{recursive:true,force:true});}
});
