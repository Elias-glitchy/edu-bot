import { createHash, randomUUID } from 'node:crypto';

const now=()=>new Date().toISOString();
const hash=value=>createHash('sha256').update(String(value)).digest('hex');
const scopes=new Set(['organization','user','course','bot','mission']);
const statuses=new Set(['pending','active','rejected','expired','deleted']);
const clean=value=>String(value||'').trim();
const looksLikeCredential=value=>/(-----BEGIN [A-Z ]*PRIVATE KEY-----|\b(?:sk|AIza|ghp|xox[baprs])[-_A-Za-z0-9]{12,}|\b(?:password|passwd|api[_ -]?key|access[_ -]?token|client[_ -]?secret)\s*[:=]\s*\S+)/i.test(value);

export function createMemory(db,{organizationId,scopeType,scopeId,memoryType='preference',content,sourceType='user_statement',sourceId=null,sourceExcerpt=null,confidence=1,sensitivity='internal',status='pending',createdBy}){
  if(!scopes.has(scopeType)||!clean(scopeId))throw new Error('A valid memory scope is required.');
  const text=clean(content);if(text.length<3||text.length>8000)throw new Error('Memory content must be between 3 and 8000 characters.');if(!statuses.has(status))throw new Error('Invalid memory status.');
  if(looksLikeCredential(text)||looksLikeCredential(sourceExcerpt||''))throw new Error('Credential-like content cannot be stored as memory. Use the credential broker instead.');
  const record={id:randomUUID(),organization_id:organizationId,scope_type:scopeType,scope_id:clean(scopeId),memory_type:clean(memoryType)||'preference',content:text,content_hash:hash(text),source_type:clean(sourceType)||'user_statement',source_id:sourceId||null,source_excerpt:sourceExcerpt?clean(sourceExcerpt).slice(0,1000):null,confidence:Number.isFinite(Number(confidence))?Math.max(0,Math.min(1,Number(confidence))):null,sensitivity, status,revision:1,parent_memory_id:null,approved_by:status==='active'?createdBy:null,valid_from:status==='active'?now():null,expires_at:null,last_used_at:null,created_by:createdBy,created_at:now(),updated_at:now()};
  db.prepare('INSERT INTO memories(id,organization_id,scope_type,scope_id,memory_type,content,content_hash,source_type,source_id,source_excerpt,confidence,sensitivity,status,revision,parent_memory_id,approved_by,valid_from,expires_at,last_used_at,created_by,created_at,updated_at) VALUES(@id,@organization_id,@scope_type,@scope_id,@memory_type,@content,@content_hash,@source_type,@source_id,@source_excerpt,@confidence,@sensitivity,@status,@revision,@parent_memory_id,@approved_by,@valid_from,@expires_at,@last_used_at,@created_by,@created_at,@updated_at)').run(record);return record;
}

export function listMemories(db,{organizationId,scopeType,scopeId,query='',status}){
  const params=[organizationId],where=['organization_id=?'];if(scopeType){where.push('scope_type=?');params.push(scopeType);}if(scopeId){where.push('scope_id=?');params.push(scopeId);}if(status){where.push('status=?');params.push(status);}if(query){where.push('(lower(content) LIKE ? OR lower(memory_type) LIKE ?)');params.push(`%${query.toLowerCase()}%`,`%${query.toLowerCase()}%`);}
  return db.prepare(`SELECT * FROM memories WHERE ${where.join(' AND ')} ORDER BY updated_at DESC LIMIT 200`).all(...params);
}

export function getMemory(db,{organizationId,memoryId}){return db.prepare('SELECT * FROM memories WHERE id=? AND organization_id=?').get(memoryId,organizationId)||null;}

export function reviseMemory(db,{organizationId,memoryId,content,memoryType,expiresAt,createdBy}){
  const prior=getMemory(db,{organizationId,memoryId});if(!prior||prior.status==='deleted')throw new Error('Memory not found.');
  const text=clean(content??prior.content);if(text.length<3||text.length>8000)throw new Error('Memory content must be between 3 and 8000 characters.');
  if(looksLikeCredential(text))throw new Error('Credential-like content cannot be stored as memory.');
  const revised={...prior,id:randomUUID(),content:text,content_hash:hash(text),memory_type:clean(memoryType??prior.memory_type),status:'pending',revision:prior.revision+1,parent_memory_id:prior.id,approved_by:null,valid_from:null,expires_at:expiresAt??prior.expires_at,last_used_at:null,created_by:createdBy,created_at:now(),updated_at:now()};
  db.prepare('INSERT INTO memories(id,organization_id,scope_type,scope_id,memory_type,content,content_hash,source_type,source_id,source_excerpt,confidence,sensitivity,status,revision,parent_memory_id,approved_by,valid_from,expires_at,last_used_at,created_by,created_at,updated_at) VALUES(@id,@organization_id,@scope_type,@scope_id,@memory_type,@content,@content_hash,@source_type,@source_id,@source_excerpt,@confidence,@sensitivity,@status,@revision,@parent_memory_id,@approved_by,@valid_from,@expires_at,@last_used_at,@created_by,@created_at,@updated_at)').run(revised);return revised;
}

export function decideMemory(db,{organizationId,memoryId,decision,actor}){const memory=getMemory(db,{organizationId,memoryId});if(!memory||memory.status!=='pending')throw new Error('Memory is not awaiting review.');const status=decision==='approve'?'active':'rejected';db.prepare('UPDATE memories SET status=?,approved_by=?,valid_from=?,updated_at=? WHERE id=? AND organization_id=?').run(status,status==='active'?actor:null,status==='active'?now():null,now(),memoryId,organizationId);return getMemory(db,{organizationId,memoryId});}
export function deleteMemory(db,{organizationId,memoryId}){const result=db.prepare("UPDATE memories SET status='deleted',content='[deleted]',source_excerpt=NULL,updated_at=? WHERE id=? AND organization_id=? AND status!='deleted'").run(now(),memoryId,organizationId);return result.changes>0;}

export function searchMemories(db,{organizationId,query,scopes:requestedScopes=[],limit=20}){
  const terms=[...new Set(clean(query).toLowerCase().split(/[^\p{L}\p{N}]+/u).filter(term=>term.length>1))];if(!terms.length)return [];
  let rows=db.prepare("SELECT * FROM memories WHERE organization_id=? AND status='active' AND (expires_at IS NULL OR expires_at>?) ORDER BY updated_at DESC LIMIT 500").all(organizationId,now());
  if(requestedScopes.length){const keys=new Set(requestedScopes.map(scope=>`${scope.type}:${scope.id}`));rows=rows.filter(row=>keys.has(`${row.scope_type}:${row.scope_id}`));}
  return rows.map(row=>{const haystack=`${row.memory_type} ${row.content} ${row.source_excerpt||''}`.toLowerCase(),matched=terms.filter(term=>haystack.includes(term));return {...row,score:matched.length/terms.length,whyMatched:matched.length?`Matched: ${matched.join(', ')}`:'No keyword match',source:{type:row.source_type,id:row.source_id,excerpt:row.source_excerpt}};}).filter(row=>row.score>0).sort((a,b)=>b.score-a.score||b.updated_at.localeCompare(a.updated_at)).slice(0,Math.min(100,limit));
}

export function purgeMemoryScope(db,{organizationId,scopeType,scopeId}){if(!scopes.has(scopeType)||!scopeId)throw new Error('A valid scope is required.');return db.prepare("UPDATE memories SET status='deleted',content='[deleted]',source_excerpt=NULL,updated_at=? WHERE organization_id=? AND scope_type=? AND scope_id=? AND status!='deleted'").run(now(),organizationId,scopeType,scopeId).changes;}
