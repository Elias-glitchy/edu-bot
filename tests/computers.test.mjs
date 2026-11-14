import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import { createApp } from '../apps/api/server.mjs';
import { createFakeComputerProvider } from '../apps/api/computer-provider.mjs';

test('every bot owns an isolated computer record with lifecycle, lease, stream token and tenant boundaries',async()=>{
  const dir=mkdtempSync(join(tmpdir(),'build-bot-computers-')),provider=createFakeComputerProvider();
  const app=createApp({databasePath:join(dir,'app.sqlite'),computerProvider:provider});
  await new Promise(resolve=>app.server.listen(0,'127.0.0.1',resolve));
  const base=`http://127.0.0.1:${app.server.address().port}/api`;
  const call=async(path,method='GET',payload,cookie='')=>{const response=await fetch(base+path,{method,headers:{...(payload?{'content-type':'application/json'}:{}),...(cookie?{cookie}:{})},body:payload?JSON.stringify(payload):undefined});return {status:response.status,body:await response.json(),cookie:response.headers.get('set-cookie')?.split(';')[0]};};
  try{
    const first=await call('/auth/register','POST',{email:'computers-a@example.invalid',password:'secure-password-a',organization:'Computer A'}),second=await call('/auth/register','POST',{email:'computers-b@example.invalid',password:'secure-password-b',organization:'Computer B'});
    let state=(await call('/state','GET',undefined,first.cookie)).body;
    assert.equal(state.agents.length,11);assert.equal(state.computers.length,11);assert.equal(new Set(state.computers.map(item=>item.agent_id)).size,11);assert.ok(state.computers.every(item=>item.state==='unprovisioned'));
    const chief=state.agents.find(item=>item.slug==='chief'),computer=state.computers.find(item=>item.agent_id===chief.id);
    assert.equal((await call(`/computers/${computer.id}/start`,'POST',{},first.cookie)).status,409,'inactive bots cannot consume compute');
    assert.equal((await call(`/agents/${chief.id}/activate`,'POST',{},first.cookie)).status,200);
    const started=await call(`/computers/${computer.id}/start`,'POST',{},first.cookie);assert.equal(started.status,200);assert.equal(started.body.computer.state,'running');assert.match(started.body.computer.volume_ref,/home$/);assert.ok(started.body.computer.host_port);
    provider.records.get(computer.id).state='stopped';
    const reconciled=await call(`/computers/${computer.id}/start`,'POST',{},first.cookie);assert.equal(reconciled.status,200);assert.equal(reconciled.body.computer.state,'running');assert.notEqual(reconciled.body.computer.host_port,started.body.computer.host_port);assert.ok(app.db.prepare("SELECT 1 FROM computer_events WHERE computer_id=? AND event_type='computer.runtime_reconciled'").get(computer.id));
    assert.equal((await call(`/computers/${computer.id}/start`,'POST',{},second.cookie)).status,404,'another tenant cannot discover or start this computer');
    const readOnlyStream=await call(`/computers/${computer.id}/stream-token`,'GET',undefined,first.cookie);assert.equal(readOnlyStream.body.canControl,false);assert.match(readOnlyStream.body.viewUrl,/view_only=1/);
    const lease=await call(`/computers/${computer.id}/lease/acquire`,'POST',{sessionId:reconciled.body.session.id},first.cookie);assert.equal(lease.status,200);assert.ok(lease.body.token);assert.equal((await call(`/computers/${computer.id}/lease/acquire`,'POST',{},first.cookie)).status,409);assert.equal((await call(`/computers/${computer.id}/stop`,'POST',{},first.cookie)).status,409,'active lease prevents shutdown');
    const interactiveStream=await call(`/computers/${computer.id}/stream-token`,'GET',undefined,first.cookie);assert.equal(interactiveStream.body.canControl,true);assert.match(interactiveStream.body.viewUrl,/view_only=0/);
    const storedLease=app.db.prepare('SELECT token_hash FROM computer_leases WHERE id=?').get(lease.body.leaseId);assert.notEqual(storedLease.token_hash,lease.body.token);assert.equal(storedLease.token_hash,createHash('sha256').update(lease.body.token).digest('hex'));
    assert.equal((await call(`/computers/${computer.id}/lease/release`,'POST',{},first.cookie)).status,200);
    const stream=await call(`/computers/${computer.id}/stream-token`,'GET',undefined,first.cookie);assert.equal(stream.status,200);assert.equal(stream.body.canControl,false);assert.match(stream.body.viewUrl,new RegExp(`^/computer-stream/[^/]+/vnc\\.html`));assert.equal(app.db.prepare('SELECT 1 FROM computer_stream_tokens WHERE token_hash=?').get(stream.body.token),undefined,'raw stream tokens are never stored');
    assert.equal((await call(`/computers/${computer.id}/pause`,'POST',{},first.cookie)).body.computer.state,'paused');assert.equal((await call(`/computers/${computer.id}/resume`,'POST',{},first.cookie)).body.computer.state,'running');assert.equal((await call(`/computers/${computer.id}/stop`,'POST',{},first.cookie)).body.computer.state,'stopped');
    const reset=await call(`/computers/${computer.id}/reset`,'POST',{},first.cookie);assert.equal(reset.status,200);assert.equal(reset.body.computer.state,'stopped');assert.equal(reset.body.computer.volume_ref,started.body.computer.volume_ref,'runtime reset retains the bot home volume');
    state=(await call('/state','GET',undefined,first.cookie)).body;assert.ok(state.computerEvents.some(item=>item.event_type==='computer.started'));assert.ok(state.computerEvents.some(item=>item.event_type==='computer.lease_acquired'));assert.ok(state.computerEvents.some(item=>item.event_type==='computer.reset'));
  }finally{await app.close();rmSync(dir,{recursive:true,force:true});}
});
