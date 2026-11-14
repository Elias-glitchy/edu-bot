import { createHash } from 'node:crypto';
import { enqueueJob } from './durable-jobs.mjs';
import { id, now } from './store.mjs';

const requestHash=requests=>createHash('sha256').update(JSON.stringify(requests)).digest('hex');
const terminal=new Set(['BATCH_STATE_SUCCEEDED','BATCH_STATE_FAILED','BATCH_STATE_CANCELLED','BATCH_STATE_EXPIRED']);

export function queueGeminiBatch(db,{organizationId,displayName,requests,model='gemini-3.1-flash-lite',budgetUnits=0}){
  if(!Array.isArray(requests)||!requests.length||requests.length>100)throw new Error('A batch must contain between 1 and 100 requests.');
  const normalized=requests.map((request,index)=>({request:{contents:[{role:'user',parts:[{text:String(request?.text||'').trim()}]}]},metadata:{key:String(request?.key||`request-${index+1}`)}}));
  if(normalized.some(item=>!item.request.contents[0].parts[0].text||item.request.contents[0].parts[0].text.length>100_000))throw new Error('Each batch prompt must contain between 1 and 100,000 characters.');
  const digest=requestHash(normalized),existing=db.prepare('SELECT * FROM gemini_batch_jobs WHERE organization_id=? AND request_hash=?').get(organizationId,digest);if(existing)return existing;
  const durable=enqueueJob(db,{organizationId,kind:'gemini_batch_submit',idempotencyKey:digest,payload:{model,displayName,requests:normalized},maxAttempts:5,budgetUnits}),batchId=id(),timestamp=now();
  db.prepare("INSERT INTO gemini_batch_jobs(id,organization_id,durable_job_id,model,display_name,request_count,request_hash,status,created_at,updated_at) VALUES(?,?,?,?,?,?,?,'awaiting_credentials',?,?)").run(batchId,organizationId,durable.id,model,String(displayName||'BUILD BOT batch').slice(0,120),normalized.length,digest,timestamp,timestamp);
  return db.prepare('SELECT * FROM gemini_batch_jobs WHERE id=?').get(batchId);
}

export async function submitGeminiBatch(db,{batchId,organizationId,apiKey,fetchImpl=fetch}){
  if(!apiKey)throw new Error('Gemini Batch is waiting for GEMINI_API_KEY.');
  const batch=db.prepare('SELECT * FROM gemini_batch_jobs WHERE id=? AND organization_id=?').get(batchId,organizationId);if(!batch)throw new Error('Batch job not found.');if(batch.provider_ref)return batch;
  const durable=db.prepare('SELECT * FROM durable_jobs WHERE id=? AND organization_id=?').get(batch.durable_job_id,organizationId),payload=JSON.parse(durable.payload);
  const endpoint=`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(batch.model)}:batchGenerateContent`;
  const response=await fetchImpl(endpoint,{method:'POST',headers:{'Content-Type':'application/json','x-goog-api-key':apiKey},body:JSON.stringify({batch:{display_name:batch.display_name,input_config:{requests:{requests:payload.requests}}}}),signal:AbortSignal.timeout(120000)});
  if(!response.ok)throw new Error(`Gemini Batch submission failed (${response.status}).`);
  const result=await response.json(),providerRef=result.name||result.batch?.name;if(!providerRef)throw new Error('Gemini Batch did not return a job name.');
  db.prepare("UPDATE gemini_batch_jobs SET provider_ref=?,status='submitted',result=?,error=NULL,updated_at=? WHERE id=? AND organization_id=?").run(providerRef,JSON.stringify(result),now(),batch.id,organizationId);return db.prepare('SELECT * FROM gemini_batch_jobs WHERE id=?').get(batch.id);
}

export async function refreshGeminiBatch(db,{batchId,organizationId,apiKey,fetchImpl=fetch}){
  if(!apiKey)throw new Error('Gemini Batch is waiting for GEMINI_API_KEY.');const batch=db.prepare('SELECT * FROM gemini_batch_jobs WHERE id=? AND organization_id=?').get(batchId,organizationId);if(!batch?.provider_ref)throw new Error('Submitted batch job not found.');
  const response=await fetchImpl(`https://generativelanguage.googleapis.com/v1beta/${batch.provider_ref}`,{headers:{'x-goog-api-key':apiKey},signal:AbortSignal.timeout(60_000)});if(!response.ok)throw new Error(`Gemini Batch status failed (${response.status}).`);
  const result=await response.json(),state=result.state||result.metadata?.state||'BATCH_STATE_PENDING',status=terminal.has(state)?state.replace('BATCH_STATE_','').toLowerCase():'running';db.prepare('UPDATE gemini_batch_jobs SET status=?,result=?,error=?,updated_at=? WHERE id=? AND organization_id=?').run(status,JSON.stringify(result),state==='BATCH_STATE_FAILED'?JSON.stringify(result.error||'Batch failed.'):null,now(),batch.id,organizationId);return db.prepare('SELECT * FROM gemini_batch_jobs WHERE id=?').get(batch.id);
}
