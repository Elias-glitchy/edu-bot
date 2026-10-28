import { createHash, timingSafeEqual } from 'node:crypto';
import { id, now, event } from './store.mjs';

export class ActionError extends Error {
  constructor(status,message){super(message);this.status=status;}
}

export function canonicalAction(payload) {
  return JSON.stringify({
    tool:'local-crm',operation:'contact.note.replace',account:'organization-local',
    contactId:payload.contactId,expectedVersion:payload.expectedVersion,
    before:payload.before,after:payload.after,
    expiresAt:payload.expiresAt,policyVersion:payload.policyVersion
  });
}
export const actionHash=payload=>createHash('sha256').update(canonicalAction(payload)).digest('hex');

export function proposeNote(db,org,contactId,note,actor) {
  const after=String(note||'').trim();
  if(!after||after.length>2000) throw new ActionError(400,'Note must be 1–2,000 characters.');
  const contact=db.prepare('SELECT * FROM contacts WHERE id=? AND organization_id=?').get(contactId,org);
  if(!contact) throw new ActionError(404,'Contact not found.');
  if(contact.note===after) throw new ActionError(409,'The proposed note matches the current note.');
  const expiresAt=new Date(Date.now()+24*60*60*1000).toISOString();
  const payload={contactId,expectedVersion:contact.version,before:contact.note,after,expiresAt,policyVersion:1};
  const approval={id:id(),organization_id:org,contact_id:contactId,action_hash:actionHash(payload),payload,status:'pending',policy_version:1,created_at:now(),expires_at:expiresAt};
  db.exec('BEGIN');
  try {
    const replaced=db.prepare("SELECT id FROM approval_requests WHERE organization_id=? AND contact_id=? AND status='pending'").all(org,contactId);
    db.prepare("UPDATE approval_requests SET status='superseded' WHERE organization_id=? AND contact_id=? AND status='pending'").run(org,contactId);
    for(const row of replaced) event(db,org,null,'policy','approval.superseded',`Approval ${row.id} superseded by a changed proposal.`);
    db.prepare('INSERT INTO approval_requests(id,organization_id,contact_id,action_hash,payload,policy_version,status,created_at,expires_at) VALUES(?,?,?,?,?,?,?,?,?)')
      .run(approval.id,org,contactId,approval.action_hash,JSON.stringify(payload),1,'pending',approval.created_at,expiresAt);
    event(db,org,null,actor,'approval.requested',`Exact note update proposed for contact ${contactId}; approval ${approval.id}.`);
    db.exec('COMMIT');
  } catch(err) {db.exec('ROLLBACK');throw err;}
  return approval;
}

export function decideApproval(db,org,approvalId,decision,providedHash,actor) {
  if(!['approve','reject'].includes(decision)) throw new ActionError(400,'Invalid decision.');
  const approval=db.prepare('SELECT * FROM approval_requests WHERE id=? AND organization_id=?').get(approvalId,org);
  if(!approval) throw new ActionError(404,'Approval not found.');
  if(approval.status!=='pending') throw new ActionError(409,`Approval is ${approval.status}.`);
  const expected=Buffer.from(approval.action_hash,'hex'),received=Buffer.from(String(providedHash||''),'hex');
  if(expected.length!==received.length||!timingSafeEqual(expected,received)) {
    event(db,org,null,actor,'action.denied',`Approval ${approvalId} rejected because the action hash did not match.`);
    throw new ActionError(409,'Proposal changed. Review the current exact action.');
  }
  const payload=JSON.parse(approval.payload);
  if(actionHash(payload)!==approval.action_hash||payload.expiresAt!==approval.expires_at||payload.policyVersion!==approval.policy_version) throw new ActionError(409,'Stored proposal integrity check failed.');
  if(approval.expires_at<=now()) {
    db.prepare("UPDATE approval_requests SET status='expired' WHERE id=? AND organization_id=?").run(approvalId,org);
    event(db,org,null,'policy','approval.expired',`Approval ${approvalId} expired.`);
    throw new ActionError(409,'Approval expired. Request a new proposal.');
  }
  const contact=db.prepare('SELECT * FROM contacts WHERE id=? AND organization_id=?').get(payload.contactId,org);
  if(!contact||contact.version!==payload.expectedVersion||contact.note!==payload.before) {
    db.prepare("UPDATE approval_requests SET status='superseded' WHERE id=? AND organization_id=?").run(approvalId,org);
    event(db,org,null,'policy','approval.superseded',`Approval ${approvalId} no longer matches the contact.`);
    throw new ActionError(409,'Contact changed. Request a new proposal.');
  }
  db.exec('BEGIN');
  try {
    if(decision==='approve') {
      const changed=db.prepare('UPDATE contacts SET note=?,version=version+1,updated_at=? WHERE id=? AND organization_id=? AND version=?')
        .run(payload.after,now(),payload.contactId,org,payload.expectedVersion);
      if(changed.changes!==1) throw new ActionError(409,'Contact changed during approval.');
      db.prepare("UPDATE approval_requests SET status='executed',executed_at=? WHERE id=? AND organization_id=? AND status='pending'").run(now(),approvalId,org);
      event(db,org,null,actor,'action.executed',`Exact approved note update executed once for contact ${payload.contactId}.`);
    } else {
      db.prepare("UPDATE approval_requests SET status='rejected' WHERE id=? AND organization_id=? AND status='pending'").run(approvalId,org);
      event(db,org,null,actor,'action.denied',`Note update for contact ${payload.contactId} rejected.`);
    }
    db.prepare('INSERT INTO approval_decisions VALUES(?,?,?,?,?,?)').run(id(),org,approvalId,decision,actor,now());
    event(db,org,null,actor,'approval.decided',`Approval ${approvalId} ${decision==='approve'?'approved':'rejected'}.`);
    db.exec('COMMIT');
  } catch(err) {db.exec('ROLLBACK');throw err;}
  return {status:decision==='approve'?'executed':'rejected'};
}
