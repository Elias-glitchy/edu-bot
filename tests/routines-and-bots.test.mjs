import test from 'node:test';
import assert from 'node:assert/strict';
import { createApp } from '../apps/api/server.mjs';
import { createSchedule, nextRunAt, runDueSchedules } from '../apps/api/schedules.mjs';
import { id, now, openStore, seedAgents } from '../apps/api/store.mjs';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

test('weekday scheduling respects the organization time and DST transition',()=>{
  assert.equal(nextRunAt('2026-10-12T06:59:00.000Z','Africa/Johannesburg','09:00',[1]),'2026-10-12T07:00:00.000Z');
  assert.equal(nextRunAt('2026-10-12T07:00:00.000Z','Africa/Johannesburg','09:00',[1]),'2026-10-19T07:00:00.000Z');
  assert.equal(nextRunAt('2026-03-08T06:00:00.000Z','America/New_York','02:30',[0]),'2026-03-15T06:30:00.000Z');
});

test('routine blocks cleanly when its assigned custom bot is disabled',()=>{
  const db=openStore(':memory:');
  try {
    const org=id(),bot=id();
    db.prepare('INSERT INTO organizations(id,name,created_at) VALUES(?,?,?)').run(org,'Schedule test',now());
    seedAgents(db,org);
    db.prepare("INSERT INTO agents(id,organization_id,slug,name,role,accent,kind,instructions,enabled,version) VALUES(?,?,?,?,?,?,'custom','',1,1)").run(bot,org,`custom-${bot}`,'Monitor','Public research','#4F46E5');
    const schedule=createSchedule(db,org,'owner',{kind:'research',title:'Daily scan',agentId:bot,objective:'Research public procurement policy',localTime:'09:00',weekdays:[0,1,2,3,4,5,6]});
    db.prepare('UPDATE agents SET enabled=0 WHERE id=?').run(bot);
    db.prepare('UPDATE schedules SET next_run_at=? WHERE id=?').run('2026-01-01T00:00:00.000Z',schedule.scheduleId);
    assert.equal(runDueSchedules(db,'2026-01-02T00:00:00.000Z').length,0);
    assert.equal(db.prepare('SELECT status FROM schedule_runs WHERE schedule_id=?').get(schedule.scheduleId).status,'blocked');
    assert.equal(db.prepare('SELECT COUNT(*) AS n FROM tasks').get().n,0);
  } finally {db.close();}
});

test('all built-in managers accept bounded direct research; routines survive restart without duplicate runs',async()=>{
  const dir=mkdtempSync(join(tmpdir(),'build-bot-routines-')),databasePath=join(dir,'app.sqlite');
  let app=createApp({databasePath,fixtureResearch:true});
  const listen=async()=>new Promise(resolve=>app.server.listen(0,'127.0.0.1',resolve));
  await listen();
  let base=`http://127.0.0.1:${app.server.address().port}/api`;
  const call=async(path,method='GET',payload,cookie='')=>{
    const response=await fetch(base+path,{method,headers:{...(payload?{'content-type':'application/json'}:{}),...(cookie?{cookie}:{})},body:payload?JSON.stringify(payload):undefined});
    return {status:response.status,body:await response.json(),cookie:response.headers.get('set-cookie')?.split(';')[0]};
  };
  try {
    const a=await call('/auth/register','POST',{email:'routines-a@example.com',password:'long-password-a',organization:'Alpha'});
    const b=await call('/auth/register','POST',{email:'routines-b@example.com',password:'long-password-b',organization:'Beta'});
    const first=(await call('/state','GET',undefined,a.cookie)).body;
    const finance=first.agents.find(agent=>agent.slug==='finance-manager');
    assert.equal((await call(`/agents/${finance.id}/activate`,'POST',{},a.cookie)).status,200);
    const direct=await call(`/agents/${finance.id}/research`,'POST',{objective:'Research public finance reporting guidance'},a.cookie);
    assert.equal(direct.status,201,JSON.stringify(direct.body));
    await app.work();
    const afterDirect=(await call('/state','GET',undefined,a.cookie)).body;
    assert.equal(afterDirect.directConversations.length,1);
    assert.equal(afterDirect.tasks[0].agent_id,finance.id);
    assert.equal(afterDirect.groupMessages.filter(m=>m.conversation_id===direct.body.conversationId).length,3);
    assert.ok(afterDirect.groupMessages.some(m=>m.sender==='finance-manager'));
    assert.equal((await call(`/agents/${finance.id}/research`,'POST',{objective:'Research public guidance'},b.cookie)).status,404);
    const research=await call('/schedules','POST',{kind:'research',title:'Daily research',agentId:finance.id,objective:'Research circular building methods',localTime:'09:00',weekdays:[0,1,2,3,4,5,6]},a.cookie);
    const report=await call('/schedules','POST',{kind:'report',title:'Daily work report',reportType:'daily',localTime:'09:00',weekdays:[0,1,2,3,4,5,6]},a.cookie);
    assert.equal(research.status,201,JSON.stringify(research.body));
    assert.equal(report.status,201,JSON.stringify(report.body));
    assert.equal((await call('/schedules','POST',{kind:'research',title:'Wrong workspace',agentId:finance.id,objective:'Research circular building methods',localTime:'09:00',weekdays:[1]},b.cookie)).status,400);
    assert.equal((await call(`/schedules/${research.body.scheduleId}/disable`,'POST',{},b.cookie)).status,404);
    app.db.prepare('UPDATE schedules SET next_run_at=? WHERE id IN (?,?)').run('2026-10-12T07:00:00.000Z',research.body.scheduleId,report.body.scheduleId);
    assert.equal(app.runSchedules('2026-10-13T07:00:00.000Z').length,1);
    await app.work();
    let after=(await call('/state','GET',undefined,a.cookie)).body;
    assert.equal(after.scheduleRuns.length,2);
    assert.equal(after.scheduleRuns.find(r=>r.schedule_id===research.body.scheduleId).status,'completed');
    assert.equal(after.schedules.find(s=>s.id===research.body.scheduleId).agent_id,finance.id);
    assert.equal(after.tasks.find(t=>t.id===after.scheduleRuns.find(r=>r.schedule_id===research.body.scheduleId).task_id).agent_id,finance.id);
    assert.equal(after.notifications.length,3);
    assert.equal(after.reports.length,1);
    assert.equal(app.runSchedules('2026-10-13T07:00:00.000Z').length,0);
    const read=await call(`/notifications/${after.notifications[0].id}/read`,'POST',{},a.cookie);
    assert.equal(read.status,200);
    assert.equal((await call(`/notifications/${after.notifications[1].id}/read`,'POST',{},b.cookie)).status,404);
    assert.equal((await call('/state','GET',undefined,b.cookie)).body.scheduleRuns.length,0);
    await app.close();
    app=createApp({databasePath,fixtureResearch:true});
    await listen();base=`http://127.0.0.1:${app.server.address().port}/api`;
    after=(await call('/state','GET',undefined,a.cookie)).body;
    // Restart recovery may legitimately claim a later day; the original occurrence must not duplicate.
    assert.equal(after.scheduleRuns.filter(r=>r.scheduled_for==='2026-10-12T07:00:00.000Z').length,2);
    assert.equal(app.runSchedules('2026-10-13T07:00:00.000Z').length,0);
  } finally {
    await app.close();rmSync(dir,{recursive:true,force:true});
  }
});
