import { createHash, randomUUID } from 'node:crypto';

export const BUILT_IN_SKILLS=Object.freeze([
  ['create_lesson_plan','Create lesson plan'],['build_lecture_slides','Build lecture slides'],
  ['generate_assessment_memorandum','Generate assessment and memorandum'],['analyze_gradebook','Analyse a class gradebook'],
  ['moderate_assessment','Moderate an assessment'],['rubric_to_marking_matrix','Convert rubric to marking matrix'],
  ['student_feedback_letters','Produce student feedback letters'],['attendance_risk_report','Generate attendance and risk report'],
  ['course_pdf_bundle','Package course PDF submission bundle'],['lms_import_export','Import and export LMS materials'],
  ['compare_policy_versions','Compare policy versions'],['cited_academic_research_brief','Create cited academic research brief']
]);

const timestamp=()=>new Date().toISOString();
const hash=value=>createHash('sha256').update(JSON.stringify(value)).digest('hex');

export function ensureExpansionSchema(db){
  db.exec(`
    CREATE TABLE IF NOT EXISTS mcp_tool_catalog (id TEXT PRIMARY KEY, organization_id TEXT NOT NULL, connection_id TEXT NOT NULL, tool_name TEXT NOT NULL, description TEXT NOT NULL DEFAULT '', input_schema TEXT NOT NULL, annotations TEXT NOT NULL DEFAULT '{}', schema_hash TEXT NOT NULL, risk_class TEXT NOT NULL, status TEXT NOT NULL, catalog_version INTEGER NOT NULL, created_at TEXT NOT NULL, updated_at TEXT NOT NULL, UNIQUE(organization_id,connection_id,tool_name,catalog_version));
    CREATE TABLE IF NOT EXISTS tool_policy_grants (id TEXT PRIMARY KEY, organization_id TEXT NOT NULL, subject_type TEXT NOT NULL, subject_id TEXT NOT NULL, connection_id TEXT, tool_name TEXT NOT NULL, permission TEXT NOT NULL, constraints TEXT NOT NULL DEFAULT '{}', policy_version INTEGER NOT NULL, created_by TEXT NOT NULL, created_at TEXT NOT NULL, revoked_at TEXT);
    CREATE TABLE IF NOT EXISTS tool_execution_requests (id TEXT PRIMARY KEY, organization_id TEXT NOT NULL, mission_id TEXT, run_id TEXT, bot_id TEXT NOT NULL, user_id TEXT, connection_id TEXT NOT NULL, catalog_tool_id TEXT NOT NULL, risk_class TEXT NOT NULL, normalized_arguments TEXT NOT NULL, arguments_hash TEXT NOT NULL, destination_summary TEXT, reason TEXT NOT NULL, status TEXT NOT NULL, policy_version INTEGER NOT NULL, idempotency_key TEXT NOT NULL, approval_id TEXT, expires_at TEXT, created_at TEXT NOT NULL, updated_at TEXT NOT NULL, UNIQUE(organization_id,idempotency_key));
    CREATE TABLE IF NOT EXISTS tool_execution_receipts (id TEXT PRIMARY KEY, organization_id TEXT NOT NULL, request_id TEXT NOT NULL, attempt INTEGER NOT NULL, status TEXT NOT NULL, policy_decision TEXT NOT NULL, sanitized_result TEXT, result_hash TEXT, external_request_id TEXT, before_evidence TEXT NOT NULL DEFAULT '[]', after_evidence TEXT NOT NULL DEFAULT '[]', rollback_metadata TEXT, usage TEXT NOT NULL DEFAULT '{}', error TEXT, started_at TEXT NOT NULL, finished_at TEXT, UNIQUE(request_id,attempt));
    CREATE TABLE IF NOT EXISTS connector_budgets (id TEXT PRIMARY KEY, organization_id TEXT NOT NULL, connection_id TEXT, bot_id TEXT, mission_id TEXT, period TEXT NOT NULL, limits TEXT NOT NULL, consumed TEXT NOT NULL DEFAULT '{}', resets_at TEXT NOT NULL, updated_at TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS oauth_flows (id TEXT PRIMARY KEY, organization_id TEXT NOT NULL, connection_id TEXT NOT NULL, user_id TEXT NOT NULL, state_hash TEXT NOT NULL UNIQUE, pkce_verifier_ref TEXT, redirect_uri TEXT NOT NULL, status TEXT NOT NULL, expires_at TEXT NOT NULL, completed_at TEXT, created_at TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS oauth_states (id TEXT PRIMARY KEY, organization_id TEXT NOT NULL, connection_id TEXT NOT NULL, user_id TEXT NOT NULL, provider TEXT NOT NULL, state_hash TEXT NOT NULL UNIQUE, pkce_verifier_encrypted TEXT NOT NULL, redirect_uri TEXT NOT NULL, status TEXT NOT NULL, expires_at TEXT NOT NULL, consumed_at TEXT, created_at TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS connection_credentials (id TEXT PRIMARY KEY, organization_id TEXT NOT NULL, connection_id TEXT NOT NULL, credential_type TEXT NOT NULL, ciphertext TEXT NOT NULL, iv TEXT NOT NULL, auth_tag TEXT NOT NULL, key_version TEXT NOT NULL, scope_set TEXT NOT NULL DEFAULT '[]', access_expires_at TEXT, created_at TEXT NOT NULL, updated_at TEXT NOT NULL, UNIQUE(organization_id,connection_id,credential_type));
    CREATE TABLE IF NOT EXISTS memories (id TEXT PRIMARY KEY, organization_id TEXT NOT NULL, scope_type TEXT NOT NULL, scope_id TEXT NOT NULL, memory_type TEXT NOT NULL, content TEXT NOT NULL, content_hash TEXT NOT NULL, source_type TEXT NOT NULL, source_id TEXT, source_excerpt TEXT, confidence REAL, sensitivity TEXT NOT NULL DEFAULT 'internal', status TEXT NOT NULL, revision INTEGER NOT NULL DEFAULT 1, parent_memory_id TEXT, approved_by TEXT, valid_from TEXT, expires_at TEXT, last_used_at TEXT, created_by TEXT NOT NULL, created_at TEXT NOT NULL, updated_at TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS skills (id TEXT PRIMARY KEY, organization_id TEXT NOT NULL, skill_key TEXT NOT NULL, display_name TEXT NOT NULL, visibility TEXT NOT NULL, protected INTEGER NOT NULL DEFAULT 0, created_by TEXT NOT NULL, created_at TEXT NOT NULL, UNIQUE(organization_id,skill_key));
    CREATE TABLE IF NOT EXISTS skill_versions (id TEXT PRIMARY KEY, organization_id TEXT NOT NULL, skill_id TEXT NOT NULL, version INTEGER NOT NULL, status TEXT NOT NULL, manifest TEXT NOT NULL, manifest_hash TEXT NOT NULL, approved_by TEXT, created_by TEXT NOT NULL, created_at TEXT NOT NULL, UNIQUE(skill_id,version));
    CREATE TABLE IF NOT EXISTS skill_assignments (id TEXT PRIMARY KEY, organization_id TEXT NOT NULL, skill_version_id TEXT NOT NULL, target_type TEXT NOT NULL, target_id TEXT NOT NULL, enabled INTEGER NOT NULL DEFAULT 1, assigned_by TEXT NOT NULL, created_at TEXT NOT NULL, UNIQUE(skill_version_id,target_type,target_id));
    CREATE TABLE IF NOT EXISTS skill_test_runs (id TEXT PRIMARY KEY, organization_id TEXT NOT NULL, skill_version_id TEXT NOT NULL, fixture_hash TEXT NOT NULL, status TEXT NOT NULL, assertions TEXT NOT NULL, result TEXT, error TEXT, created_by TEXT NOT NULL, started_at TEXT NOT NULL, finished_at TEXT);
    CREATE TABLE IF NOT EXISTS skill_recordings (id TEXT PRIMARY KEY, organization_id TEXT NOT NULL, user_id TEXT NOT NULL, name TEXT NOT NULL, status TEXT NOT NULL, events TEXT NOT NULL DEFAULT '[]', started_at TEXT NOT NULL, stopped_at TEXT);
    CREATE TABLE IF NOT EXISTS document_collections (id TEXT PRIMARY KEY, organization_id TEXT NOT NULL, name TEXT NOT NULL, description TEXT NOT NULL DEFAULT '', owner_id TEXT NOT NULL, scope_type TEXT NOT NULL, scope_id TEXT, sensitivity TEXT NOT NULL DEFAULT 'internal', retention_policy TEXT NOT NULL DEFAULT '{}', created_at TEXT NOT NULL, updated_at TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS collection_acl (id TEXT PRIMARY KEY, organization_id TEXT NOT NULL, collection_id TEXT NOT NULL, subject_type TEXT NOT NULL, subject_id TEXT NOT NULL, permission TEXT NOT NULL, created_at TEXT NOT NULL, UNIQUE(collection_id,subject_type,subject_id));
    CREATE TABLE IF NOT EXISTS collection_documents (id TEXT PRIMARY KEY, organization_id TEXT NOT NULL, collection_id TEXT NOT NULL, logical_key TEXT NOT NULL, version INTEGER NOT NULL, original_name TEXT NOT NULL, mime_type TEXT NOT NULL, storage_key TEXT NOT NULL, sha256 TEXT NOT NULL, size_bytes INTEGER NOT NULL, status TEXT NOT NULL, extraction_metadata TEXT NOT NULL DEFAULT '{}', extracted_text TEXT NOT NULL DEFAULT '', uploaded_by TEXT NOT NULL, created_at TEXT NOT NULL, UNIQUE(collection_id,logical_key,version));
    CREATE TABLE IF NOT EXISTS document_chunks (id TEXT PRIMARY KEY, organization_id TEXT NOT NULL, document_id TEXT NOT NULL, ordinal INTEGER NOT NULL, page_start INTEGER, page_end INTEGER, section_path TEXT, region TEXT, content TEXT NOT NULL, content_hash TEXT NOT NULL, embedding TEXT, embedding_model TEXT, created_at TEXT NOT NULL, UNIQUE(document_id,ordinal));
    CREATE TABLE IF NOT EXISTS citations (id TEXT PRIMARY KEY, organization_id TEXT NOT NULL, run_id TEXT, document_id TEXT NOT NULL, chunk_id TEXT, locator TEXT NOT NULL, excerpt TEXT, excerpt_hash TEXT NOT NULL, created_at TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS agent_run_branches (id TEXT PRIMARY KEY, organization_id TEXT NOT NULL, mission_id TEXT NOT NULL, parent_branch_id TEXT, node_key TEXT NOT NULL, assigned_agent_id TEXT NOT NULL, status TEXT NOT NULL, dependencies TEXT NOT NULL DEFAULT '[]', input_refs TEXT NOT NULL, output_refs TEXT, idempotency_key TEXT NOT NULL, attempt INTEGER NOT NULL DEFAULT 0, max_attempts INTEGER NOT NULL DEFAULT 3, lease_hash TEXT, lease_expires_at TEXT, budget TEXT NOT NULL DEFAULT '{}', error TEXT, created_at TEXT NOT NULL, updated_at TEXT NOT NULL, UNIQUE(organization_id,mission_id,node_key));
    CREATE TABLE IF NOT EXISTS mission_conflicts (id TEXT PRIMARY KEY, organization_id TEXT NOT NULL, mission_id TEXT NOT NULL, artifact_id TEXT, conflict_type TEXT NOT NULL, evidence TEXT NOT NULL, severity TEXT NOT NULL, status TEXT NOT NULL, resolution TEXT, resolved_by TEXT, created_at TEXT NOT NULL, resolved_at TEXT);
    CREATE TABLE IF NOT EXISTS voice_sessions (id TEXT PRIMARY KEY, organization_id TEXT NOT NULL, user_id TEXT NOT NULL, conversation_id TEXT NOT NULL, agent_id TEXT, provider TEXT NOT NULL, model TEXT NOT NULL, status TEXT NOT NULL, retention_mode TEXT NOT NULL, started_at TEXT NOT NULL, ended_at TEXT, usage TEXT NOT NULL DEFAULT '{}', error TEXT);
    CREATE TABLE IF NOT EXISTS voice_events (id TEXT PRIMARY KEY, organization_id TEXT NOT NULL, voice_session_id TEXT NOT NULL, sequence INTEGER NOT NULL, event_type TEXT NOT NULL, transcript_text TEXT, tool_request_id TEXT, metadata TEXT NOT NULL DEFAULT '{}', created_at TEXT NOT NULL, UNIQUE(voice_session_id,sequence));
    CREATE TABLE IF NOT EXISTS voice_session_tokens (id TEXT PRIMARY KEY, organization_id TEXT NOT NULL, voice_session_id TEXT NOT NULL, token_hash TEXT NOT NULL, expires_at TEXT NOT NULL, created_at TEXT NOT NULL, UNIQUE(voice_session_id,token_hash));
    CREATE TABLE IF NOT EXISTS media_assets (id TEXT PRIMARY KEY, organization_id TEXT NOT NULL, owner_id TEXT NOT NULL, mime_type TEXT NOT NULL, storage_key TEXT NOT NULL, sha256 TEXT NOT NULL, size_bytes INTEGER NOT NULL, duration_ms INTEGER, status TEXT NOT NULL, provider_ref TEXT, provider_delete_status TEXT, metadata TEXT NOT NULL DEFAULT '{}', analysis TEXT, created_at TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS usage_ledger (id TEXT PRIMARY KEY, organization_id TEXT NOT NULL, user_id TEXT, agent_id TEXT, mission_id TEXT, provider TEXT, connection_id TEXT, usage_type TEXT NOT NULL, units TEXT NOT NULL, estimated_cost REAL, occurred_at TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS usage_budgets (id TEXT PRIMARY KEY, organization_id TEXT NOT NULL, period TEXT NOT NULL, limits TEXT NOT NULL, updated_at TEXT NOT NULL, UNIQUE(organization_id,period));
    CREATE INDEX IF NOT EXISTS idx_mcp_catalog_search ON mcp_tool_catalog(organization_id,connection_id,status,tool_name);
    CREATE INDEX IF NOT EXISTS idx_tool_requests_org ON tool_execution_requests(organization_id,status,created_at);
    CREATE INDEX IF NOT EXISTS idx_oauth_states_hash ON oauth_states(state_hash,status,expires_at);
    CREATE INDEX IF NOT EXISTS idx_connection_credentials ON connection_credentials(organization_id,connection_id);
    CREATE INDEX IF NOT EXISTS idx_memories_scope ON memories(organization_id,scope_type,scope_id,status);
    CREATE INDEX IF NOT EXISTS idx_collection_docs ON collection_documents(organization_id,collection_id,logical_key,version);
    CREATE INDEX IF NOT EXISTS idx_run_branches ON agent_run_branches(organization_id,mission_id,status);
  `);
  const columns=(table)=>new Set(db.prepare(`PRAGMA table_info(${table})`).all().map(row=>row.name));
  const add=(table,column,definition)=>{if(!columns(table).has(column))db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);};
  add('connector_connections','account_email','TEXT');
  add('tool_execution_receipts','provider_request_id','TEXT');
  add('tool_execution_receipts','external_resource_ids',"TEXT NOT NULL DEFAULT '[]'");
}

export function seedBuiltInSkills(db,organizationId){
  const createdAt=timestamp();
  for(const [key,name] of BUILT_IN_SKILLS){
    let skill=db.prepare('SELECT id FROM skills WHERE organization_id=? AND skill_key=?').get(organizationId,key);
    if(!skill){const skillId=randomUUID();db.prepare("INSERT INTO skills(id,organization_id,skill_key,display_name,visibility,protected,created_by,created_at) VALUES(?,?,?,?,'organization',1,'system',?)").run(skillId,organizationId,key,name,createdAt);skill={id:skillId};}
    if(!db.prepare('SELECT 1 FROM skill_versions WHERE skill_id=?').get(skill.id)){
      const manifest={key,name,description:`Built-in academic workflow: ${name}.`,inputs:[],steps:[],requiredTools:[],approvalPolicy:'inherit',outputSchema:{type:'object'},version:1};
      db.prepare("INSERT INTO skill_versions(id,organization_id,skill_id,version,status,manifest,manifest_hash,approved_by,created_by,created_at) VALUES(?,?,?,1,'active',?,?, 'system','system',?)").run(randomUUID(),organizationId,skill.id,JSON.stringify(manifest),hash(manifest),createdAt);
    }
  }
}

export function seedAllBuiltInSkills(db){for(const row of db.prepare('SELECT id FROM organizations').all())seedBuiltInSkills(db,row.id);}
