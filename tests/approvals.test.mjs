import test from 'node:test';
import assert from 'node:assert/strict';
import { createApp } from '../apps/api/server.mjs';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

test('exact-action approval executes one local CRM note write and rejects stale or cross-tenant decisions', async()=>{
  const dir=mkdtempSync(join(tmpdir(),'build-bot-approval-'));
  const app=createApp({databasePath:join(dir,'app.sqlite'),fixtureResearch:true});
  await new Promise(resolve=>app.server.listen(0,'127.0.0.1',resolve));
  const base=`http://127.0.0.1:${app.server.address().port}/api`;
  const call=async(path,method='GET',payload,cookie='')=>{
    const response=await fetch(base+path,{method,headers:{...(payload?{'content-type':'application/json'}:{}),...(cookie?{cookie}:{})},body:payload?JSON.stringify(payload):undefined});
    return {status:response.status,body:await response.json(),cookie:response.headers.get('set-cookie')?.split(';')[0]};
  };
  try {
    const a=await call('/auth/register','POST',{email:'approval-a@example.com',password:'test-password-a',organization:'Approval Alpha'});
    const b=await call('/auth/register','POST',{email:'approval-b@example.com',password:'test-password-b',organization:'Approval Beta'});
    const contact=await call('/contacts','POST',{name:'Example customer'},a.cookie);
    assert.equal(contact.status,201);
    const first=await call(`/contacts/${contact.body.contactId}/propose-note`,'POST',{note:'Call next week.'},a.cookie);
    assert.equal(first.status,201);
    assert.equal((await call(`/approvals/${first.body.approvalId}/approve`,'POST',{actionHash:first.body.actionHash},b.cookie)).status,404);
    assert.equal((await call(`/approvals/${first.body.approvalId}/approve`,'POST',{actionHash:'0'.repeat(64)},a.cookie)).status,409);
    assert.equal((await call('/state','GET',undefined,a.cookie)).body.contacts[0].note,'');
    assert.equal((await call(`/approvals/${first.body.approvalId}/approve`,'POST',{actionHash:first.body.actionHash},a.cookie)).status,200);
    assert.equal((await call(`/approvals/${first.body.approvalId}/approve`,'POST',{actionHash:first.body.actionHash},a.cookie)).status,409);
    const approved=(await call('/state','GET',undefined,a.cookie)).body;
    assert.equal(approved.contacts[0].note,'Call next week.');
    assert.equal(approved.contacts[0].version,2);
    const second=await call(`/contacts/${contact.body.contactId}/propose-note`,'POST',{note:'Email next month.'},a.cookie);
    const third=await call(`/contacts/${contact.body.contactId}/propose-note`,'POST',{note:'Meet next month.'},a.cookie);
    assert.equal((await call(`/approvals/${second.body.approvalId}/approve`,'POST',{actionHash:second.body.actionHash},a.cookie)).status,409);
    assert.equal((await call(`/approvals/${third.body.approvalId}/reject`,'POST',{actionHash:third.body.actionHash},a.cookie)).body.status,'rejected');
    const finalState=(await call('/state','GET',undefined,a.cookie)).body;
    assert.equal(finalState.contacts[0].note,'Call next week.');
    assert.equal(finalState.approvalDecisions.length,2);
    assert.ok(finalState.events.some(e=>e.type==='action.executed'));
    assert.equal((await call('/state','GET',undefined,b.cookie)).body.contacts.length,0);
  } finally {
    await app.close();rmSync(dir,{recursive:true,force:true});
  }
});
