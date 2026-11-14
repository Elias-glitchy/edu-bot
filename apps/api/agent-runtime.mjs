import { createHash } from 'node:crypto';
import { acquireComputerLease, releaseComputerLease } from './computers.mjs';
import { validatePublicUrl } from './live-tools.mjs';
import { id, now } from './store.mjs';

const POLICY_VERSION=1;
const hash=value=>createHash('sha256').update(value).digest('hex');
const json=value=>JSON.stringify(value);
const parseArgs=value=>{try{return typeof value==='string'?JSON.parse(value||'{}'):(value||{});}catch{throw new Error('Tool arguments are invalid JSON.');}};

export const GEMINI_AGENT_TOOLS=Object.freeze([
  {type:'function',function:{name:'computer_status',description:'Read the assigned Linux computer state. This never starts or changes it.',parameters:{type:'object',properties:{},additionalProperties:false}}},
  {type:'function',function:{name:'computer_read',description:'Perform one read-only browser action on the assigned running computer.',parameters:{type:'object',properties:{action:{type:'string',enum:['navigate','text','screenshot']},url:{type:'string',description:'Required only for navigate; must be a public HTTPS URL.'}},required:['action'],additionalProperties:false}}},
  {type:'function',function:{name:'computer_propose_action',description:'Propose a browser click, text fill, or credential fill. It will not execute until the owner approves the exact action.',parameters:{type:'object',properties:{action:{type:'string',enum:['click','fill','fill_credential']},selector:{type:'string'},value:{type:'string',description:'Non-secret text for fill only.'},credentialLeaseId:{type:'string',description:'Short-lived broker lease for fill_credential.'},credentialField:{type:'string'},reason:{type:'string'}},required:['action','selector','reason'],additionalProperties:false}}}
]);

function assignedComputer(db,organizationId,agentId){const computer=db.prepare('SELECT * FROM computers WHERE organization_id=? AND agent_id=?').get(organizationId,agentId);if(!computer)throw new Error('Assigned computer not found.');return computer;}
function safeSelector(value){const selector=String(value||'').trim();if(!selector||selector.length>500)throw new Error('A selector between 1 and 500 characters is required.');return selector;}
function recordStep(db,{organizationId,runId,sequence,type,toolName,input,output,status}){db.prepare('INSERT INTO agent_run_steps(id,organization_id,run_id,sequence,step_type,tool_name,input_json,output_json,status,created_at) VALUES(?,?,?,?,?,?,?,?,?,?)').run(id(),organizationId,runId,sequence,type,toolName,input===undefined?null:json(input),output===undefined?null:json(output),status,now());db.prepare('UPDATE agent_runs SET step_count=?,updated_at=? WHERE id=? AND organization_id=?').run(sequence,now(),runId,organizationId);}

export function beginAgentRun(db,{organizationId,agentId,conversationId=null,provider='gemini',model='gemini-3.1-flash-lite',objective,maxSteps=6}){const runId=id(),timestamp=now();db.prepare("INSERT INTO agent_runs(id,organization_id,agent_id,conversation_id,provider,model,objective,status,step_count,max_steps,created_at,updated_at) VALUES(?,?,?,?,?,?,?,'running',0,?,?,?)").run(runId,organizationId,agentId,conversationId,provider,model,String(objective).slice(0,4000),Math.max(1,Math.min(maxSteps,12)),timestamp,timestamp);return db.prepare('SELECT * FROM agent_runs WHERE id=?').get(runId);}
export function finishAgentRun(db,{organizationId,runId,status='completed',error=null}){db.prepare('UPDATE agent_runs SET status=?,error=?,updated_at=? WHERE id=? AND organization_id=?').run(status,error?String(error).slice(0,1000):null,now(),runId,organizationId);return db.prepare('SELECT * FROM agent_runs WHERE id=? AND organization_id=?').get(runId,organizationId);}

export function createAgentToolExecutor({db,provider,credentialBroker,organizationId,agent,ownerId,actor,runId,lookupImpl}){
  let sequence=0;
  return async(name,rawArguments)=>{
    const input=parseArgs(rawArguments),computer=assignedComputer(db,organizationId,agent.id);sequence+=1;
    try{
      let output;
      if(name==='computer_status')output={computerId:computer.id,state:computer.state,ready:computer.state==='running',controlOwner:db.prepare("SELECT owner_type FROM computer_leases WHERE computer_id=? AND released_at IS NULL AND expires_at>? ORDER BY created_at DESC LIMIT 1").get(computer.id,now())?.owner_type||null};
      else if(name==='computer_read'){
        if(computer.state!=='running')throw new Error('The assigned computer is not running. Ask the owner to start it.');
        if(!['navigate','text','screenshot'].includes(input.action))throw new Error('Read-only computer action denied.');
        if(input.action==='navigate')await validatePublicUrl(String(input.url||''),{lookupImpl});
        const lease=acquireComputerLease(db,{organizationId,computerId:computer.id,ownerType:'agent',ownerId:agent.id,actor,ttlMs:90_000});
        try{
          output=await provider.browserAction(computer,{action:input.action,...(input.action==='navigate'?{url:String(input.url)}:{})});
          if(output?.pngBase64){const bytes=Buffer.from(output.pngBase64,'base64');output={url:output.url,title:output.title,screenshot:{sha256:hash(bytes),bytes:bytes.length,discardedAfterCapture:true}};}
        }finally{releaseComputerLease(db,{organizationId,computerId:computer.id,actor});}
      }else if(name==='computer_propose_action'){
        if(!['click','fill','fill_credential'].includes(input.action))throw new Error('Unsupported proposed action.');
        const payload={action:input.action,selector:safeSelector(input.selector),reason:String(input.reason||'').trim().slice(0,500)};
        if(!payload.reason)throw new Error('Explain why this action is needed.');
        if(input.action==='fill'){
          payload.value=String(input.value??'');if(!payload.value||payload.value.length>4000)throw new Error('Non-secret fill text must be between 1 and 4,000 characters.');
        }
        if(input.action==='fill_credential'){
          payload.credentialLeaseId=String(input.credentialLeaseId||'');payload.credentialField=String(input.credentialField||'');
          if(!payload.credentialLeaseId||!payload.credentialField)throw new Error('Credential lease and field are required.');
        }
        const proposalId=id(),createdAt=now(),expiresAt=new Date(Date.now()+10*60_000).toISOString(),actionHash=hash(json({organizationId,agentId:agent.id,computerId:computer.id,payload,policyVersion:POLICY_VERSION,expiresAt}));
        db.prepare("INSERT INTO agent_action_proposals(id,organization_id,run_id,agent_id,computer_id,action_type,action_hash,payload,status,policy_version,created_at,expires_at) VALUES(?,?,?,?,?,?,?,?, 'pending',?,?,?)").run(proposalId,organizationId,runId,agent.id,computer.id,input.action,actionHash,json(payload),POLICY_VERSION,createdAt,expiresAt);
        output={approvalRequired:true,proposalId,actionHash,expiresAt,summary:`Approval required for ${input.action} on ${payload.selector}.`};
      }else throw new Error('Tool is not allowlisted.');
      recordStep(db,{organizationId,runId,sequence,type:'tool',toolName:name,input,output,status:'completed'});return output;
    }catch(error){const output={error:String(error?.message||error).slice(0,500)};recordStep(db,{organizationId,runId,sequence,type:'tool',toolName:name,input,output,status:'failed'});return output;}
  };
}

export async function decideAgentAction(db,provider,credentialBroker,{organizationId,proposalId,decision,actionHash,actor}){
  const proposal=db.prepare('SELECT * FROM agent_action_proposals WHERE id=? AND organization_id=?').get(proposalId,organizationId);if(!proposal)throw new Error('Action proposal not found.');
  if(proposal.status!=='pending')throw new Error('Action proposal is no longer pending.');
  if(proposal.expires_at<=now())throw new Error('Action proposal expired.');
  if(proposal.action_hash!==actionHash)throw new Error('Action changed after it was proposed.');
  const decidedAt=now();
  if(decision==='reject'){db.prepare("UPDATE agent_action_proposals SET status='rejected',decided_at=? WHERE id=? AND organization_id=?").run(decidedAt,proposal.id,organizationId);return {ok:true,status:'rejected'};}
  if(decision!=='approve')throw new Error('Decision must be approve or reject.');
  const computer=db.prepare("SELECT * FROM computers WHERE id=? AND organization_id=? AND agent_id=?").get(proposal.computer_id,organizationId,proposal.agent_id);if(!computer||computer.state!=='running')throw new Error('The assigned computer must be running before approval can execute.');
  const payload=JSON.parse(proposal.payload),lease=acquireComputerLease(db,{organizationId,computerId:computer.id,ownerType:'agent',ownerId:proposal.agent_id,actor,ttlMs:90_000});
  try{
    let actionPayload;
    if(payload.action==='click')actionPayload={action:'click',selector:payload.selector};
    else if(payload.action==='fill')actionPayload={action:'fill',selector:payload.selector,value:payload.value};
    else if(payload.action==='fill_credential')actionPayload={action:'fill',selector:payload.selector,value:credentialBroker.consume({organizationId,leaseId:payload.credentialLeaseId,field:payload.credentialField})};
    else throw new Error('Approved action is unsupported.');
    const result=await provider.browserAction(computer,actionPayload);
    db.prepare("UPDATE agent_action_proposals SET status='executed',decided_at=?,executed_at=?,error=NULL WHERE id=? AND organization_id=?").run(decidedAt,now(),proposal.id,organizationId);
    db.prepare('INSERT INTO computer_events(id,organization_id,computer_id,session_id,actor,event_type,detail,created_at) VALUES(?,?,?,?,?,?,?,?)').run(id(),organizationId,computer.id,lease.sessionId,actor,'computer.approved_action_executed',`${payload.action} executed after exact-action approval.`,now());
    return {ok:true,status:'executed',result};
  }catch(error){db.prepare("UPDATE agent_action_proposals SET status='failed',decided_at=?,error=? WHERE id=? AND organization_id=?").run(decidedAt,String(error?.message||error).slice(0,500),proposal.id,organizationId);throw error;}
  finally{try{releaseComputerLease(db,{organizationId,computerId:computer.id,actor});}catch{}}
}
