import { id, now, event } from './store.mjs';
import { generateDailyReport, localDate, queueResearch, validateObjective } from './domain.mjs';

const weekdayNumbers = {Sun:0,Mon:1,Tue:2,Wed:3,Thu:4,Fri:5,Sat:6};

export function validateSchedule(input) {
  const kind=String(input.kind||''),title=String(input.title||'').trim(),localTime=String(input.localTime||''),weekdays=input.weekdays;
  if(!['research','report'].includes(kind)) throw new Error('Choose research or report.');
  if(title.length<3||title.length>100) throw new Error('Routine title must be 3–100 characters.');
  if(!/^([01]\d|2[0-3]):[0-5]\d$/.test(localTime)) throw new Error('Use a 24-hour local time such as 09:00.');
  if(!Array.isArray(weekdays)||weekdays.length<1||weekdays.length>7||new Set(weekdays).size!==weekdays.length||weekdays.some(day=>!Number.isInteger(day)||day<0||day>6)) throw new Error('Choose at least one valid weekday.');
  const objective=kind==='research'?validateObjective(input.objective).objective:null;
  const reportType=kind==='report'?String(input.reportType||'daily'):null;
  if(kind==='report'&&!['daily','morning','afternoon','evening'].includes(reportType)) throw new Error('Unsupported report type.');
  return {kind,title,objective,reportType,localTime,weekdays:[...weekdays].sort()};
}

export function nextRunAt(after,timezone,localTime,weekdays) {
  const start=Date.parse(after);
  if(!Number.isFinite(start)) throw new Error('Invalid schedule start time.');
  const format=new Intl.DateTimeFormat('en-US',{timeZone:timezone,weekday:'short',hour:'2-digit',minute:'2-digit',hourCycle:'h23'});
  let candidate=Math.floor(start/60000)*60000+60000;
  for(let minute=0;minute<8*24*60;minute++,candidate+=60000) {
    const parts=Object.fromEntries(format.formatToParts(new Date(candidate)).filter(p=>p.type!=='literal').map(p=>[p.type,p.value]));
    if(weekdays.includes(weekdayNumbers[parts.weekday])&&`${parts.hour}:${parts.minute}`===localTime) return new Date(candidate).toISOString();
  }
  throw new Error('No occurrence found in the coming week. Choose another time.');
}

export function createSchedule(db,organizationId,ownerId,input) {
  const spec=validateSchedule(input);
  const requestedAgentId=spec.kind==='research'?String(input.agentId||'').trim():'';
  const agent=spec.kind==='research'
    ?requestedAgentId
      ?db.prepare("SELECT id,name FROM agents WHERE id=? AND organization_id=? AND enabled=1 AND slug!='chief'").get(requestedAgentId,organizationId)
      :db.prepare("SELECT id,name FROM agents WHERE organization_id=? AND slug='academic-research' AND enabled=1 AND archived_at IS NULL").get(organizationId)
    :null;
  if(spec.kind==='research'&&!agent) throw new Error('Choose an active bot in this workspace for the research routine.');
  const count=db.prepare('SELECT COUNT(*) AS n FROM schedules WHERE organization_id=?').get(organizationId).n;
  if(count>=20) throw new Error('This alpha supports up to 20 routines per workspace.');
  const org=db.prepare('SELECT timezone FROM organizations WHERE id=?').get(organizationId);
  const created=now(),next=nextRunAt(created,org.timezone,spec.localTime,spec.weekdays),scheduleId=id();
  db.prepare('INSERT INTO schedules(id,organization_id,owner_id,kind,title,objective,report_type,local_time,weekdays,timezone,enabled,next_run_at,created_at,updated_at,agent_id) VALUES(?,?,?,?,?,?,?,?,?,?,1,?,?,?,?)')
    .run(scheduleId,organizationId,ownerId,spec.kind,spec.title,spec.objective,spec.reportType,spec.localTime,JSON.stringify(spec.weekdays),org.timezone,next,created,created,agent?.id||null);
  event(db,organizationId,null,'owner','schedule.created',`Routine “${spec.title}” created for ${agent?.name||'workspace reports'} at ${spec.localTime} ${org.timezone}.`);
  return {scheduleId,nextRunAt:next};
}

export function setScheduleEnabled(db,organizationId,scheduleId,enabled) {
  const schedule=db.prepare('SELECT * FROM schedules WHERE id=? AND organization_id=?').get(scheduleId,organizationId);
  if(!schedule) return null;
  const next=enabled?nextRunAt(now(),schedule.timezone,schedule.local_time,JSON.parse(schedule.weekdays)):schedule.next_run_at;
  db.prepare('UPDATE schedules SET enabled=?,next_run_at=?,updated_at=? WHERE id=? AND organization_id=?').run(enabled?1:0,next,now(),scheduleId,organizationId);
  event(db,organizationId,null,'owner',enabled?'schedule.enabled':'schedule.disabled',`Routine “${schedule.title}” ${enabled?'enabled':'disabled'}.`);
  return {enabled:!!enabled,nextRunAt:next};
}

export function rescheduleOrganization(db,organizationId,timezone) {
  for(const schedule of db.prepare('SELECT * FROM schedules WHERE organization_id=?').all(organizationId)) {
    const next=nextRunAt(now(),timezone,schedule.local_time,JSON.parse(schedule.weekdays));
    db.prepare('UPDATE schedules SET timezone=?,next_run_at=?,updated_at=? WHERE id=? AND organization_id=?').run(timezone,next,now(),schedule.id,organizationId);
  }
}

export function runDueSchedules(db,instant=now()) {
  const due=db.prepare('SELECT * FROM schedules WHERE enabled=1 AND next_run_at<=? ORDER BY next_run_at LIMIT 100').all(instant);
  const queued=[];
  for(const schedule of due) {
    const next=nextRunAt(instant,schedule.timezone,schedule.local_time,JSON.parse(schedule.weekdays));
    db.exec('BEGIN');
    try {
      const current=db.prepare('SELECT enabled,next_run_at FROM schedules WHERE id=?').get(schedule.id);
      if(!current?.enabled||current.next_run_at!==schedule.next_run_at) {db.exec('ROLLBACK');continue;}
      const runId=id(),created=now();
      db.prepare('INSERT INTO schedule_runs(id,schedule_id,organization_id,scheduled_for,status,created_at) VALUES(?,?,?,?,?,?)').run(runId,schedule.id,schedule.organization_id,schedule.next_run_at,'claimed',created);
      db.prepare('UPDATE schedules SET next_run_at=?,last_run_at=?,updated_at=? WHERE id=?').run(next,schedule.next_run_at,created,schedule.id);
      if(schedule.kind==='research') {
        const assigned=schedule.agent_id?db.prepare("SELECT id,name FROM agents WHERE id=? AND organization_id=? AND enabled=1 AND slug!='chief'").get(schedule.agent_id,schedule.organization_id):null;
        if(schedule.agent_id&&!assigned) {
          db.prepare("UPDATE schedule_runs SET status='blocked',error=? WHERE id=?").run('Assigned bot is disabled or unavailable.',runId);
          db.prepare('INSERT INTO notifications(id,organization_id,title,body,target_type,target_id,created_at) VALUES(?,?,?,?,?,?,?)').run(id(),schedule.organization_id,'Routine blocked',`${schedule.title} did not run because its assigned bot is unavailable.`,'schedule',schedule.id,created);
          event(db,schedule.organization_id,null,'system','schedule.blocked',`Routine “${schedule.title}” blocked; assigned bot unavailable.`);
        } else {
          let conversationId=null;
          if(assigned) {
            let conversation=db.prepare("SELECT c.id FROM conversations c JOIN conversation_participants cp ON cp.conversation_id=c.id AND cp.organization_id=c.organization_id WHERE c.organization_id=? AND c.kind='direct' AND cp.agent_id=?").get(schedule.organization_id,assigned.id);
            if(!conversation) {
              conversation={id:id()};
              db.prepare('INSERT INTO conversations VALUES(?,?,?,?,?)').run(conversation.id,schedule.organization_id,assigned.name,'direct',created);
              db.prepare('INSERT INTO conversation_participants VALUES(?,?,?)').run(conversation.id,schedule.organization_id,assigned.id);
            }
            conversationId=conversation.id;
          }
          const taskId=queueResearch(db,{organizationId:schedule.organization_id,ownerId:schedule.owner_id,objective:schedule.objective,conversationId,agentId:assigned?.id||null,direct:Boolean(assigned)});
          db.prepare("UPDATE schedule_runs SET status='queued',task_id=? WHERE id=?").run(taskId,runId);
          db.prepare('INSERT INTO notifications(id,organization_id,title,body,target_type,target_id,created_at) VALUES(?,?,?,?,?,?,?)').run(id(),schedule.organization_id,'Routine started',`${schedule.title} queued a public research task${assigned?` for ${assigned.name}`:''}.`,'task',taskId,created);
          queued.push(taskId);
        }
      } else {
        const period=localDate(schedule.next_run_at,schedule.timezone);
        const report=generateDailyReport(db,schedule.organization_id,period,schedule.report_type);
        db.prepare("UPDATE schedule_runs SET status='completed',report_id=? WHERE id=?").run(report.id,runId);
        db.prepare('INSERT INTO notifications(id,organization_id,title,body,target_type,target_id,created_at) VALUES(?,?,?,?,?,?,?)').run(id(),schedule.organization_id,'Report ready',`${schedule.title} generated a ${schedule.report_type} report for ${period}.`,'report',report.id,created);
      }
      event(db,schedule.organization_id,null,'system','schedule.triggered',`Routine “${schedule.title}” triggered at ${schedule.next_run_at}.`);
      db.exec('COMMIT');
    } catch(error) {db.exec('ROLLBACK');throw error;}
  }
  return queued;
}

export function finishScheduledTask(db,task,status) {
  const run=db.prepare('SELECT * FROM schedule_runs WHERE task_id=? AND organization_id=? AND status=?').get(task.id,task.organization_id,'queued');
  if(!run) return;
  db.prepare('UPDATE schedule_runs SET status=? WHERE id=? AND organization_id=?').run(status,run.id,task.organization_id);
  const title=status==='completed'?'Routine research ready':status==='failed'?'Routine research failed':'Routine research cancelled';
  db.prepare('INSERT INTO notifications(id,organization_id,title,body,target_type,target_id,created_at) VALUES(?,?,?,?,?,?,?)')
    .run(id(),task.organization_id,title,`Scheduled research task ${task.id} ${status}.`,'task',task.id,now());
}
