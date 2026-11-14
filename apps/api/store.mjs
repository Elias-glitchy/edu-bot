import { DatabaseSync } from 'node:sqlite';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { randomUUID } from 'node:crypto';
import { EDUCATION_SCHEMA_VERSION, educationRoles, legacyRoleSlugs } from './education-registry.mjs';
import { ensureExpansionSchema } from './expansion-schema.mjs';

export const agents = educationRoles.map(role=>[role.slug,role.name,role.role,role.accent]);

export function openStore(file) {
  if (file !== ':memory:') mkdirSync(dirname(file), { recursive: true });
  const db = new DatabaseSync(file);
  db.exec(`PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON;
    CREATE TABLE IF NOT EXISTS users (id TEXT PRIMARY KEY, email TEXT UNIQUE NOT NULL, salt TEXT NOT NULL, password_hash TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS organizations (id TEXT PRIMARY KEY, name TEXT NOT NULL, created_at TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS memberships (user_id TEXT NOT NULL, organization_id TEXT NOT NULL, role TEXT NOT NULL, PRIMARY KEY(user_id,organization_id));
    CREATE TABLE IF NOT EXISTS sessions (token_hash TEXT PRIMARY KEY, user_id TEXT NOT NULL, expires_at TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS agents (id TEXT PRIMARY KEY, organization_id TEXT NOT NULL, slug TEXT NOT NULL, name TEXT NOT NULL, role TEXT NOT NULL, accent TEXT NOT NULL, UNIQUE(organization_id,slug));
    CREATE TABLE IF NOT EXISTS messages (id TEXT PRIMARY KEY, organization_id TEXT NOT NULL, sender TEXT NOT NULL, body TEXT NOT NULL, task_id TEXT, created_at TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS tasks (id TEXT PRIMARY KEY, organization_id TEXT NOT NULL, owner_id TEXT NOT NULL, agent_id TEXT NOT NULL, objective TEXT NOT NULL, query TEXT NOT NULL, plan TEXT NOT NULL, status TEXT NOT NULL, result TEXT, error TEXT, created_at TEXT NOT NULL, updated_at TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS events (seq INTEGER PRIMARY KEY AUTOINCREMENT, id TEXT UNIQUE NOT NULL, organization_id TEXT NOT NULL, task_id TEXT, actor TEXT NOT NULL, type TEXT NOT NULL, detail TEXT NOT NULL, created_at TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS conversations (id TEXT PRIMARY KEY, organization_id TEXT NOT NULL, title TEXT NOT NULL, kind TEXT NOT NULL, created_at TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS conversation_participants (conversation_id TEXT NOT NULL, organization_id TEXT NOT NULL, agent_id TEXT NOT NULL, PRIMARY KEY(conversation_id,agent_id));
    CREATE TABLE IF NOT EXISTS missions (id TEXT PRIMARY KEY, organization_id TEXT NOT NULL, title TEXT NOT NULL, objective TEXT NOT NULL, plan TEXT NOT NULL, status TEXT NOT NULL, created_at TEXT NOT NULL, updated_at TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS reports (id TEXT PRIMARY KEY, organization_id TEXT NOT NULL, report_type TEXT NOT NULL, period_date TEXT NOT NULL, content TEXT NOT NULL, created_at TEXT NOT NULL, UNIQUE(organization_id,report_type,period_date));
    CREATE TABLE IF NOT EXISTS contacts (id TEXT PRIMARY KEY, organization_id TEXT NOT NULL, name TEXT NOT NULL, note TEXT NOT NULL DEFAULT '', version INTEGER NOT NULL DEFAULT 1, created_at TEXT NOT NULL, updated_at TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS approval_requests (id TEXT PRIMARY KEY, organization_id TEXT NOT NULL, contact_id TEXT NOT NULL, action_hash TEXT NOT NULL, payload TEXT NOT NULL, policy_version INTEGER NOT NULL, status TEXT NOT NULL, created_at TEXT NOT NULL, expires_at TEXT NOT NULL, executed_at TEXT);
    CREATE TABLE IF NOT EXISTS approval_decisions (id TEXT PRIMARY KEY, organization_id TEXT NOT NULL, approval_id TEXT NOT NULL, decision TEXT NOT NULL, actor TEXT NOT NULL, created_at TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS schedules (id TEXT PRIMARY KEY, organization_id TEXT NOT NULL, owner_id TEXT NOT NULL, kind TEXT NOT NULL, title TEXT NOT NULL, objective TEXT, report_type TEXT, local_time TEXT NOT NULL, weekdays TEXT NOT NULL, timezone TEXT NOT NULL, enabled INTEGER NOT NULL, next_run_at TEXT NOT NULL, last_run_at TEXT, created_at TEXT NOT NULL, updated_at TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS schedule_runs (id TEXT PRIMARY KEY, schedule_id TEXT NOT NULL, organization_id TEXT NOT NULL, scheduled_for TEXT NOT NULL, status TEXT NOT NULL, task_id TEXT, report_id TEXT, error TEXT, created_at TEXT NOT NULL, UNIQUE(schedule_id,scheduled_for));
    CREATE TABLE IF NOT EXISTS notifications (id TEXT PRIMARY KEY, organization_id TEXT NOT NULL, title TEXT NOT NULL, body TEXT NOT NULL, target_type TEXT, target_id TEXT, created_at TEXT NOT NULL, read_at TEXT);
    CREATE TABLE IF NOT EXISTS update_delivery_preferences (organization_id TEXT NOT NULL, user_id TEXT NOT NULL, times TEXT NOT NULL, whatsapp_enabled INTEGER NOT NULL DEFAULT 0, whatsapp_recipient TEXT, telegram_enabled INTEGER NOT NULL DEFAULT 0, telegram_chat_id TEXT, created_at TEXT NOT NULL, updated_at TEXT NOT NULL, PRIMARY KEY(organization_id,user_id));
    CREATE TABLE IF NOT EXISTS notification_deliveries (id TEXT PRIMARY KEY, organization_id TEXT NOT NULL, user_id TEXT NOT NULL, channel TEXT NOT NULL, scheduled_for TEXT NOT NULL, status TEXT NOT NULL, recipient_hint TEXT NOT NULL, provider_message_id TEXT, error TEXT, created_at TEXT NOT NULL, sent_at TEXT, UNIQUE(organization_id,user_id,channel,scheduled_for));
    CREATE TABLE IF NOT EXISTS schema_migrations (version TEXT PRIMARY KEY, applied_at TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS role_definitions (role_key TEXT PRIMARY KEY, version TEXT NOT NULL, display_name TEXT NOT NULL, capabilities TEXT NOT NULL, tool_allowlist TEXT NOT NULL, protected INTEGER NOT NULL);
    CREATE TABLE IF NOT EXISTS legacy_agent_archive (agent_id TEXT PRIMARY KEY, organization_id TEXT NOT NULL, slug TEXT NOT NULL, name TEXT NOT NULL, role TEXT NOT NULL, archived_at TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS mission_tasks (id TEXT PRIMARY KEY, mission_id TEXT NOT NULL, organization_id TEXT NOT NULL, assigned_agent_id TEXT NOT NULL, step_key TEXT NOT NULL, task_type TEXT NOT NULL, tool_name TEXT NOT NULL, input_refs TEXT NOT NULL, depends_on TEXT NOT NULL, status TEXT NOT NULL, attempt INTEGER NOT NULL DEFAULT 0, max_attempts INTEGER NOT NULL DEFAULT 3, lease_token TEXT, lease_expires_at TEXT, idempotency_key TEXT NOT NULL, requires_approval INTEGER NOT NULL DEFAULT 0, result TEXT, error TEXT, created_at TEXT NOT NULL, updated_at TEXT NOT NULL, UNIQUE(mission_id,step_key));
    CREATE TABLE IF NOT EXISTS task_handoffs (id TEXT PRIMARY KEY, organization_id TEXT NOT NULL, mission_id TEXT NOT NULL, from_agent_id TEXT, to_agent_id TEXT NOT NULL, task_id TEXT NOT NULL, payload TEXT NOT NULL, created_at TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS tool_calls (id TEXT PRIMARY KEY, organization_id TEXT NOT NULL, mission_id TEXT NOT NULL, task_id TEXT NOT NULL, agent_id TEXT NOT NULL, tool_name TEXT NOT NULL, input_hash TEXT NOT NULL, status TEXT NOT NULL, result TEXT, error TEXT, started_at TEXT NOT NULL, finished_at TEXT);
    CREATE TABLE IF NOT EXISTS artifacts (id TEXT PRIMARY KEY, organization_id TEXT NOT NULL, mission_id TEXT, task_id TEXT, artifact_type TEXT NOT NULL, title TEXT NOT NULL, storage_key TEXT NOT NULL, mime_type TEXT NOT NULL, checksum TEXT NOT NULL, revision INTEGER NOT NULL DEFAULT 1, sensitive INTEGER NOT NULL DEFAULT 0, created_at TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS mission_events (seq INTEGER PRIMARY KEY AUTOINCREMENT, id TEXT UNIQUE NOT NULL, organization_id TEXT NOT NULL, mission_id TEXT NOT NULL, task_id TEXT, agent_id TEXT, event_type TEXT NOT NULL, detail TEXT NOT NULL, created_at TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS academic_files (id TEXT PRIMARY KEY, organization_id TEXT NOT NULL, uploader_id TEXT NOT NULL, original_name TEXT NOT NULL, storage_key TEXT NOT NULL, mime_type TEXT NOT NULL, size INTEGER NOT NULL, sha256 TEXT NOT NULL, category TEXT NOT NULL, extracted_text TEXT NOT NULL, metadata TEXT NOT NULL, created_at TEXT NOT NULL, UNIQUE(organization_id,sha256,category));
    CREATE TABLE IF NOT EXISTS message_attachments (message_id TEXT NOT NULL, organization_id TEXT NOT NULL, file_id TEXT NOT NULL, created_at TEXT NOT NULL, PRIMARY KEY(message_id,file_id));
    CREATE TABLE IF NOT EXISTS draft_assessments (id TEXT PRIMARY KEY, organization_id TEXT NOT NULL, mission_id TEXT NOT NULL, student_id TEXT NOT NULL, rubric_id TEXT NOT NULL, criterion_scores TEXT NOT NULL, claimed_total REAL NOT NULL, derived_total REAL NOT NULL, feedback TEXT NOT NULL, revision INTEGER NOT NULL, review_status TEXT NOT NULL, source_file_id TEXT, created_at TEXT NOT NULL, UNIQUE(mission_id,student_id,revision));
    CREATE TABLE IF NOT EXISTS qa_findings (id TEXT PRIMARY KEY, organization_id TEXT NOT NULL, mission_id TEXT NOT NULL, assessment_id TEXT NOT NULL, issue_type TEXT NOT NULL, location TEXT NOT NULL, observed TEXT NOT NULL, expected TEXT NOT NULL, severity TEXT NOT NULL, correction_action TEXT NOT NULL, verification_state TEXT NOT NULL, correction_assessment_id TEXT, created_at TEXT NOT NULL, updated_at TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS education_approvals (id TEXT PRIMARY KEY, organization_id TEXT NOT NULL, mission_id TEXT NOT NULL, task_id TEXT NOT NULL, action_type TEXT NOT NULL, action_hash TEXT NOT NULL, payload TEXT NOT NULL, policy_version INTEGER NOT NULL, status TEXT NOT NULL, created_at TEXT NOT NULL, expires_at TEXT NOT NULL, decided_at TEXT, consumed_at TEXT);
    CREATE TABLE IF NOT EXISTS gradebook_proposals (id TEXT PRIMARY KEY, organization_id TEXT NOT NULL, mission_id TEXT NOT NULL, provider TEXT NOT NULL, sheet_ref TEXT NOT NULL, source_version TEXT NOT NULL, diff TEXT NOT NULL, status TEXT NOT NULL, write_receipt TEXT, created_at TEXT NOT NULL, verified_at TEXT);
    CREATE TABLE IF NOT EXISTS demo_gradebook_rows (organization_id TEXT NOT NULL, mission_id TEXT NOT NULL, student_id TEXT NOT NULL, student_name TEXT NOT NULL, course_id TEXT NOT NULL, assignment_id TEXT NOT NULL, draft_score REAL, draft_feedback TEXT, review_status TEXT NOT NULL, last_mission_id TEXT, row_version INTEGER NOT NULL DEFAULT 1, PRIMARY KEY(organization_id,mission_id,student_id));
    CREATE TABLE IF NOT EXISTS computers (id TEXT PRIMARY KEY, organization_id TEXT NOT NULL, agent_id TEXT NOT NULL, provider TEXT NOT NULL, provider_ref TEXT, volume_ref TEXT, image_version TEXT NOT NULL, state TEXT NOT NULL, host_port INTEGER, last_error TEXT, created_at TEXT NOT NULL, updated_at TEXT NOT NULL, UNIQUE(organization_id,agent_id));
    CREATE TABLE IF NOT EXISTS computer_sessions (id TEXT PRIMARY KEY, organization_id TEXT NOT NULL, computer_id TEXT NOT NULL, owner_id TEXT NOT NULL, state TEXT NOT NULL, control_owner TEXT NOT NULL, provider_session_ref TEXT, started_at TEXT NOT NULL, ended_at TEXT);
    CREATE TABLE IF NOT EXISTS computer_leases (id TEXT PRIMARY KEY, organization_id TEXT NOT NULL, computer_id TEXT NOT NULL, session_id TEXT, owner_type TEXT NOT NULL, owner_id TEXT NOT NULL, token_hash TEXT NOT NULL, expires_at TEXT NOT NULL, released_at TEXT, created_at TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS computer_stream_tokens (token_hash TEXT PRIMARY KEY, organization_id TEXT NOT NULL, computer_id TEXT NOT NULL, session_id TEXT NOT NULL, expires_at TEXT NOT NULL, created_at TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS computer_events (seq INTEGER PRIMARY KEY AUTOINCREMENT, id TEXT UNIQUE NOT NULL, organization_id TEXT NOT NULL, computer_id TEXT NOT NULL, session_id TEXT, actor TEXT NOT NULL, event_type TEXT NOT NULL, detail TEXT NOT NULL, created_at TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS agent_runs (id TEXT PRIMARY KEY, organization_id TEXT NOT NULL, agent_id TEXT NOT NULL, conversation_id TEXT, provider TEXT NOT NULL, model TEXT NOT NULL, objective TEXT NOT NULL, status TEXT NOT NULL, step_count INTEGER NOT NULL DEFAULT 0, max_steps INTEGER NOT NULL, error TEXT, created_at TEXT NOT NULL, updated_at TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS agent_run_steps (id TEXT PRIMARY KEY, organization_id TEXT NOT NULL, run_id TEXT NOT NULL, sequence INTEGER NOT NULL, step_type TEXT NOT NULL, tool_name TEXT, input_json TEXT, output_json TEXT, status TEXT NOT NULL, created_at TEXT NOT NULL, UNIQUE(run_id,sequence));
    CREATE TABLE IF NOT EXISTS agent_action_proposals (id TEXT PRIMARY KEY, organization_id TEXT NOT NULL, run_id TEXT, agent_id TEXT NOT NULL, computer_id TEXT NOT NULL, action_type TEXT NOT NULL, action_hash TEXT NOT NULL, payload TEXT NOT NULL, status TEXT NOT NULL, policy_version INTEGER NOT NULL, created_at TEXT NOT NULL, expires_at TEXT NOT NULL, decided_at TEXT, executed_at TEXT, error TEXT);
    CREATE TABLE IF NOT EXISTS durable_jobs (id TEXT PRIMARY KEY, organization_id TEXT NOT NULL, kind TEXT NOT NULL, idempotency_key TEXT NOT NULL, payload TEXT NOT NULL, status TEXT NOT NULL, attempt INTEGER NOT NULL DEFAULT 0, max_attempts INTEGER NOT NULL DEFAULT 3, budget_units INTEGER NOT NULL DEFAULT 0, consumed_units INTEGER NOT NULL DEFAULT 0, lease_token_hash TEXT, lease_expires_at TEXT, next_attempt_at TEXT NOT NULL, last_error TEXT, created_at TEXT NOT NULL, updated_at TEXT NOT NULL, UNIQUE(organization_id,kind,idempotency_key));
    CREATE TABLE IF NOT EXISTS gemini_batch_jobs (id TEXT PRIMARY KEY, organization_id TEXT NOT NULL, durable_job_id TEXT NOT NULL, model TEXT NOT NULL, display_name TEXT NOT NULL, request_count INTEGER NOT NULL, request_hash TEXT NOT NULL, provider_ref TEXT, status TEXT NOT NULL, result TEXT, error TEXT, created_at TEXT NOT NULL, updated_at TEXT NOT NULL, UNIQUE(organization_id,request_hash));
    CREATE TABLE IF NOT EXISTS connector_connections (id TEXT PRIMARY KEY, organization_id TEXT NOT NULL, connector_type TEXT NOT NULL, display_name TEXT NOT NULL, status TEXT NOT NULL, scopes TEXT NOT NULL, secret_ref TEXT, last_verified_at TEXT, created_at TEXT NOT NULL, updated_at TEXT NOT NULL, UNIQUE(organization_id,connector_type,display_name));
    CREATE INDEX IF NOT EXISTS idx_tasks_org ON tasks(organization_id,created_at);
    CREATE INDEX IF NOT EXISTS idx_events_org ON events(organization_id,seq);
    CREATE INDEX IF NOT EXISTS idx_mission_tasks_ready ON mission_tasks(status,organization_id,mission_id);
    CREATE INDEX IF NOT EXISTS idx_mission_events ON mission_events(organization_id,mission_id,seq);
    CREATE INDEX IF NOT EXISTS idx_academic_files_org ON academic_files(organization_id,created_at);
    CREATE INDEX IF NOT EXISTS idx_message_attachments_org ON message_attachments(organization_id,message_id);`);
  db.exec(`CREATE UNIQUE INDEX IF NOT EXISTS idx_computer_active_lease ON computer_leases(computer_id) WHERE released_at IS NULL;
    CREATE INDEX IF NOT EXISTS idx_computers_org ON computers(organization_id,agent_id);
    CREATE INDEX IF NOT EXISTS idx_computer_events_org ON computer_events(organization_id,seq);
    CREATE INDEX IF NOT EXISTS idx_agent_runs_org ON agent_runs(organization_id,created_at);
    CREATE INDEX IF NOT EXISTS idx_agent_actions_org ON agent_action_proposals(organization_id,status,created_at);
    CREATE INDEX IF NOT EXISTS idx_durable_jobs_ready ON durable_jobs(status,next_attempt_at,lease_expires_at);
    CREATE INDEX IF NOT EXISTS idx_gemini_batch_jobs_org ON gemini_batch_jobs(organization_id,created_at);
    CREATE INDEX IF NOT EXISTS idx_update_delivery_due ON update_delivery_preferences(organization_id,user_id);
    CREATE INDEX IF NOT EXISTS idx_notification_deliveries_org ON notification_deliveries(organization_id,user_id,created_at);`);
  function addColumn(table,column,definition) {
    if (!db.prepare(`PRAGMA table_info(${table})`).all().some(row=>row.name===column)) db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
  }
  addColumn('organizations','timezone',"TEXT NOT NULL DEFAULT 'Africa/Johannesburg'");
  addColumn('agents','kind',"TEXT NOT NULL DEFAULT 'built_in'");
  addColumn('agents','instructions',"TEXT NOT NULL DEFAULT ''");
  addColumn('agents','enabled','INTEGER NOT NULL DEFAULT 1');
  addColumn('agents','version','INTEGER NOT NULL DEFAULT 1');
  addColumn('agents','avatar_id','TEXT');
  addColumn('agents','activation_state','INTEGER NOT NULL DEFAULT 0');
  addColumn('agents','deleted_at','TEXT');
  addColumn('agents','archived_at','TEXT');
  addColumn('agents','role_key','TEXT');
  addColumn('agents','role_version',`TEXT NOT NULL DEFAULT '${EDUCATION_SCHEMA_VERSION}'`);
  addColumn('agents','allowed_tools',"TEXT NOT NULL DEFAULT '[]'");
  addColumn('messages','conversation_id','TEXT');
  addColumn('tasks','conversation_id','TEXT');
  addColumn('tasks','mission_id','TEXT');
  addColumn('missions','template_id','TEXT');
  addColumn('missions','input_refs',"TEXT NOT NULL DEFAULT '{}'");
  addColumn('conversations','deleted_at','TEXT');
  addColumn('schedules','agent_id','TEXT');
  addColumn('connector_connections','config',"TEXT NOT NULL DEFAULT '{}'");
  ensureExpansionSchema(db);
  migrateEducationWorkforce(db);
  ensureComputerInventory(db);
  // Existing workspaces keep current education bots they already used; untouched preloads leave the Inbox.
  // Idempotent on startup so an interrupted migration can finish safely.
  db.exec(`UPDATE agents SET activation_state=1 WHERE kind='built_in' AND enabled=1 AND activation_state=0 AND (
      EXISTS(SELECT 1 FROM tasks t WHERE t.organization_id=agents.organization_id AND t.agent_id=agents.id)
      OR EXISTS(SELECT 1 FROM conversation_participants cp WHERE cp.organization_id=agents.organization_id AND cp.agent_id=agents.id)
      OR EXISTS(SELECT 1 FROM schedules s WHERE s.organization_id=agents.organization_id AND s.agent_id=agents.id)
      OR (slug='chief' AND EXISTS(SELECT 1 FROM messages m WHERE m.organization_id=agents.organization_id AND m.conversation_id IS NULL))
    );
    UPDATE agents SET enabled=0 WHERE kind='built_in' AND archived_at IS NULL AND activation_state=0;`);
  return db;
}

export function migrateEducationWorkforce(db) {
  const appliedAt=now();
  db.exec('BEGIN');
  try {
    const upsertRole=db.prepare(`INSERT INTO role_definitions(role_key,version,display_name,capabilities,tool_allowlist,protected)
      VALUES(?,?,?,?,?,1) ON CONFLICT(role_key) DO UPDATE SET version=excluded.version,display_name=excluded.display_name,capabilities=excluded.capabilities,tool_allowlist=excluded.tool_allowlist,protected=1`);
    for(const role of educationRoles) upsertRole.run(role.roleKey,EDUCATION_SCHEMA_VERSION,role.name,JSON.stringify(role.capabilities),JSON.stringify(role.tools));
    for(const org of db.prepare('SELECT id FROM organizations').all()) {
      const chief=db.prepare("SELECT id FROM agents WHERE organization_id=? AND slug='chief' AND kind='built_in'").get(org.id);
      const chiefRole=educationRoles[0];
      if(chief) db.prepare('UPDATE agents SET name=?,role=?,accent=?,role_key=?,role_version=?,allowed_tools=?,avatar_id=?,archived_at=NULL WHERE id=? AND organization_id=?')
        .run(chiefRole.name,chiefRole.role,chiefRole.accent,chiefRole.roleKey,EDUCATION_SCHEMA_VERSION,JSON.stringify(chiefRole.tools),chiefRole.avatarId,chief.id,org.id);
      const placeholders=legacyRoleSlugs.map(()=>'?').join(',');
      const legacy=db.prepare(`SELECT * FROM agents WHERE organization_id=? AND kind='built_in' AND slug IN (${placeholders}) AND archived_at IS NULL`).all(org.id,...legacyRoleSlugs);
      for(const agent of legacy) {
        db.prepare('INSERT OR IGNORE INTO legacy_agent_archive(agent_id,organization_id,slug,name,role,archived_at) VALUES(?,?,?,?,?,?)').run(agent.id,org.id,agent.slug,agent.name,agent.role,appliedAt);
        db.prepare('UPDATE agents SET enabled=0,archived_at=? WHERE id=? AND organization_id=?').run(appliedAt,agent.id,org.id);
      }
      for(const role of educationRoles.slice(1)) {
        db.prepare(`INSERT OR IGNORE INTO agents(id,organization_id,slug,name,role,accent,kind,instructions,enabled,version,avatar_id,activation_state,role_key,role_version,allowed_tools)
          VALUES(?,?,?,?,?,?,'built_in','',0,1,?,0,?,?,?)`)
          .run(id(),org.id,role.slug,role.name,role.role,role.accent,role.avatarId,role.roleKey,EDUCATION_SCHEMA_VERSION,JSON.stringify(role.tools));
        db.prepare(`UPDATE agents SET name=?,role=?,accent=?,role_key=?,role_version=?,allowed_tools=?,avatar_id=?,archived_at=NULL
          WHERE organization_id=? AND slug=? AND kind='built_in'`).run(role.name,role.role,role.accent,role.roleKey,EDUCATION_SCHEMA_VERSION,JSON.stringify(role.tools),role.avatarId,org.id,role.slug);
      }
    }
    db.prepare('INSERT OR IGNORE INTO schema_migrations(version,applied_at) VALUES(?,?)').run(`education-workforce-${EDUCATION_SCHEMA_VERSION}`,appliedAt);
    db.exec('COMMIT');
  } catch(error) {db.exec('ROLLBACK');throw error;}
}

export const now = () => new Date().toISOString();
export const id = () => randomUUID();
export function ensureComputerForAgent(db,organizationId,agentId) {
  const existing=db.prepare('SELECT id FROM computers WHERE organization_id=? AND agent_id=?').get(organizationId,agentId);
  if(existing)return existing.id;
  const computerId=id(),timestamp=now();
  db.prepare(`INSERT INTO computers(id,organization_id,agent_id,provider,image_version,state,created_at,updated_at)
    VALUES(?,?,?,'docker','build-bot-computer:dev','unprovisioned',?,?)`).run(computerId,organizationId,agentId,timestamp,timestamp);
  return computerId;
}
export function ensureComputerInventory(db,organizationId=null) {
  const rows=organizationId
    ?db.prepare('SELECT id,organization_id FROM agents WHERE organization_id=? AND deleted_at IS NULL AND archived_at IS NULL').all(organizationId)
    :db.prepare('SELECT id,organization_id FROM agents WHERE deleted_at IS NULL AND archived_at IS NULL').all();
  for(const agent of rows)ensureComputerForAgent(db,agent.organization_id,agent.id);
}
export function event(db, org, task, actor, type, detail) {
  db.prepare('INSERT INTO events(id,organization_id,task_id,actor,type,detail,created_at) VALUES(?,?,?,?,?,?,?)')
    .run(id(), org, task, actor, type, detail, now());
}
export function seedAgents(db, org) {
  const insert = db.prepare("INSERT INTO agents(id,organization_id,slug,name,role,accent,kind,instructions,enabled,version,avatar_id,activation_state,role_key,role_version,allowed_tools) VALUES(?,?,?,?,?,?,'built_in','',0,1,?,0,?,?,?)");
  for (const role of educationRoles) insert.run(id(),org,role.slug,role.name,role.role,role.accent,role.avatarId,role.roleKey,EDUCATION_SCHEMA_VERSION,JSON.stringify(role.tools));
  ensureComputerInventory(db,org);
}
export function snapshot(db, org) {
  const agentRows = db.prepare('SELECT id,slug,name,role,accent,kind,instructions,enabled,version,avatar_id,role_key,role_version,allowed_tools FROM agents WHERE organization_id=? AND deleted_at IS NULL AND archived_at IS NULL ORDER BY CASE WHEN slug=\'chief\' THEN 0 ELSE 1 END,rowid').all(org);
  const archivedAgents = db.prepare('SELECT agent_id AS id,slug,name,role,archived_at FROM legacy_agent_archive WHERE organization_id=? ORDER BY archived_at').all(org);
  const tasks = db.prepare('SELECT * FROM tasks WHERE organization_id=? ORDER BY created_at DESC LIMIT 100').all(org).map(t=>({...t,plan:JSON.parse(t.plan),result:t.result?JSON.parse(t.result):null}));
  const attachmentRows=db.prepare('SELECT ma.message_id,af.id,af.original_name,af.mime_type,af.size,af.category,af.created_at FROM message_attachments ma JOIN academic_files af ON af.id=ma.file_id AND af.organization_id=ma.organization_id WHERE ma.organization_id=? ORDER BY ma.created_at').all(org),attachmentsByMessage=new Map();
  for(const attachment of attachmentRows){const list=attachmentsByMessage.get(attachment.message_id)||[];list.push(attachment);attachmentsByMessage.set(attachment.message_id,list);}
  const withAttachments=message=>({...message,attachments:attachmentsByMessage.get(message.id)||[]});
  const messages = db.prepare('SELECT * FROM messages WHERE organization_id=? AND conversation_id IS NULL ORDER BY rowid LIMIT 200').all(org).map(withAttachments);
  const groupMessages = db.prepare('SELECT m.* FROM messages m JOIN conversations c ON c.id=m.conversation_id AND c.organization_id=m.organization_id WHERE m.organization_id=? AND c.deleted_at IS NULL ORDER BY m.rowid LIMIT 500').all(org).map(withAttachments);
  const groups = db.prepare("SELECT * FROM conversations WHERE organization_id=? AND kind='group' AND deleted_at IS NULL ORDER BY created_at DESC").all(org).map(g=>({...g,participants:db.prepare('SELECT agent_id FROM conversation_participants WHERE organization_id=? AND conversation_id=?').all(org,g.id).map(p=>p.agent_id)}));
  const directConversations = db.prepare("SELECT c.*,cp.agent_id FROM conversations c JOIN conversation_participants cp ON cp.conversation_id=c.id AND cp.organization_id=c.organization_id WHERE c.organization_id=? AND c.kind='direct' AND c.deleted_at IS NULL ORDER BY c.created_at DESC").all(org);
  const missions = db.prepare('SELECT * FROM missions WHERE organization_id=? ORDER BY created_at DESC').all(org).map(m=>({...m,plan:JSON.parse(m.plan),input_refs:JSON.parse(m.input_refs||'{}')}));
  const reports = db.prepare('SELECT * FROM reports WHERE organization_id=? ORDER BY period_date DESC,created_at DESC LIMIT 30').all(org).map(r=>({...r,content:JSON.parse(r.content)}));
  const contacts = db.prepare('SELECT * FROM contacts WHERE organization_id=? ORDER BY name').all(org);
  const approvals = db.prepare('SELECT ar.*,c.name AS contact_name FROM approval_requests ar JOIN contacts c ON c.id=ar.contact_id AND c.organization_id=ar.organization_id WHERE ar.organization_id=? ORDER BY ar.created_at DESC').all(org).map(a=>({...a,payload:JSON.parse(a.payload)}));
  const approvalDecisions = db.prepare('SELECT * FROM approval_decisions WHERE organization_id=? ORDER BY created_at DESC').all(org);
  const schedules = db.prepare('SELECT * FROM schedules WHERE organization_id=? ORDER BY created_at DESC').all(org).map(s=>({...s,weekdays:JSON.parse(s.weekdays)}));
  const scheduleRuns = db.prepare('SELECT * FROM schedule_runs WHERE organization_id=? ORDER BY created_at DESC LIMIT 100').all(org);
  const notifications = db.prepare('SELECT * FROM notifications WHERE organization_id=? ORDER BY created_at DESC LIMIT 100').all(org);
  const events = db.prepare('SELECT * FROM events WHERE organization_id=? ORDER BY seq DESC LIMIT 200').all(org).reverse();
  const missionTasks=db.prepare('SELECT * FROM mission_tasks WHERE organization_id=? ORDER BY created_at LIMIT 500').all(org).map(row=>({...row,input_refs:JSON.parse(row.input_refs),depends_on:JSON.parse(row.depends_on),result:row.result?JSON.parse(row.result):null}));
  const handoffs=db.prepare('SELECT * FROM task_handoffs WHERE organization_id=? ORDER BY created_at LIMIT 500').all(org).map(row=>({...row,payload:JSON.parse(row.payload)}));
  const toolCalls=db.prepare('SELECT * FROM tool_calls WHERE organization_id=? ORDER BY started_at LIMIT 500').all(org).map(row=>({...row,result:row.result?JSON.parse(row.result):null}));
  const artifacts=db.prepare('SELECT * FROM artifacts WHERE organization_id=? ORDER BY created_at DESC LIMIT 200').all(org);
  const missionEvents=db.prepare('SELECT * FROM mission_events WHERE organization_id=? ORDER BY seq DESC LIMIT 500').all(org).reverse();
  const academicFiles=db.prepare('SELECT id,original_name,mime_type,size,sha256,category,metadata,created_at FROM academic_files WHERE organization_id=? ORDER BY created_at DESC LIMIT 200').all(org).map(row=>({...row,metadata:JSON.parse(row.metadata)}));
  const educationApprovals=db.prepare('SELECT * FROM education_approvals WHERE organization_id=? ORDER BY created_at DESC LIMIT 100').all(org).map(row=>({...row,payload:JSON.parse(row.payload)}));
  const qaFindings=db.prepare('SELECT * FROM qa_findings WHERE organization_id=? ORDER BY created_at DESC LIMIT 200').all(org);
  const gradebookProposals=db.prepare('SELECT * FROM gradebook_proposals WHERE organization_id=? ORDER BY created_at DESC LIMIT 30').all(org).map(row=>({...row,diff:JSON.parse(row.diff),write_receipt:row.write_receipt?JSON.parse(row.write_receipt):null}));
  const computers=db.prepare(`SELECT c.*,a.name AS agent_name,a.slug AS agent_slug,
    (SELECT l.owner_type FROM computer_leases l WHERE l.computer_id=c.id AND l.released_at IS NULL AND l.expires_at>? ORDER BY l.created_at DESC LIMIT 1) AS lease_owner_type
    FROM computers c JOIN agents a ON a.id=c.agent_id AND a.organization_id=c.organization_id
    WHERE c.organization_id=? AND a.deleted_at IS NULL AND a.archived_at IS NULL ORDER BY CASE WHEN a.slug='chief' THEN 0 ELSE 1 END,a.rowid`).all(now(),org);
  const computerSessions=db.prepare('SELECT * FROM computer_sessions WHERE organization_id=? ORDER BY started_at DESC LIMIT 100').all(org);
  const computerEvents=db.prepare('SELECT * FROM computer_events WHERE organization_id=? ORDER BY seq DESC LIMIT 200').all(org).reverse();
  const agentRuns=db.prepare('SELECT * FROM agent_runs WHERE organization_id=? ORDER BY created_at DESC LIMIT 100').all(org);
  const agentActions=db.prepare('SELECT id,run_id,agent_id,computer_id,action_type,action_hash,payload,status,policy_version,created_at,expires_at,decided_at,executed_at,error FROM agent_action_proposals WHERE organization_id=? ORDER BY created_at DESC LIMIT 100').all(org).map(row=>({...row,payload:JSON.parse(row.payload)}));
  const batchJobs=db.prepare('SELECT * FROM gemini_batch_jobs WHERE organization_id=? ORDER BY created_at DESC LIMIT 100').all(org).map(row=>({...row,result:row.result?JSON.parse(row.result):null}));
  const connectors=db.prepare("SELECT id,connector_type,display_name,status,scopes,config,account_email,secret_ref IS NOT NULL AS has_secret_ref,last_verified_at,created_at,updated_at FROM connector_connections WHERE organization_id=? ORDER BY connector_type,display_name").all(org).map(row=>{const budget=db.prepare('SELECT limits,consumed,resets_at FROM connector_budgets WHERE organization_id=? AND connection_id=? ORDER BY updated_at DESC LIMIT 1').get(org,row.id);return {...row,scopes:JSON.parse(row.scopes),config:JSON.parse(row.config),budget:budget?{limits:JSON.parse(budget.limits),consumed:JSON.parse(budget.consumed),resetsAt:budget.resets_at}:null};});
  const toolPolicies=db.prepare('SELECT * FROM tool_policy_grants WHERE organization_id=? ORDER BY policy_version DESC LIMIT 300').all(org).map(row=>({...row,constraints:JSON.parse(row.constraints)}));
  const toolExecutionRequests=db.prepare(`SELECT r.*,c.tool_name,c.description AS tool_description,a.name AS bot_name,cc.display_name AS connector_name FROM tool_execution_requests r JOIN mcp_tool_catalog c ON c.id=r.catalog_tool_id LEFT JOIN agents a ON a.id=r.bot_id AND a.organization_id=r.organization_id LEFT JOIN connector_connections cc ON cc.id=r.connection_id AND cc.organization_id=r.organization_id WHERE r.organization_id=? ORDER BY r.created_at DESC LIMIT 200`).all(org).map(row=>({...row,normalized_arguments:JSON.parse(row.normalized_arguments)}));
  return { agents: agentRows.map(a=>({...a,allowed_tools:JSON.parse(a.allowed_tools),status:a.enabled?(missionTasks.find(t=>t.assigned_agent_id===a.id && ['queued','running','validating','awaiting_approval','retrying','paused'].includes(t.status))?.status||tasks.find(t=>t.agent_id===a.id && ['queued','running','paused'].includes(t.status))?.status || 'idle'):'disabled'})), archivedAgents, tasks, messages, groupMessages, groups, directConversations, missions, reports, contacts, approvals, approvalDecisions, schedules, scheduleRuns, notifications, events, missionTasks, handoffs, toolCalls, artifacts, missionEvents, academicFiles, educationApprovals, qaFindings, gradebookProposals, computers, computerSessions, computerEvents, agentRuns, agentActions, batchJobs, connectors, toolPolicies, toolExecutionRequests };
}
