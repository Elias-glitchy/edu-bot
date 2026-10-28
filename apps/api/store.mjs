import { DatabaseSync } from 'node:sqlite';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { randomUUID } from 'node:crypto';

export const agents = [
  ['chief', 'CHIEF', 'AI Executive Orchestrator', '#3478ed'],
  ['operations-manager', 'Operations Manager', 'Business operations and execution', '#15b9e8'],
  ['finance-manager', 'Finance Manager', 'Financial monitoring', '#19ad68'],
  ['sales-manager', 'Sales Manager', 'Pipeline and proposals', '#9251de'],
  ['outbound-manager', 'Outbound Manager', 'Prospecting and outreach', '#d84850'],
  ['intelligence-manager', 'Intelligence Manager', 'Research and intelligence', '#d8a939'],
  ['crm-manager', 'CRM Manager', 'Customer relationships', '#e77b2b'],
  ['marketing-manager', 'Marketing Manager', 'Campaigns and content', '#e952a5'],
  ['technology-manager', 'Technology Manager', 'Systems and automation', '#10aeb1'],
  ['tender-bid-manager', 'Tender & Bid Manager', 'Bid preparation', '#929ba9'],
  ['estimating-commercial-manager', 'Estimating & Commercial Manager', 'Estimates and commercial reviews', '#94c926']
];

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
    CREATE INDEX IF NOT EXISTS idx_tasks_org ON tasks(organization_id,created_at);
    CREATE INDEX IF NOT EXISTS idx_events_org ON events(organization_id,seq);`);
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
  addColumn('messages','conversation_id','TEXT');
  addColumn('tasks','conversation_id','TEXT');
  addColumn('tasks','mission_id','TEXT');
  addColumn('conversations','deleted_at','TEXT');
  addColumn('schedules','agent_id','TEXT');
  // Existing workspaces keep bots they already used; untouched preloads leave the Inbox.
  // Idempotent on startup so an interrupted migration can finish safely.
  db.exec(`UPDATE agents SET activation_state=1 WHERE kind='built_in' AND enabled=1 AND activation_state=0 AND (
      EXISTS(SELECT 1 FROM tasks t WHERE t.organization_id=agents.organization_id AND t.agent_id=agents.id)
      OR EXISTS(SELECT 1 FROM conversation_participants cp WHERE cp.organization_id=agents.organization_id AND cp.agent_id=agents.id)
      OR EXISTS(SELECT 1 FROM schedules s WHERE s.organization_id=agents.organization_id AND s.agent_id=agents.id)
      OR (slug='chief' AND EXISTS(SELECT 1 FROM messages m WHERE m.organization_id=agents.organization_id AND m.conversation_id IS NULL))
    );
    UPDATE agents SET enabled=0 WHERE kind='built_in' AND activation_state=0;`);
  return db;
}

export const now = () => new Date().toISOString();
export const id = () => randomUUID();
export function event(db, org, task, actor, type, detail) {
  db.prepare('INSERT INTO events(id,organization_id,task_id,actor,type,detail,created_at) VALUES(?,?,?,?,?,?,?)')
    .run(id(), org, task, actor, type, detail, now());
}
export function seedAgents(db, org) {
  const insert = db.prepare("INSERT INTO agents(id,organization_id,slug,name,role,accent,enabled) VALUES(?,?,?,?,?,?,0)");
  for (const [slug,name,role,accent] of agents) insert.run(id(),org,slug,name,role,accent);
}
export function snapshot(db, org) {
  const agentRows = db.prepare('SELECT id,slug,name,role,accent,kind,instructions,enabled,version,avatar_id FROM agents WHERE organization_id=? AND deleted_at IS NULL ORDER BY rowid').all(org);
  const tasks = db.prepare('SELECT * FROM tasks WHERE organization_id=? ORDER BY created_at DESC LIMIT 100').all(org).map(t=>({...t,plan:JSON.parse(t.plan),result:t.result?JSON.parse(t.result):null}));
  const messages = db.prepare('SELECT * FROM messages WHERE organization_id=? AND conversation_id IS NULL ORDER BY rowid LIMIT 200').all(org);
  const groupMessages = db.prepare('SELECT m.* FROM messages m JOIN conversations c ON c.id=m.conversation_id AND c.organization_id=m.organization_id WHERE m.organization_id=? AND c.deleted_at IS NULL ORDER BY m.rowid LIMIT 500').all(org);
  const groups = db.prepare("SELECT * FROM conversations WHERE organization_id=? AND kind='group' AND deleted_at IS NULL ORDER BY created_at DESC").all(org).map(g=>({...g,participants:db.prepare('SELECT agent_id FROM conversation_participants WHERE organization_id=? AND conversation_id=?').all(org,g.id).map(p=>p.agent_id)}));
  const directConversations = db.prepare("SELECT c.*,cp.agent_id FROM conversations c JOIN conversation_participants cp ON cp.conversation_id=c.id AND cp.organization_id=c.organization_id WHERE c.organization_id=? AND c.kind='direct' AND c.deleted_at IS NULL ORDER BY c.created_at DESC").all(org);
  const missions = db.prepare('SELECT * FROM missions WHERE organization_id=? ORDER BY created_at DESC').all(org).map(m=>({...m,plan:JSON.parse(m.plan)}));
  const reports = db.prepare('SELECT * FROM reports WHERE organization_id=? ORDER BY period_date DESC,created_at DESC LIMIT 30').all(org).map(r=>({...r,content:JSON.parse(r.content)}));
  const contacts = db.prepare('SELECT * FROM contacts WHERE organization_id=? ORDER BY name').all(org);
  const approvals = db.prepare('SELECT ar.*,c.name AS contact_name FROM approval_requests ar JOIN contacts c ON c.id=ar.contact_id AND c.organization_id=ar.organization_id WHERE ar.organization_id=? ORDER BY ar.created_at DESC').all(org).map(a=>({...a,payload:JSON.parse(a.payload)}));
  const approvalDecisions = db.prepare('SELECT * FROM approval_decisions WHERE organization_id=? ORDER BY created_at DESC').all(org);
  const schedules = db.prepare('SELECT * FROM schedules WHERE organization_id=? ORDER BY created_at DESC').all(org).map(s=>({...s,weekdays:JSON.parse(s.weekdays)}));
  const scheduleRuns = db.prepare('SELECT * FROM schedule_runs WHERE organization_id=? ORDER BY created_at DESC LIMIT 100').all(org);
  const notifications = db.prepare('SELECT * FROM notifications WHERE organization_id=? ORDER BY created_at DESC LIMIT 100').all(org);
  const events = db.prepare('SELECT * FROM events WHERE organization_id=? ORDER BY seq DESC LIMIT 200').all(org).reverse();
  return { agents: agentRows.map(a=>({...a,status:a.enabled?(tasks.find(t=>t.agent_id===a.id && ['queued','running','paused'].includes(t.status))?.status || 'idle'):'disabled'})), tasks, messages, groupMessages, groups, directConversations, missions, reports, contacts, approvals, approvalDecisions, schedules, scheduleRuns, notifications, events };
}
