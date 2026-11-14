import { createHash, randomBytes } from 'node:crypto';
import { id, now } from './store.mjs';
import { ComputerProviderError } from './computer-provider.mjs';

const hash=value=>createHash('sha256').update(value).digest('hex');
const activeLease=db=>db.prepare("SELECT * FROM computer_leases WHERE computer_id=? AND released_at IS NULL AND expires_at>?");

export class ComputerActionError extends Error {constructor(message,status=400){super(message);this.status=status;}}
function scopedComputer(db,organizationId,computerId){const row=db.prepare('SELECT * FROM computers WHERE id=? AND organization_id=?').get(computerId,organizationId);if(!row)throw new ComputerActionError('Computer not found.',404);return row;}
function record(db,computer,actor,eventType,detail,sessionId=null){db.prepare('INSERT INTO computer_events(id,organization_id,computer_id,session_id,actor,event_type,detail,created_at) VALUES(?,?,?,?,?,?,?,?)').run(id(),computer.organization_id,computer.id,sessionId,actor,eventType,detail,now());}
function cleanExpiredLeases(db,computerId){db.prepare("UPDATE computer_leases SET released_at=? WHERE computer_id=? AND released_at IS NULL AND expires_at<=?").run(now(),computerId,now());}

async function enforceProviderCapacity(db,provider,{computerId,actor}){
  const limit=Number(provider.maxRunningComputers);if(!Number.isFinite(limit)||limit<1)return;
  const others=db.prepare("SELECT * FROM computers WHERE id!=? AND state='running' ORDER BY updated_at").all(computerId);
  if(others.length<limit)return;
  const idle=[];
  for(const other of others){cleanExpiredLeases(db,other.id);if(!activeLease(db).get(other.id,now()))idle.push(other);}
  const stopCount=others.length-limit+1;
  if(idle.length<stopCount)throw new ComputerActionError(`This local computer can run ${limit} bot computer${limit===1?'':'s'} smoothly at a time. Release control of the active computer before starting another.`,409);
  for(const other of idle.slice(0,stopCount))await controlComputer(db,provider,{organizationId:other.organization_id,computerId:other.id,action:'stop',actor});
}

export async function startComputer(db,provider,{organizationId,computerId,ownerId,actor}){
  let computer=scopedComputer(db,organizationId,computerId);
  const availability=await provider.available();if(!availability.available)throw new ComputerActionError(availability.error||'Computer provider unavailable.',503);
  if(['running','paused'].includes(computer.state)&&provider.status){
    try{
      const runtime=await provider.status(computer);
      if(runtime.state===computer.state){
        if(runtime.hostPort&&runtime.hostPort!==computer.host_port){db.prepare('UPDATE computers SET host_port=?,last_error=NULL,updated_at=? WHERE id=? AND organization_id=?').run(runtime.hostPort,now(),computer.id,organizationId);computer=scopedComputer(db,organizationId,computer.id);}
        return {computer,session:db.prepare("SELECT * FROM computer_sessions WHERE computer_id=? AND state IN ('running','paused') ORDER BY started_at DESC LIMIT 1").get(computer.id)};
      }
      const timestamp=now();
      db.prepare("UPDATE computers SET state='stopped',host_port=NULL,last_error=NULL,updated_at=? WHERE id=? AND organization_id=?").run(timestamp,computer.id,organizationId);
      db.prepare("UPDATE computer_sessions SET state='closed',ended_at=? WHERE computer_id=? AND organization_id=? AND ended_at IS NULL").run(timestamp,computer.id,organizationId);
      record(db,computer,actor,'computer.runtime_reconciled',`Recorded ${computer.state} state was stale; Docker reported ${runtime.state}.`);
      computer=scopedComputer(db,organizationId,computer.id);
      if(runtime.state==='missing')computer={...computer,provider_ref:null};
    }catch(error){
      const message=String(error?.message||error).slice(0,500);db.prepare("UPDATE computers SET state='failed',host_port=NULL,last_error=?,updated_at=? WHERE id=? AND organization_id=?").run(message,now(),computer.id,organizationId);throw error instanceof ComputerProviderError?new ComputerActionError(message,error.status):error;
    }
  }else if(['running','paused'].includes(computer.state))return {computer,session:db.prepare("SELECT * FROM computer_sessions WHERE computer_id=? AND state IN ('running','paused') ORDER BY started_at DESC LIMIT 1").get(computer.id)};
  await enforceProviderCapacity(db,provider,{computerId:computer.id,actor});
  db.prepare("UPDATE computers SET state='provisioning',last_error=NULL,updated_at=? WHERE id=? AND organization_id=?").run(now(),computer.id,organizationId);
  try {
    let provisioned={providerRef:computer.provider_ref,volumeRef:computer.volume_ref};
    if(!computer.provider_ref||!computer.volume_ref)provisioned=await provider.provision(computer);
    computer={...computer,provider_ref:provisioned.providerRef,volume_ref:provisioned.volumeRef};
    const running=await provider.start(computer),timestamp=now(),sessionId=id();
    db.exec('BEGIN');try{
      db.prepare("UPDATE computers SET provider=?,provider_ref=?,volume_ref=?,host_port=?,state='running',last_error=NULL,updated_at=? WHERE id=? AND organization_id=?").run(provider.kind,running.providerRef,running.volumeRef,running.hostPort,timestamp,computer.id,organizationId);
      db.prepare("INSERT INTO computer_sessions(id,organization_id,computer_id,owner_id,state,control_owner,provider_session_ref,started_at) VALUES(?,?,?,?, 'running','agent',?,?)").run(sessionId,organizationId,computer.id,ownerId,running.providerRef,timestamp);
      record(db,computer,actor,'computer.started','Isolated Linux computer started.',sessionId);db.exec('COMMIT');
    }catch(error){db.exec('ROLLBACK');throw error;}
    return {computer:scopedComputer(db,organizationId,computer.id),session:db.prepare('SELECT * FROM computer_sessions WHERE id=?').get(sessionId)};
  }catch(error){const message=String(error?.message||error).slice(0,500);db.prepare("UPDATE computers SET state='failed',last_error=?,updated_at=? WHERE id=? AND organization_id=?").run(message,now(),computer.id,organizationId);record(db,computer,actor,'computer.failed',message);throw error instanceof ComputerProviderError?new ComputerActionError(message,error.status):error;}
}

export async function controlComputer(db,provider,{organizationId,computerId,action,actor}){
  let computer=scopedComputer(db,organizationId,computerId);cleanExpiredLeases(db,computer.id);
  if(action==='stop'){
    if(activeLease(db).get(computer.id,now()))throw new ComputerActionError('Release the active computer lease before stopping this computer.',409);
    await provider.stop(computer);const timestamp=now();db.prepare("UPDATE computers SET state='stopped',host_port=NULL,updated_at=? WHERE id=? AND organization_id=?").run(timestamp,computer.id,organizationId);db.prepare("UPDATE computer_sessions SET state='closed',ended_at=? WHERE computer_id=? AND organization_id=? AND ended_at IS NULL").run(timestamp,computer.id,organizationId);record(db,computer,actor,'computer.stopped','Computer stopped; persistent home volume retained.');
  }else if(action==='pause'){
    if(computer.state!=='running')throw new ComputerActionError(`Cannot pause a ${computer.state} computer.`,409);await provider.pause(computer);db.prepare("UPDATE computers SET state='paused',updated_at=? WHERE id=? AND organization_id=?").run(now(),computer.id,organizationId);db.prepare("UPDATE computer_sessions SET state='paused' WHERE computer_id=? AND organization_id=? AND ended_at IS NULL").run(computer.id,organizationId);record(db,computer,actor,'computer.paused','Computer automation paused.');
  }else if(action==='resume'){
    if(computer.state!=='paused')throw new ComputerActionError(`Cannot resume a ${computer.state} computer.`,409);await provider.resume(computer);db.prepare("UPDATE computers SET state='running',updated_at=? WHERE id=? AND organization_id=?").run(now(),computer.id,organizationId);db.prepare("UPDATE computer_sessions SET state='running' WHERE computer_id=? AND organization_id=? AND ended_at IS NULL").run(computer.id,organizationId);record(db,computer,actor,'computer.resumed','Computer automation resumed.');
  }else if(action==='reset'){
    if(activeLease(db).get(computer.id,now()))throw new ComputerActionError('Release the active computer lease before resetting this computer.',409);const reset=await provider.reset(computer);db.prepare("UPDATE computers SET provider_ref=?,volume_ref=?,host_port=NULL,state='stopped',last_error=NULL,updated_at=? WHERE id=? AND organization_id=?").run(reset.providerRef,reset.volumeRef,now(),computer.id,organizationId);record(db,computer,actor,'computer.reset','Runtime reset; persistent home volume retained.');
  }else throw new ComputerActionError('Unsupported computer action.');
  return scopedComputer(db,organizationId,computer.id);
}

export function acquireComputerLease(db,{organizationId,computerId,sessionId,ownerType,ownerId,actor,ttlMs=5*60_000}){
  const computer=scopedComputer(db,organizationId,computerId);if(computer.state!=='running')throw new ComputerActionError('Start the computer before acquiring a lease.',409);cleanExpiredLeases(db,computer.id);
  if(activeLease(db).get(computer.id,now()))throw new ComputerActionError('This computer already has an active automation or owner-control lease.',409);
  const session=sessionId?db.prepare("SELECT * FROM computer_sessions WHERE id=? AND computer_id=? AND organization_id=? AND ended_at IS NULL").get(sessionId,computer.id,organizationId):db.prepare("SELECT * FROM computer_sessions WHERE computer_id=? AND organization_id=? AND ended_at IS NULL ORDER BY started_at DESC LIMIT 1").get(computer.id,organizationId);if(!session)throw new ComputerActionError('Active computer session not found.',409);
  const token=randomBytes(32).toString('base64url'),leaseId=id(),expiresAt=new Date(Date.now()+Math.max(30_000,Math.min(ttlMs,15*60_000))).toISOString();
  db.prepare('INSERT INTO computer_leases(id,organization_id,computer_id,session_id,owner_type,owner_id,token_hash,expires_at,created_at) VALUES(?,?,?,?,?,?,?,?,?)').run(leaseId,organizationId,computer.id,session.id,ownerType,ownerId,hash(token),expiresAt,now());db.prepare('UPDATE computer_sessions SET control_owner=? WHERE id=?').run(ownerType,session.id);record(db,computer,actor,'computer.lease_acquired',`${ownerType} acquired exclusive control.`,session.id);return {leaseId,token,expiresAt,sessionId:session.id};
}
export function releaseComputerLease(db,{organizationId,computerId,actor}){const computer=scopedComputer(db,organizationId,computerId),lease=activeLease(db).get(computer.id,now());if(!lease)throw new ComputerActionError('Active lease not found.',404);db.prepare('UPDATE computer_leases SET released_at=? WHERE id=? AND organization_id=?').run(now(),lease.id,organizationId);db.prepare("UPDATE computer_sessions SET control_owner='agent' WHERE id=?").run(lease.session_id);record(db,computer,actor,'computer.lease_released','Exclusive control returned to the agent.',lease.session_id);return {ok:true};}

export function issueStreamToken(db,{organizationId,computerId}){const computer=scopedComputer(db,organizationId,computerId);if(computer.state!=='running'||!computer.host_port)throw new ComputerActionError('Start the computer before opening its live view.',409);const session=db.prepare("SELECT * FROM computer_sessions WHERE computer_id=? AND organization_id=? AND ended_at IS NULL ORDER BY started_at DESC LIMIT 1").get(computer.id,organizationId);if(!session)throw new ComputerActionError('Active computer session not found.',409);cleanExpiredLeases(db,computer.id);const lease=activeLease(db).get(computer.id,now()),canControl=lease?.owner_type==='owner';const token=randomBytes(32).toString('base64url'),expiresAt=new Date(Date.now()+5*60_000).toISOString();db.prepare('DELETE FROM computer_stream_tokens WHERE expires_at<=?').run(now());db.prepare('INSERT INTO computer_stream_tokens(token_hash,organization_id,computer_id,session_id,expires_at,created_at) VALUES(?,?,?,?,?,?)').run(hash(token),organizationId,computer.id,session.id,expiresAt,now());return {token,expiresAt,sessionId:session.id,canControl,viewUrl:`/computer-stream/${token}/vnc.html?autoconnect=1&resize=scale&view_only=${canControl?'0':'1'}&path=computer-stream/${token}/websockify`};}
export function resolveStreamToken(db,token){return db.prepare(`SELECT st.*,c.host_port,c.state FROM computer_stream_tokens st JOIN computers c ON c.id=st.computer_id AND c.organization_id=st.organization_id WHERE st.token_hash=? AND st.expires_at>? AND c.state='running'`).get(hash(token),now())||null;}
