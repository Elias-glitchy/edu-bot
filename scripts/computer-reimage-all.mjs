import { resolve } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { createDockerComputerProvider } from '../apps/api/computer-provider.mjs';
import { controlComputer, startComputer } from '../apps/api/computers.mjs';
import { now } from '../apps/api/store.mjs';

const db=new DatabaseSync(resolve(process.env.COLLEAGUE_ZERO_DB||'data/build-bot-colleague-zero.sqlite'));
const provider=createDockerComputerProvider();

try{
  const available=await provider.available();
  if(!available.available)throw new Error(available.error||'Docker is unavailable.');
  const computers=db.prepare(`SELECT c.*,a.name,a.slug,o.name AS organization_name FROM computers c JOIN agents a ON a.id=c.agent_id AND a.organization_id=c.organization_id JOIN organizations o ON o.id=c.organization_id WHERE a.deleted_at IS NULL AND a.archived_at IS NULL AND c.provider_ref IS NOT NULL ORDER BY o.name,CASE WHEN a.slug='chief' THEN 0 ELSE 1 END,a.name`).all();
  if(!computers.length)throw new Error('No provisioned bot computers were found.');
  for(const computer of computers){
    const restoreState=computer.state,activeSession=db.prepare("SELECT owner_id FROM computer_sessions WHERE computer_id=? AND organization_id=? AND ended_at IS NULL ORDER BY started_at DESC LIMIT 1").get(computer.id,computer.organization_id),owner=db.prepare("SELECT u.id FROM users u JOIN memberships m ON m.user_id=u.id WHERE m.organization_id=? ORDER BY u.email LIMIT 1").get(computer.organization_id);
    await provider.destroy(computer,{deleteVolume:false});
    const provisioned=await provider.provision({...computer,provider_ref:null});
    const timestamp=now();db.exec('BEGIN');try{
      db.prepare("UPDATE computer_leases SET released_at=? WHERE computer_id=? AND released_at IS NULL").run(timestamp,computer.id);
      db.prepare("UPDATE computer_sessions SET state='closed',ended_at=? WHERE computer_id=? AND organization_id=? AND ended_at IS NULL").run(timestamp,computer.id,computer.organization_id);
      db.prepare('DELETE FROM computer_stream_tokens WHERE computer_id=? AND organization_id=?').run(computer.id,computer.organization_id);
      db.prepare("UPDATE computers SET provider_ref=?,volume_ref=?,host_port=NULL,state='stopped',last_error=NULL,updated_at=? WHERE id=? AND organization_id=?").run(provisioned.providerRef,provisioned.volumeRef,timestamp,computer.id,computer.organization_id);
      db.exec('COMMIT');
    }catch(error){db.exec('ROLLBACK');throw error;}
    if(['running','paused'].includes(restoreState)){
      await startComputer(db,provider,{organizationId:computer.organization_id,computerId:computer.id,ownerId:activeSession?.owner_id||owner?.id||'system',actor:'system:computer-reimage'});
      if(restoreState==='paused')await controlComputer(db,provider,{organizationId:computer.organization_id,computerId:computer.id,action:'pause',actor:'system:computer-reimage'});
    }
    console.log(`REIMAGED  ${computer.organization_name} / ${computer.name} · volume retained · restored ${restoreState}`);
  }
  console.log(`PASS  Reimaged all ${computers.length} bot computers without deleting persistent volumes.`);
}finally{db.close();}
