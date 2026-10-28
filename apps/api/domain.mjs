import { id, now, event } from './store.mjs';
import { researchQuery } from './research.mjs';

export const palette = new Set(['#1E293B','#4F46E5','#2563EB','#0284C7','#0891B2','#059669','#15803D','#4D7C0F','#CA8A04','#D97706','#EA580C','#E11D48','#BE185D','#C026D3','#7C3AED','#92400E','#475569','#71717A']);

export function validateObjective(objective) {
  const value=String(objective||'').trim();
  if(value.length<8||value.length>1000) throw new Error('Enter a research request between 8 and 1,000 characters.');
  if(!/^(please\s+)?(research|find out about|look up|investigate)\b/i.test(value)) throw new Error('This build accepts research requests. Start with “Research”, “Look up”, or “Investigate”.');
  const query=researchQuery(value);
  if(query.length<3) throw new Error('Add a specific topic to research.');
  return {objective:value,query};
}

export function queueResearch(db,{organizationId,ownerId,objective,conversationId=null,missionId=null,agentId=null,direct=false}) {
  const {query}=validateObjective(objective);
  const agent=agentId
    ?db.prepare("SELECT id,name,slug FROM agents WHERE id=? AND organization_id=? AND enabled=1 AND deleted_at IS NULL AND slug!='chief'").get(agentId,organizationId)
    :db.prepare("SELECT id,name,slug FROM agents WHERE organization_id=? AND slug='intelligence-manager' AND enabled=1").get(organizationId);
  if(!agent) throw new Error('The selected bot is unavailable.');
  const taskId=id(),plan=['Interpret the research topic',`${agent.name} searches a public source`,'Return source links and excerpts'];
  db.prepare('INSERT INTO messages(id,organization_id,sender,body,task_id,created_at,conversation_id) VALUES(?,?,?,?,?,?,?)').run(id(),organizationId,'owner',objective,taskId,now(),conversationId);
  db.prepare('INSERT INTO tasks(id,organization_id,owner_id,agent_id,objective,query,plan,status,result,error,created_at,updated_at,conversation_id,mission_id) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?)')
    .run(taskId,organizationId,ownerId,agent.id,objective,query,JSON.stringify(plan),'queued',null,null,now(),now(),conversationId,missionId);
  db.prepare('INSERT INTO messages(id,organization_id,sender,body,task_id,created_at,conversation_id) VALUES(?,?,?,?,?,?,?)').run(id(),organizationId,direct?agent.slug:'chief',direct?`I’ll research “${query}” using a public source and return the links.`:`I’ve delegated public-source research on “${query}” to ${agent.name}.`,taskId,now(),conversationId);
  event(db,organizationId,taskId,'owner','message.created',direct?`Research request sent to ${agent.name}.`:conversationId?'Research request sent in a group conversation.':'Research request sent to CHIEF.');
  event(db,organizationId,taskId,'chief','plan.created','Three-step public-source research plan created.');
  event(db,organizationId,taskId,direct?'owner':'chief','task.delegated',`Delegated to ${agent.name}.`);
  return taskId;
}

export function localDate(instant,timezone) {
  return new Intl.DateTimeFormat('en-CA',{timeZone:timezone,year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(instant));
}

export function generateDailyReport(db,organizationId,date,type='daily') {
  const org=db.prepare('SELECT timezone FROM organizations WHERE id=?').get(organizationId);
  const period=date||localDate(now(),org.timezone);
  if(!/^\d{4}-\d{2}-\d{2}$/.test(period)) throw new Error('Date must use YYYY-MM-DD.');
  if(!['daily','morning','afternoon','evening'].includes(type)) throw new Error('Unsupported report type.');
  const existing=db.prepare('SELECT * FROM reports WHERE organization_id=? AND report_type=? AND period_date=?').get(organizationId,type,period);
  if(existing) return {...existing,content:JSON.parse(existing.content),existing:true};
  const tasks=db.prepare('SELECT * FROM tasks WHERE organization_id=? ORDER BY created_at').all(organizationId)
    .filter(t=>localDate(t.created_at,org.timezone)===period||localDate(t.updated_at,org.timezone)===period);
  const counts={completed:0,in_progress:0,paused:0,failed:0,cancelled:0};
  for(const t of tasks) {
    if(t.status==='completed') counts.completed++;
    else if(['running','queued'].includes(t.status)) counts.in_progress++;
    else if(counts[t.status]!==undefined) counts[t.status]++;
  }
  const items=tasks.map(t=>({taskId:t.id,objective:t.objective,status:t.status,evidence:t.result?JSON.parse(t.result).sources.map(s=>s.url):[]}));
  const content={timezone:org.timezone,counts,items,unavailable:['Financial and business metrics are unavailable without connected systems.']};
  const report={id:id(),organization_id:organizationId,report_type:type,period_date:period,content,created_at:now()};
  db.prepare('INSERT INTO reports(id,organization_id,report_type,period_date,content,created_at) VALUES(?,?,?,?,?,?)').run(report.id,organizationId,report.report_type,period,JSON.stringify(content),report.created_at);
  event(db,organizationId,null,'system','report.generated',`${type} report generated for ${period}.`);
  return report;
}
