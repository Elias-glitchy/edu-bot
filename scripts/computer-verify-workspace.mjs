import { DatabaseSync } from 'node:sqlite';
import { resolve } from 'node:path';
import { createDockerComputerProvider } from '../apps/api/computer-provider.mjs';
import { controlComputer, startComputer } from '../apps/api/computers.mjs';

const db=new DatabaseSync(resolve(process.env.COLLEAGUE_ZERO_DB||'data/build-bot-colleague-zero.sqlite'));
const provider=createDockerComputerProvider();
const sleep=milliseconds=>new Promise(resolveSleep=>setTimeout(resolveSleep,milliseconds));

async function verify(computer,ownerId,{leaveRunning=false}={}){
  const startedAt=performance.now();
  const result=await startComputer(db,provider,{organizationId:computer.organization_id,computerId:computer.id,ownerId,actor:'system:workspace-computer-verification'});
  try{
    const response=await fetch(`http://127.0.0.1:${result.computer.host_port}/vnc.html`,{signal:AbortSignal.timeout(5000)});
    if(!response.ok)throw new Error(`Desktop returned HTTP ${response.status}.`);
    let ready=false,lastError;
    for(let attempt=0;attempt<45;attempt+=1){
      try{await provider.run(['exec',result.computer.provider_ref,'sh','-lc','test -S /tmp/build-bot-browser.sock && test -x /opt/build-bot/launch-chromium.sh && test -f /usr/share/backgrounds/build-bot-home.jpg'],{timeout:20000});ready=true;break;}
      catch(error){lastError=error;await sleep(1000);}
    }
    if(!ready)throw lastError||new Error('Desktop browser service did not become ready.');
    await provider.run(['exec',result.computer.provider_ref,'sh','-lc','! pgrep -x chromium >/dev/null'],{timeout:20000});
    console.log(`PASS  ${computer.name}: home desktop and Chrome launcher ready · ${Math.round(performance.now()-startedAt)} ms`);
  }finally{
    if(!leaveRunning){
      const current=db.prepare('SELECT state FROM computers WHERE id=? AND organization_id=?').get(computer.id,computer.organization_id);
      if(current?.state==='running')await controlComputer(db,provider,{organizationId:computer.organization_id,computerId:computer.id,action:'stop',actor:'system:workspace-computer-verification'});
    }
  }
}

try{
  const available=await provider.available();if(!available.available)throw new Error(available.error||'Docker is unavailable.');
  const requested=process.argv[2],latest=db.prepare(`SELECT o.id organization_id,o.name organization,u.id user_id,u.email
    FROM sessions s JOIN users u ON u.id=s.user_id JOIN memberships m ON m.user_id=u.id JOIN organizations o ON o.id=m.organization_id
    WHERE s.expires_at>? ORDER BY s.rowid DESC LIMIT 1`).get(new Date().toISOString());
  const organizationId=requested||latest?.organization_id;if(!organizationId)throw new Error('No active workspace session was found.');
  const organization=db.prepare('SELECT id,name FROM organizations WHERE id=?').get(organizationId);if(!organization)throw new Error('Workspace not found.');
  const owner=latest?.organization_id===organizationId?{id:latest.user_id,email:latest.email}:db.prepare('SELECT u.id,u.email FROM users u JOIN memberships m ON m.user_id=u.id WHERE m.organization_id=? ORDER BY u.email LIMIT 1').get(organizationId);
  const computers=db.prepare(`SELECT c.*,a.name,a.slug FROM computers c JOIN agents a ON a.id=c.agent_id AND a.organization_id=c.organization_id
    WHERE c.organization_id=? AND a.kind='built_in' AND a.deleted_at IS NULL AND a.archived_at IS NULL
    ORDER BY CASE WHEN a.slug='chief' THEN 1 ELSE 0 END,a.name`).all(organizationId);
  if(computers.length!==11)throw new Error(`Expected eleven protected computers; found ${computers.length}.`);
  console.log(`VERIFY  ${organization.name} · ${owner?.email||'workspace owner'} · ${computers.length} computers`);
  for(const computer of computers)await verify(computer,owner?.id||'system',{leaveRunning:computer.slug==='chief'});
  const chief=computers.find(computer=>computer.slug==='chief'),state=db.prepare('SELECT state,host_port,last_error FROM computers WHERE id=?').get(chief.id);
  console.log(`READY  CHIEF remains ${state.state} on desktop port ${state.host_port}; Chromium is closed until its shortcut is opened.`);
}finally{db.close();}
