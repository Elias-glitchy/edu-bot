import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { resolve, extname, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomBytes, createHash, scryptSync, timingSafeEqual } from 'node:crypto';
import { openStore, seedAgents, snapshot, event, id, now } from './store.mjs';
import { research } from './research.mjs';
import { queueResearch, validateObjective, generateDailyReport, palette } from './domain.mjs';
import { proposeNote, decideApproval, ActionError } from './approvals.mjs';
import { createSchedule, setScheduleEnabled, rescheduleOrganization, runDueSchedules, finishScheduledTask } from './schedules.mjs';
import { DEFAULT_AVATAR_ID, isValidAvatarId } from '../web/avatar-library.js';
import { validateChatMessage, generateChatReply } from './chat.mjs';

const root = resolve(fileURLToPath(new URL('../web/',import.meta.url)));
const mime = {'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.png':'image/png','.webp':'image/webp','.svg':'image/svg+xml'};
const hash = v=>createHash('sha256').update(v).digest('hex');
const json = (res,status,value,headers={})=>{res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store',...headers});res.end(JSON.stringify(value));};
const fail = (res,status,message)=>json(res,status,{error:message});
async function body(req) {
  let raw='';
  for await (const chunk of req) { raw+=chunk; if(raw.length>32_000) throw new Error('Request too large'); }
  try { return JSON.parse(raw||'{}'); } catch { throw new Error('Invalid JSON'); }
}
function account(db,req) {
  const cookie=req.headers.cookie?.match(/(?:^|;\s*)bb_colleague_zero_session=([^;]+)/)?.[1];
  if (!cookie) return null;
  return db.prepare(`SELECT u.id AS user_id,u.email,m.organization_id,m.role,o.name AS organization_name
    FROM sessions s JOIN users u ON u.id=s.user_id JOIN memberships m ON m.user_id=u.id
    JOIN organizations o ON o.id=m.organization_id WHERE s.token_hash=? AND s.expires_at>?`)
    .get(hash(cookie),now()) || null;
}
function session(db,res,userId) {
  const token=randomBytes(32).toString('base64url');
  db.prepare('INSERT INTO sessions(token_hash,user_id,expires_at) VALUES(?,?,?)').run(hash(token),userId,new Date(Date.now()+7*86400000).toISOString());
  return {'Set-Cookie':`bb_colleague_zero_session=${token}; HttpOnly; SameSite=Strict; Path=/; Max-Age=604800`};
}
function passwordHash(password,salt) { return scryptSync(password,salt,64).toString('hex'); }
function updateTask(db,task,status,actor,type,detail,extra={}) {
  db.prepare('UPDATE tasks SET status=?, result=?, error=?, updated_at=? WHERE id=? AND organization_id=?')
    .run(status,extra.result??task.result,extra.error??task.error,now(),task.id,task.organization_id);
  event(db,task.organization_id,task.id,actor,type,detail);
}

export function createApp({databasePath=resolve('data/build-bot-colleague-zero.sqlite'),fixtureResearch=false,fixtureDelayMs=0,chatFetch=fetch,toolFetch=fetch,searchApiKey=process.env.COLLEAGUE_ZERO_BRAVE_SEARCH_API_KEY}={}) {
  const db=openStore(databasePath);
  // A claimed task is retried after a process restart. The research tool is read-only.
  for (const task of db.prepare("SELECT * FROM tasks WHERE status='running'").all()) updateTask(db,task,'queued','system','task.requeued','Worker restarted; read-only research queued again.');
  let busy=false, inFlight=null, closed=false, chatQueue=Promise.resolve();
  function work() {
    if (closed || busy) return inFlight;
    const task=db.prepare("SELECT * FROM tasks WHERE status='queued' ORDER BY created_at LIMIT 1").get();
    if (!task) return null;
    busy=true;
    inFlight=(async()=>{
    try {
      const agent=db.prepare('SELECT name,slug FROM agents WHERE id=? AND organization_id=?').get(task.agent_id,task.organization_id);
      const actor=agent?.slug||'intelligence-manager',agentName=agent?.name||'Intelligence Manager';
      updateTask(db,task,'running',actor,'task.started',`${agentName} began source research.`);
      event(db,task.organization_id,task.id,actor,'tool.requested','Read-only Wikipedia search');
      const result=await research(task.query,{fixture:fixtureResearch,fixtureDelayMs});
      const current=db.prepare('SELECT * FROM tasks WHERE id=?').get(task.id);
      if(current.status!=='running') return;
      event(db,task.organization_id,task.id,actor,'tool.succeeded',`${result.sources.length} public search result(s).`);
      const resultText=JSON.stringify(result);
      updateTask(db,current,'completed',actor,'task.completed',`${result.sources.length} source(s) returned.`,{result:resultText});
      finishScheduledTask(db,task,'completed');
      const conversation=task.conversation_id?db.prepare('SELECT kind FROM conversations WHERE id=? AND organization_id=?').get(task.conversation_id,task.organization_id):null;
      if(task.conversation_id) db.prepare('INSERT INTO messages(id,organization_id,sender,body,task_id,created_at,conversation_id) VALUES(?,?,?,?,?,?,?)')
        .run(id(),task.organization_id,actor,result.sources.length ? `I found ${result.sources.length} cited source(s). The research card contains the evidence.` : result.summary,task.id,now(),task.conversation_id);
      const chiefPresent=conversation?.kind==='group'&&db.prepare("SELECT 1 FROM conversation_participants cp JOIN agents a ON a.id=cp.agent_id AND a.organization_id=cp.organization_id WHERE cp.conversation_id=? AND cp.organization_id=? AND a.slug='chief' AND a.enabled=1").get(task.conversation_id,task.organization_id);
      if(conversation?.kind!=='direct'&&(conversation?.kind!=='group'||chiefPresent)) {
        db.prepare('INSERT INTO messages(id,organization_id,sender,body,task_id,created_at,conversation_id) VALUES(?,?,?,?,?,?,?)')
          .run(id(),task.organization_id,'chief',result.sources.length ? `${agentName} returned ${result.sources.length} cited source(s). Review the research card for details.` : result.summary,task.id,now(),task.conversation_id);
        event(db,task.organization_id,task.id,'chief','message.created','Research result delivered to CHIEF conversation.');
      }
      if(task.mission_id) {
        db.prepare("UPDATE missions SET status='completed',updated_at=? WHERE id=? AND organization_id=? AND status='active'").run(now(),task.mission_id,task.organization_id);
        event(db,task.organization_id,task.id,'chief','mission.completed','Mission research task completed.');
      }
    } catch(err) {
      const current=db.prepare('SELECT * FROM tasks WHERE id=?').get(task.id);
      if(current?.status==='running') {
        const actor=db.prepare('SELECT slug FROM agents WHERE id=? AND organization_id=?').get(task.agent_id,task.organization_id)?.slug||'intelligence-manager';
        event(db,task.organization_id,task.id,actor,'tool.failed','Public search failed.');
        updateTask(db,current,'failed',actor,'task.failed','Research source unavailable.',{error:String(err?.message||err).slice(0,300)});
        finishScheduledTask(db,task,'failed');
        if(task.mission_id) {
          db.prepare("UPDATE missions SET status='blocked',updated_at=? WHERE id=? AND organization_id=? AND status='active'").run(now(),task.mission_id,task.organization_id);
          event(db,task.organization_id,task.id,'chief','mission.blocked','Mission blocked by research source failure.');
        }
      }
    } finally { busy=false; inFlight=null; if(!closed) setImmediate(work); }
    })();
    return inFlight;
  }
  const timer=setInterval(work,900);
  timer.unref();
  function runSchedules(instant) {const queued=runDueSchedules(db,instant);if(queued.length) work();return queued;}
  async function saveChat({organizationId,actor,agent,conversationId=null,message}) {
    // One inference at a time prevents two local 3B models loading together on an 8GB laptop.
    const run=async()=>{
      const history=conversationId
        ?db.prepare('SELECT sender,body FROM messages WHERE organization_id=? AND conversation_id=? ORDER BY rowid DESC LIMIT 12').all(organizationId,conversationId).reverse()
        :db.prepare('SELECT sender,body FROM messages WHERE organization_id=? AND conversation_id IS NULL ORDER BY rowid DESC LIMIT 12').all(organizationId).reverse();
      const reply=await generateChatReply({agent,message,history,fetchImpl:chatFetch,toolFetch,searchApiKey});
      const messageId=id();
      db.exec('BEGIN');
      try {
        db.prepare('INSERT INTO messages(id,organization_id,sender,body,task_id,created_at,conversation_id) VALUES(?,?,?,?,?,?,?)').run(messageId,organizationId,'owner',message,null,now(),conversationId);
        db.prepare('INSERT INTO messages(id,organization_id,sender,body,task_id,created_at,conversation_id) VALUES(?,?,?,?,?,?,?)').run(id(),organizationId,agent.slug,reply,null,now(),conversationId);
        event(db,organizationId,null,actor,'message.created',`Message sent to ${agent.name}.`);
        db.exec('COMMIT');
      } catch(error) {db.exec('ROLLBACK');throw error;}
      return {ok:true,messageId,reply};
    };
    const pending=chatQueue.then(run);
    chatQueue=pending.catch(()=>{});
    return pending;
  }
  const scheduleTimer=setInterval(()=>{try{runSchedules();}catch(error){console.error('Schedule tick failed:',error);}},15000);
  scheduleTimer.unref();
  setImmediate(()=>{if(!closed) try{runSchedules();}catch(error){console.error('Schedule recovery failed:',error);}});
  const server=createServer(async(req,res)=>{
    try {
      const url=new URL(req.url,'http://localhost');
      if(url.pathname==='/api/health') return json(res,200,{ok:true,storage:'sqlite',research:fixtureResearch?'fixture':'wikipedia'});
      if(url.pathname.startsWith('/api/')) {
        if(req.method!=='GET' && req.headers.origin) {
          const host=`${req.headers['x-forwarded-proto']||'http'}://${req.headers.host}`;
          if(req.headers.origin!==host) return fail(res,403,'Origin denied');
        }
        if(url.pathname==='/api/auth/register' && req.method==='POST') {
          const b=await body(req),email=String(b.email||'').trim().toLowerCase(),password=String(b.password||''),name=String(b.organization||'').trim();
          if(!/^\S+@\S+\.\S+$/.test(email)||password.length<10||password.length>200||!name||name.length>100) return fail(res,400,'Enter an email, organization, and password of at least 10 characters.');
          if(db.prepare('SELECT 1 FROM users WHERE email=?').get(email)) return fail(res,409,'This email already has an account.');
          const userId=id(),orgId=id(),salt=randomBytes(16).toString('hex');
          db.exec('BEGIN');
          try {
            db.prepare('INSERT INTO users VALUES(?,?,?,?)').run(userId,email,salt,passwordHash(password,salt));
            db.prepare('INSERT INTO organizations(id,name,created_at) VALUES(?,?,?)').run(orgId,name,now());
            db.prepare('INSERT INTO memberships VALUES(?,?,?)').run(userId,orgId,'owner');
            seedAgents(db,orgId);
            event(db,orgId,null,email,'organization.created','Organization and eleven built-in agents created.');
            db.exec('COMMIT');
          } catch(e) {db.exec('ROLLBACK');throw e;}
          return json(res,201,{ok:true},session(db,res,userId));
        }
        if(url.pathname==='/api/auth/login' && req.method==='POST') {
          const b=await body(req),user=db.prepare('SELECT * FROM users WHERE email=?').get(String(b.email||'').trim().toLowerCase());
          const expected=user?.password_hash||'0'.repeat(128),actual=passwordHash(String(b.password||''),user?.salt||'0'.repeat(32));
          if(!user||!timingSafeEqual(Buffer.from(expected,'hex'),Buffer.from(actual,'hex'))) return fail(res,401,'Invalid email or password.');
          return json(res,200,{ok:true},session(db,res,user.id));
        }
        const me=account(db,req);
        if(!me) return fail(res,401,'Sign in required.');
        if(url.pathname==='/api/auth/logout' && req.method==='POST') {
          const token=req.headers.cookie?.match(/(?:^|;\s*)bb_colleague_zero_session=([^;]+)/)?.[1];
          if(token) db.prepare('DELETE FROM sessions WHERE token_hash=?').run(hash(token));
          return json(res,200,{ok:true},{'Set-Cookie':'bb_colleague_zero_session=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0'});
        }
        if(url.pathname==='/api/state' && req.method==='GET') {
          const org=db.prepare('SELECT id,name,timezone FROM organizations WHERE id=?').get(me.organization_id);
          return json(res,200,{me,organization:org,...snapshot(db,me.organization_id)});
        }
        if(url.pathname==='/api/chat' && req.method==='POST') {
          const b=await body(req),message=validateChatMessage(b.message),conversationId=b.conversationId||null;
          let agent;
          if(conversationId) {
            const group=db.prepare("SELECT id FROM conversations WHERE id=? AND organization_id=? AND kind='group' AND deleted_at IS NULL").get(conversationId,me.organization_id);
            if(!group) return fail(res,404,'Group not found.');
            agent=db.prepare("SELECT a.* FROM conversation_participants cp JOIN agents a ON a.id=cp.agent_id AND a.organization_id=cp.organization_id WHERE cp.conversation_id=? AND cp.organization_id=? AND a.enabled=1 AND a.deleted_at IS NULL ORDER BY CASE WHEN a.slug='chief' THEN 1 ELSE 0 END,cp.rowid LIMIT 1").get(conversationId,me.organization_id);
            if(!agent) return fail(res,409,'Activate a group bot before sending a message.');
          } else {
            agent=db.prepare("SELECT * FROM agents WHERE organization_id=? AND slug='chief' AND enabled=1").get(me.organization_id);
            if(!agent) return fail(res,409,'Activate CHIEF in AI Workforce before sending a message.');
          }
          try {return json(res,200,await saveChat({organizationId:me.organization_id,actor:me.email,agent,conversationId,message}));}
          catch(error) {return fail(res,503,error.message);}
        }
        const directChat=url.pathname.match(/^\/api\/agents\/([0-9a-f-]+)\/chat$/);
        if(directChat && req.method==='POST') {
          const agent=db.prepare("SELECT * FROM agents WHERE id=? AND organization_id=? AND enabled=1 AND deleted_at IS NULL AND slug!='chief'").get(directChat[1],me.organization_id);
          if(!agent) return fail(res,404,'Available bot not found.');
          const message=validateChatMessage((await body(req)).message);
          let conversation=db.prepare("SELECT c.id FROM conversations c JOIN conversation_participants cp ON cp.conversation_id=c.id AND cp.organization_id=c.organization_id WHERE c.organization_id=? AND c.kind='direct' AND c.deleted_at IS NULL AND cp.agent_id=?").get(me.organization_id,agent.id);
          if(!conversation) {
            conversation={id:id()};
            db.prepare('INSERT INTO conversations(id,organization_id,title,kind,created_at) VALUES(?,?,?,?,?)').run(conversation.id,me.organization_id,agent.name,'direct',now());
            db.prepare('INSERT INTO conversation_participants VALUES(?,?,?)').run(conversation.id,me.organization_id,agent.id);
            event(db,me.organization_id,null,me.email,'conversation.created',`Direct conversation with ${agent.name} created.`);
          }
          let result;
          try {result=await saveChat({organizationId:me.organization_id,actor:me.email,agent,conversationId:conversation.id,message});}
          catch(error) {return fail(res,503,error.message);}
          return json(res,200,{...result,conversationId:conversation.id});
        }
        if(url.pathname==='/api/research' && req.method==='POST') {
          const b=await body(req),objective=String(b.objective||'').trim(),conversationId=b.conversationId||null;
          try {validateObjective(objective);} catch(err) {return fail(res,400,err.message);}
          if(conversationId) {
            const group=db.prepare("SELECT id FROM conversations WHERE id=? AND organization_id=? AND kind='group' AND deleted_at IS NULL").get(conversationId,me.organization_id);
            if(!group) return fail(res,404,'Group not found.');
            const assignee=db.prepare("SELECT a.id,a.name FROM conversation_participants cp JOIN agents a ON a.id=cp.agent_id AND a.organization_id=cp.organization_id WHERE cp.conversation_id=? AND cp.organization_id=? AND a.enabled=1 AND a.slug!='chief' ORDER BY CASE WHEN a.slug='intelligence-manager' THEN 0 ELSE 1 END,cp.rowid LIMIT 1").get(conversationId,me.organization_id);
            if(!assignee) return fail(res,400,'Add an active bot to this group before assigning research.');
            b.agentId=assignee.id;
          }
          else if(!db.prepare("SELECT 1 FROM agents WHERE organization_id=? AND slug='chief' AND enabled=1").get(me.organization_id)) return fail(res,409,'Activate CHIEF in AI Workforce before coordinated research.');
          let taskId;
          db.exec('BEGIN');
          try {
            const chiefActive=!!db.prepare("SELECT 1 FROM agents WHERE organization_id=? AND slug='chief' AND enabled=1").get(me.organization_id);
            taskId=queueResearch(db,{organizationId:me.organization_id,ownerId:me.user_id,objective,conversationId,agentId:b.agentId,direct:!!conversationId&&!chiefActive});
            db.exec('COMMIT');
          } catch(e) {db.exec('ROLLBACK');throw e;}
          work();
          return json(res,201,{taskId});
        }
        const directResearch=url.pathname.match(/^\/api\/agents\/([0-9a-f-]+)\/research$/);
        if(directResearch && req.method==='POST') {
          const agent=db.prepare("SELECT id,name,slug FROM agents WHERE id=? AND organization_id=? AND enabled=1 AND deleted_at IS NULL AND slug!='chief'").get(directResearch[1],me.organization_id);
          if(!agent) return fail(res,404,'Available bot not found.');
          const b=await body(req),objective=String(b.objective||'').trim();
          try {validateObjective(objective);} catch(err) {return fail(res,400,err.message);}
          let conversation=db.prepare("SELECT c.id FROM conversations c JOIN conversation_participants cp ON cp.conversation_id=c.id AND cp.organization_id=c.organization_id WHERE c.organization_id=? AND c.kind='direct' AND c.deleted_at IS NULL AND cp.agent_id=?").get(me.organization_id,agent.id);
          let taskId;
          db.exec('BEGIN');
          try {
            if(!conversation) {
              conversation={id:id()};
              db.prepare('INSERT INTO conversations(id,organization_id,title,kind,created_at) VALUES(?,?,?,?,?)').run(conversation.id,me.organization_id,agent.name,'direct',now());
              db.prepare('INSERT INTO conversation_participants VALUES(?,?,?)').run(conversation.id,me.organization_id,agent.id);
              event(db,me.organization_id,null,me.email,'conversation.created',`Direct conversation with ${agent.name} created.`);
            }
            taskId=queueResearch(db,{organizationId:me.organization_id,ownerId:me.user_id,objective,conversationId:conversation.id,agentId:agent.id,direct:true});
            db.exec('COMMIT');
          } catch(err) {db.exec('ROLLBACK');throw err;}
          work();
          return json(res,201,{taskId,conversationId:conversation.id});
        }
        if(url.pathname==='/api/groups' && req.method==='POST') {
          const b=await body(req),title=String(b.title||'').trim(),requested=[...new Set(Array.isArray(b.agentIds)?b.agentIds:[])];
          if(title.length<3||title.length>100) return fail(res,400,'Group title must be 3–100 characters.');
          const members=requested.map(agentId=>db.prepare('SELECT id,slug FROM agents WHERE id=? AND organization_id=? AND enabled=1 AND deleted_at IS NULL').get(agentId,me.organization_id));
          if(members.some(m=>!m)) return fail(res,400,'Choose active bots from this workspace.');
          const chief=db.prepare("SELECT id FROM agents WHERE organization_id=? AND slug='chief' AND enabled=1").get(me.organization_id);
          if(!chief&&!members.length) return fail(res,400,'Activate at least one bot before creating a group.');
          const groupId=id();
          db.exec('BEGIN');
          try {
            db.prepare('INSERT INTO conversations(id,organization_id,title,kind,created_at) VALUES(?,?,?,?,?)').run(groupId,me.organization_id,title,'group',now());
            for(const memberId of new Set([...(chief?[chief.id]:[]),...requested])) db.prepare('INSERT INTO conversation_participants VALUES(?,?,?)').run(groupId,me.organization_id,memberId);
            event(db,me.organization_id,null,me.email,'conversation.created',`Group “${title}” created.`);
            db.exec('COMMIT');
          } catch(e) {db.exec('ROLLBACK');throw e;}
          return json(res,201,{groupId});
        }
        const groupToDelete=url.pathname.match(/^\/api\/groups\/([0-9a-f-]+)$/);
        if(groupToDelete && req.method==='DELETE') {
          const group=db.prepare("SELECT id,title FROM conversations WHERE id=? AND organization_id=? AND kind='group' AND deleted_at IS NULL").get(groupToDelete[1],me.organization_id);
          if(!group) return fail(res,404,'Group not found.');
          db.exec('BEGIN');
          try {
            db.prepare('UPDATE conversations SET deleted_at=? WHERE id=? AND organization_id=?').run(now(),group.id,me.organization_id);
            db.prepare("UPDATE tasks SET status='cancelled',updated_at=? WHERE conversation_id=? AND organization_id=? AND status IN ('queued','running','paused')").run(now(),group.id,me.organization_id);
            event(db,me.organization_id,null,me.email,'conversation.deleted',`Group “${group.title}” removed from Inbox.`);
            db.exec('COMMIT');
          } catch(error) {db.exec('ROLLBACK');throw error;}
          return json(res,200,{ok:true});
        }
        if(url.pathname==='/api/agents' && req.method==='POST') {
          const b=await body(req),name=String(b.name||'').trim(),role=String(b.role||'').trim(),instructions=String(b.instructions||'').trim(),accent=String(b.accent||'#4F46E5').toUpperCase();
          if(name.length<2||name.length>60||role.length<3||role.length>120||instructions.length>3000||!palette.has(accent)) return fail(res,400,'Enter a name, role, valid palette color, and instructions under 3,000 characters.');
          const avatarId=b.avatarId??DEFAULT_AVATAR_ID;
          if(!isValidAvatarId(avatarId)) return fail(res,400,'Choose a valid bot avatar.');
          const agentId=id(),slug=`custom-${agentId}`;
          db.prepare("INSERT INTO agents(id,organization_id,slug,name,role,accent,kind,instructions,enabled,version,avatar_id) VALUES(?,?,?,?,?,?,'custom',?,1,1,?)").run(agentId,me.organization_id,slug,name,role,accent,instructions,avatarId);
          event(db,me.organization_id,null,me.email,'agent.created',`Custom agent “${name}” created without tool grants.`);
          return json(res,201,{agentId});
        }
        const customAvatar=url.pathname.match(/^\/api\/agents\/([0-9a-f-]+)\/avatar$/);
        if(customAvatar && req.method==='PATCH') {
          const agent=db.prepare("SELECT id,name,avatar_id FROM agents WHERE id=? AND organization_id=? AND kind='custom' AND deleted_at IS NULL").get(customAvatar[1],me.organization_id);
          if(!agent) return fail(res,404,'Custom agent not found.');
          const b=await body(req);
          if(!isValidAvatarId(b.avatarId)) return fail(res,400,'Choose a valid bot avatar.');
          db.prepare('UPDATE agents SET avatar_id=? WHERE id=? AND organization_id=?').run(b.avatarId,agent.id,me.organization_id);
          event(db,me.organization_id,null,me.email,'agent.avatar_changed',`Visual avatar for “${agent.name}” changed.`);
          return json(res,200,{ok:true,avatarId:b.avatarId});
        }
        const custom=url.pathname.match(/^\/api\/agents\/([0-9a-f-]+)$/);
        if(custom && req.method==='DELETE') {
          const agent=db.prepare("SELECT id,name FROM agents WHERE id=? AND organization_id=? AND kind='custom' AND deleted_at IS NULL").get(custom[1],me.organization_id);
          if(!agent) return fail(res,404,'Deletable custom agent not found.');
          db.exec('BEGIN');
          try {
            const pending=db.prepare("SELECT * FROM tasks WHERE agent_id=? AND organization_id=? AND status IN ('queued','running','paused')").all(agent.id,me.organization_id);
            for(const task of pending) {
              db.prepare("UPDATE tasks SET status='cancelled',updated_at=? WHERE id=? AND organization_id=?").run(now(),task.id,me.organization_id);
              finishScheduledTask(db,task,'cancelled');
            }
            db.prepare('UPDATE schedules SET enabled=0,updated_at=? WHERE agent_id=? AND organization_id=?').run(now(),agent.id,me.organization_id);
            db.prepare('UPDATE agents SET enabled=0,deleted_at=? WHERE id=? AND organization_id=?').run(now(),agent.id,me.organization_id);
            event(db,me.organization_id,null,me.email,'agent.deleted',`Custom agent “${agent.name}” deleted. Historical work retained.`);
            db.exec('COMMIT');
          } catch(err) {db.exec('ROLLBACK');throw err;}
          return json(res,200,{ok:true});
        }
        if(custom && req.method==='PATCH') {
          const agent=db.prepare("SELECT * FROM agents WHERE id=? AND organization_id=? AND kind='custom' AND deleted_at IS NULL").get(custom[1],me.organization_id);
          if(!agent) return fail(res,404,'Custom agent not found.');
          const b=await body(req),name=String(b.name??agent.name).trim(),role=String(b.role??agent.role).trim(),instructions=String(b.instructions??agent.instructions).trim(),accent=String(b.accent??agent.accent).toUpperCase();
          if(name.length<2||name.length>60||role.length<3||role.length>120||instructions.length>3000||!palette.has(accent)) return fail(res,400,'Invalid custom agent configuration.');
          db.prepare('UPDATE agents SET name=?,role=?,instructions=?,accent=?,version=version+1 WHERE id=? AND organization_id=?').run(name,role,instructions,accent,agent.id,me.organization_id);
          event(db,me.organization_id,null,me.email,'agent.updated',`Custom agent “${name}” configuration changed to version ${agent.version+1}.`);
          return json(res,200,{ok:true,version:agent.version+1});
        }
        const customAction=url.pathname.match(/^\/api\/agents\/([0-9a-f-]+)\/(disable|enable)$/);
        if(customAction && req.method==='POST') {
          const agent=db.prepare("SELECT * FROM agents WHERE id=? AND organization_id=? AND kind='custom' AND deleted_at IS NULL").get(customAction[1],me.organization_id);
          if(!agent) return fail(res,404,'Custom agent not found.');
          const enabled=customAction[2]==='enable'?1:0;
          db.prepare('UPDATE agents SET enabled=? WHERE id=? AND organization_id=?').run(enabled,agent.id,me.organization_id);
          event(db,me.organization_id,null,me.email,`agent.${customAction[2]}d`,`Custom agent “${agent.name}” ${enabled?'enabled':'disabled'}.`);
          return json(res,200,{ok:true,enabled:!!enabled});
        }
        const builtInAction=url.pathname.match(/^\/api\/agents\/([0-9a-f-]+)\/(activate|deactivate)$/);
        if(builtInAction && req.method==='POST') {
          const agent=db.prepare("SELECT id,name,enabled FROM agents WHERE id=? AND organization_id=? AND kind='built_in'").get(builtInAction[1],me.organization_id);
          if(!agent) return fail(res,404,'Built-in bot not found.');
          const enabled=builtInAction[2]==='activate'?1:0;
          db.prepare('UPDATE agents SET enabled=?,activation_state=1 WHERE id=? AND organization_id=?').run(enabled,agent.id,me.organization_id);
          event(db,me.organization_id,null,me.email,`agent.${builtInAction[2]}d`,`Built-in bot “${agent.name}” ${enabled?'activated':'deactivated'}.`);
          return json(res,200,{ok:true,enabled:!!enabled});
        }
        if(url.pathname==='/api/missions' && req.method==='POST') {
          const b=await body(req),title=String(b.title||'').trim(),objective=String(b.objective||'').trim();
          if(title.length<3||title.length>100) return fail(res,400,'Mission title must be 3–100 characters.');
          try {validateObjective(objective);} catch(err) {return fail(res,400,err.message);}
          const missionId=id();
          db.prepare("INSERT INTO missions VALUES(?,?,?,?,?,'draft',?,?)").run(missionId,me.organization_id,title,objective,JSON.stringify([]),now(),now());
          event(db,me.organization_id,null,me.email,'mission.created',`Mission “${title}” drafted.`);
          return json(res,201,{missionId});
        }
        const missionAction=url.pathname.match(/^\/api\/missions\/([0-9a-f-]+)\/(propose|activate|cancel)$/);
        if(missionAction && req.method==='POST') {
          const mission=db.prepare('SELECT * FROM missions WHERE id=? AND organization_id=?').get(missionAction[1],me.organization_id);
          if(!mission) return fail(res,404,'Mission not found.');
          const action=missionAction[2],allowed={propose:['draft'],activate:['proposed'],cancel:['draft','proposed','active','blocked']};
          if(!allowed[action].includes(mission.status)) return fail(res,409,`Cannot ${action} a ${mission.status} mission.`);
          if(action==='activate'&&!db.prepare("SELECT 1 FROM agents WHERE organization_id=? AND slug='chief' AND enabled=1").get(me.organization_id)) return fail(res,409,'Activate CHIEF in AI Workforce before starting a mission.');
          let taskId=null;
          db.exec('BEGIN');
          try {
            if(action==='propose') {
              const plan=['Confirm the objective and public source scope','Delegate one bounded research task to Intelligence Manager','Review cited results and close the mission'];
              db.prepare("UPDATE missions SET status='proposed',plan=?,updated_at=? WHERE id=? AND organization_id=?").run(JSON.stringify(plan),now(),mission.id,me.organization_id);
              event(db,me.organization_id,null,'chief','mission.proposed',`Research plan proposed for “${mission.title}”.`);
            } else if(action==='activate') {
              db.prepare("UPDATE missions SET status='active',updated_at=? WHERE id=? AND organization_id=?").run(now(),mission.id,me.organization_id);
              taskId=queueResearch(db,{organizationId:me.organization_id,ownerId:me.user_id,objective:mission.objective,missionId:mission.id});
              event(db,me.organization_id,taskId,me.email,'mission.activated',`Mission “${mission.title}” activated by owner.`);
            } else {
              db.prepare("UPDATE missions SET status='cancelled',updated_at=? WHERE id=? AND organization_id=?").run(now(),mission.id,me.organization_id);
              db.prepare("UPDATE tasks SET status='cancelled',updated_at=? WHERE mission_id=? AND organization_id=? AND status IN ('queued','running','paused')").run(now(),mission.id,me.organization_id);
              event(db,me.organization_id,null,me.email,'mission.cancelled',`Mission “${mission.title}” cancelled.`);
            }
            db.exec('COMMIT');
          } catch(e) {db.exec('ROLLBACK');throw e;}
          if(taskId) work();
          return json(res,200,{ok:true,taskId});
        }
        if(url.pathname==='/api/reports/generate' && req.method==='POST') {
          const b=await body(req);
          try {return json(res,200,generateDailyReport(db,me.organization_id,b.date,b.type));}
          catch(err) {return fail(res,400,err.message);}
        }
        if(url.pathname==='/api/schedules' && req.method==='POST') {
          const b=await body(req);
          try {return json(res,201,createSchedule(db,me.organization_id,me.user_id,b));}
          catch(err) {return fail(res,400,err.message);}
        }
        const scheduleAction=url.pathname.match(/^\/api\/schedules\/([0-9a-f-]+)\/(enable|disable)$/);
        if(scheduleAction && req.method==='POST') {
          const result=setScheduleEnabled(db,me.organization_id,scheduleAction[1],scheduleAction[2]==='enable');
          return result?json(res,200,result):fail(res,404,'Routine not found.');
        }
        const notificationAction=url.pathname.match(/^\/api\/notifications\/([0-9a-f-]+)\/read$/);
        if(notificationAction && req.method==='POST') {
          const result=db.prepare('UPDATE notifications SET read_at=? WHERE id=? AND organization_id=? AND read_at IS NULL').run(now(),notificationAction[1],me.organization_id);
          return result.changes?json(res,200,{ok:true}):fail(res,404,'Unread notification not found.');
        }
        if(url.pathname==='/api/settings/timezone' && req.method==='PATCH') {
          const b=await body(req),timezone=String(b.timezone||'');
          try {new Intl.DateTimeFormat('en',{timeZone:timezone});} catch {return fail(res,400,'Invalid IANA timezone.');}
          db.exec('BEGIN');
          try {
            db.prepare('UPDATE organizations SET timezone=? WHERE id=?').run(timezone,me.organization_id);
            rescheduleOrganization(db,me.organization_id,timezone);
            event(db,me.organization_id,null,me.email,'organization.timezone_changed',`Organization timezone set to ${timezone}.`);
            db.exec('COMMIT');
          } catch(err) {db.exec('ROLLBACK');throw err;}
          return json(res,200,{ok:true,timezone});
        }
        if(url.pathname==='/api/contacts' && req.method==='POST') {
          const b=await body(req),name=String(b.name||'').trim();
          if(name.length<2||name.length>100) return fail(res,400,'Contact name must be 2–100 characters.');
          const contactId=id();
          db.prepare("INSERT INTO contacts(id,organization_id,name,note,version,created_at,updated_at) VALUES(?,?,?,'',1,?,?)").run(contactId,me.organization_id,name,now(),now());
          event(db,me.organization_id,null,me.email,'contact.created',`Local contact ${contactId} created.`);
          return json(res,201,{contactId});
        }
        const noteProposal=url.pathname.match(/^\/api\/contacts\/([0-9a-f-]+)\/propose-note$/);
        if(noteProposal && req.method==='POST') {
          const b=await body(req);
          try {const approval=proposeNote(db,me.organization_id,noteProposal[1],b.note,me.email);return json(res,201,{approvalId:approval.id,actionHash:approval.action_hash});}
          catch(err) {if(err instanceof ActionError) return fail(res,err.status,err.message);throw err;}
        }
        const approvalDecision=url.pathname.match(/^\/api\/approvals\/([0-9a-f-]+)\/(approve|reject)$/);
        if(approvalDecision && req.method==='POST') {
          const b=await body(req);
          try {return json(res,200,decideApproval(db,me.organization_id,approvalDecision[1],approvalDecision[2],b.actionHash,me.email));}
          catch(err) {if(err instanceof ActionError) return fail(res,err.status,err.message);throw err;}
        }
        const match=url.pathname.match(/^\/api\/tasks\/([0-9a-f-]+)\/(pause|resume|cancel)$/);
        if(match && req.method==='POST') {
          const task=db.prepare('SELECT * FROM tasks WHERE id=? AND organization_id=?').get(match[1],me.organization_id);
          if(!task) return fail(res,404,'Task not found.');
          const action=match[2],allowed={pause:['queued','running'],resume:['paused'],cancel:['queued','running','paused']};
          if(!allowed[action].includes(task.status)) return fail(res,409,`Cannot ${action} a ${task.status} task.`);
          const status={pause:'paused',resume:'queued',cancel:'cancelled'}[action];
          updateTask(db,task,status,me.email,`task.${status}`,`Owner ${{pause:'paused',resume:'resumed',cancel:'cancelled'}[action]} the task.`);
          if(action==='cancel') finishScheduledTask(db,task,'cancelled');
          if(action==='cancel'&&task.mission_id) {
            db.prepare("UPDATE missions SET status='cancelled',updated_at=? WHERE id=? AND organization_id=? AND status='active'").run(now(),task.mission_id,me.organization_id);
            event(db,me.organization_id,task.id,me.email,'mission.cancelled','Owner cancelled the mission task.');
          }
          if(action==='resume') work();
          return json(res,200,{ok:true,status});
        }
        return fail(res,404,'Not found.');
      }
      if(req.method!=='GET') return fail(res,405,'Method not allowed.');
      const path=url.pathname==='/'?'/index.html':url.pathname;
      const file=resolve(root,`.${decodeURIComponent(path)}`);
      if(!(file===root||file.startsWith(root+sep))) return fail(res,403,'Forbidden.');
      try {const bytes=await readFile(file);res.writeHead(200,{'Content-Type':mime[extname(file)]||'application/octet-stream','X-Content-Type-Options':'nosniff','Cache-Control':path.startsWith('/assets/bot-avatars/')?'public, max-age=86400':'no-cache'});res.end(bytes);}
      catch {fail(res,404,'Not found.');}
    } catch(err) {fail(res,400,String(err?.message||err).slice(0,300));}
  });
  return {server,db,close:async()=>{closed=true;clearInterval(timer);clearInterval(scheduleTimer);if(inFlight) await inFlight;await new Promise(resolve=>server.close(resolve));db.close();},work,runSchedules};
}

if(process.argv[1] && resolve(process.argv[1])===fileURLToPath(import.meta.url)) {
  const projectRoot=resolve('.');
  const databasePath=resolve(projectRoot,process.env.COLLEAGUE_ZERO_DB||'data/build-bot-colleague-zero.sqlite');
  if(!(databasePath===projectRoot||databasePath.startsWith(projectRoot+sep))) throw new Error('COLLEAGUE_ZERO_DB must stay inside the BUILD BOT 2.0 project directory.');
  const app=createApp({
    databasePath,
    fixtureResearch:process.env.COLLEAGUE_ZERO_RESEARCH_FIXTURE==='1',
    searchApiKey:process.env.COLLEAGUE_ZERO_BRAVE_SEARCH_API_KEY
  });
  const port=Number(process.env.COLLEAGUE_ZERO_PORT||3005);
  app.server.listen(port,()=>console.log(`BUILD BOT 2.0 hackathon copy at http://localhost:${port}`));
}
