import { createHash, randomBytes } from 'node:crypto';
import { id, now } from './store.mjs';

const hash=value=>createHash('sha256').update(value).digest('hex');

export function enqueueJob(db,{organizationId,kind,idempotencyKey,payload={},maxAttempts=3,budgetUnits=0}){
  if(!organizationId||!kind||!idempotencyKey)throw new Error('Organization, job kind and idempotency key are required.');
  const jobId=id(),timestamp=now();
  db.prepare(`INSERT OR IGNORE INTO durable_jobs(id,organization_id,kind,idempotency_key,payload,status,attempt,max_attempts,budget_units,consumed_units,next_attempt_at,created_at,updated_at)
    VALUES(?,?,?,?,?,'queued',0,?,?,0,?,?,?)`).run(jobId,organizationId,String(kind).slice(0,80),String(idempotencyKey).slice(0,200),JSON.stringify(payload),Math.max(1,Math.min(Number(maxAttempts)||3,10)),Math.max(0,Number(budgetUnits)||0),timestamp,timestamp,timestamp);
  return db.prepare('SELECT * FROM durable_jobs WHERE organization_id=? AND kind=? AND idempotency_key=?').get(organizationId,kind,idempotencyKey);
}

export function claimNextJob(db,{kinds,leaseMs=60_000}={}){
  const timestamp=now(),allowed=Array.isArray(kinds)&&kinds.length?kinds:null,placeholders=allowed?.map(()=>'?').join(',');
  const query=`SELECT * FROM durable_jobs WHERE status IN ('queued','retrying') AND next_attempt_at<=? AND (lease_expires_at IS NULL OR lease_expires_at<=?) ${allowed?`AND kind IN (${placeholders})`:''} ORDER BY created_at LIMIT 1`;
  const job=db.prepare(query).get(timestamp,timestamp,...(allowed||[]));if(!job)return null;
  const token=randomBytes(32).toString('base64url'),expiresAt=new Date(Date.now()+Math.max(10_000,Math.min(Number(leaseMs)||60_000,15*60_000))).toISOString();
  const result=db.prepare("UPDATE durable_jobs SET status='running',attempt=attempt+1,lease_token_hash=?,lease_expires_at=?,updated_at=? WHERE id=? AND status IN ('queued','retrying') AND (lease_expires_at IS NULL OR lease_expires_at<=?)").run(hash(token),expiresAt,timestamp,job.id,timestamp);
  return result.changes?{job:db.prepare('SELECT * FROM durable_jobs WHERE id=?').get(job.id),leaseToken:token}:null;
}

function leasedJob(db,jobId,leaseToken){const job=db.prepare('SELECT * FROM durable_jobs WHERE id=?').get(jobId);if(!job||job.status!=='running'||job.lease_token_hash!==hash(leaseToken))throw new Error('Active job lease not found.');return job;}

export function completeJob(db,{jobId,leaseToken,consumedUnits=0}){
  const job=leasedJob(db,jobId,leaseToken),consumed=job.consumed_units+Math.max(0,Number(consumedUnits)||0);
  if(job.budget_units&&consumed>job.budget_units)throw new Error('Job budget exceeded.');
  db.prepare("UPDATE durable_jobs SET status='completed',consumed_units=?,lease_token_hash=NULL,lease_expires_at=NULL,updated_at=? WHERE id=?").run(consumed,now(),job.id);return db.prepare('SELECT * FROM durable_jobs WHERE id=?').get(job.id);
}

export function failJob(db,{jobId,leaseToken,error,transient=true,retryDelayMs=1000,consumedUnits=0}){
  const job=leasedJob(db,jobId,leaseToken),consumed=job.consumed_units+Math.max(0,Number(consumedUnits)||0),canRetry=transient&&job.attempt<job.max_attempts&&(!job.budget_units||consumed<=job.budget_units),status=canRetry?'retrying':'failed',nextAttemptAt=canRetry?new Date(Date.now()+Math.max(100,Math.min(Number(retryDelayMs)||1000,24*60*60_000))).toISOString():now();
  db.prepare('UPDATE durable_jobs SET status=?,consumed_units=?,lease_token_hash=NULL,lease_expires_at=NULL,next_attempt_at=?,last_error=?,updated_at=? WHERE id=?').run(status,consumed,nextAttemptAt,String(error||'Job failed.').slice(0,1000),now(),job.id);return db.prepare('SELECT * FROM durable_jobs WHERE id=?').get(job.id);
}

export function cancelJob(db,{organizationId,jobId}){const result=db.prepare("UPDATE durable_jobs SET status='cancelled',lease_token_hash=NULL,lease_expires_at=NULL,updated_at=? WHERE id=? AND organization_id=? AND status IN ('queued','retrying','running')").run(now(),jobId,organizationId);return Boolean(result.changes);}
