import { saveAcademicFile, saveArtifact } from './academic-files.mjs';
import { createEducationMission, educationEvent, runNextEducationTask } from './education-missions.mjs';
import { now } from './store.mjs';
import { deflateRawSync, inflateRawSync } from 'node:zlib';

export const HACKATHON_DEMO_SCENARIO='melsoft-verified-assessment';
export const HACKATHON_DEMO_ZIP='EDU_BOT_MELSOFT_LIVE_DEMO_PACK.zip';

const rubric=JSON.stringify({
  rubric_id:'DIGCIT-100',
  title:'Digital Citizenship Practical',
  maximum_points:100,
  criteria:[
    {key:'thesis',title:'Understanding of digital citizenship',max_points:20},
    {key:'privacy',title:'Privacy and account security',max_points:20},
    {key:'respect',title:'Respectful online participation',max_points:20},
    {key:'critical',title:'Source verification and critical thinking',max_points:20},
    {key:'structure',title:'Structure, evidence and examples',max_points:20}
  ]
},null,2);

const roster=`student_id,student_name,course_id,assignment_id
STU-001,Amina Jacobs,DIG-101,PRACTICAL-01
STU-002,Kabelo Mokoena,DIG-101,PRACTICAL-01
STU-003,Lerato Ndlovu,DIG-101,PRACTICAL-01
STU-004,Thabo Naidoo,DIG-101,PRACTICAL-01
STU-005,Naledi Khumalo,DIG-101,PRACTICAL-01
STU-006,Yusuf Daniels,DIG-101,PRACTICAL-01`;

const submissions=[
  ['STU-001','Amina Jacobs','Digital citizenship means making responsible choices online. I use a strong password and privacy settings. I respect classmates, ask consent before sharing a photo, and check an official source and its date before repeating information.'],
  ['STU-002','Kabelo Mokoena','Responsible digital citizenship protects people and information. My example uses a different password for every account, multi-factor authentication, privacy permissions and phishing checks. Respectful communication requires consent before posting a classmate photo and reporting harassment. I verify a claim by comparing an official source, evidence and publication date.'],
  ['STU-003','Lerato Ndlovu','Online safety is important. People should use passwords, keep information private and be kind. Before sharing a headline I check the source. This helps students use the internet responsibly.'],
  ['STU-004','Thabo Naidoo','Digital citizenship combines security, respect and critical thinking. For account security I use a password manager, multi-factor authentication, privacy settings and limited app permissions. I ask consent before sharing photos, communicate kindly and report bullying. I verify information against an official source, author, evidence and date before sharing it.'],
  ['STU-005','Naledi Khumalo','A responsible learner protects privacy and treats classmates with respect. I secure each account with a strong password and authentication. I ask for consent before sharing a photo. I check dates and compare evidence with an official source so that false information is not repeated.'],
  ['STU-006','Yusuf Daniels','Online safety requires responsible decisions. My example checks account permissions, uses multi-factor authentication and recognises phishing. Respect and consent guide communication with every classmate. I verify the source, date and supporting evidence before trusting information, then explain why the official source is more reliable.']
];

export const HACKATHON_DEMO_FILES=[
  {name:'fictional-class-profile.csv',mimeType:'text/csv',category:'roster',content:roster},
  {name:'digital-citizenship-rubric.json',mimeType:'application/json',category:'rubric',content:rubric},
  ...submissions.map(([studentId,studentName,submission],index)=>({
    name:`submission-${String(index+1).padStart(2,'0')}-${studentId.toLowerCase()}.txt`,
    mimeType:'text/plain',
    category:'assignment',
    content:`FICTIONAL HACKATHON DEMONSTRATION\nStudent ID: ${studentId}\nStudent name: ${studentName}\nSubmission:\n${submission}`
  }))
];

export const HACKATHON_DEMO_MANIFEST={
  schemaVersion:1,
  scenarioId:HACKATHON_DEMO_SCENARIO,
  title:'EDU BOT — Verified Assessment Live Demo',
  description:'Fictional Melsoft hackathon data. Upload this ZIP to CHIEF to open the guided live demonstration.',
  safety:{fictionalDataOnly:true,humanApprovalRequired:true,manifestIsDeclarativeData:true},
  files:HACKATHON_DEMO_FILES.map(file=>({path:`files/${file.name}`,name:file.name,mimeType:file.mimeType,category:file.category}))
};

const crcTable=(()=>{const table=new Uint32Array(256);for(let n=0;n<256;n++){let value=n;for(let bit=0;bit<8;bit++)value=(value&1)?0xedb88320^(value>>>1):value>>>1;table[n]=value>>>0;}return table;})();
const crc32=bytes=>{let value=0xffffffff;for(const byte of bytes)value=crcTable[(value^byte)&0xff]^(value>>>8);return (value^0xffffffff)>>>0;};

export function buildHackathonDemoPack(){
  const entries=[{path:'manifest.json',content:JSON.stringify(HACKATHON_DEMO_MANIFEST,null,2)},...HACKATHON_DEMO_FILES.map(file=>({path:`files/${file.name}`,content:file.content}))],locals=[],centrals=[];let offset=0;
  for(const entry of entries){
    const name=Buffer.from(entry.path),bytes=Buffer.from(entry.content),compressed=deflateRawSync(bytes),checksum=crc32(bytes),local=Buffer.alloc(30),central=Buffer.alloc(46);
    local.writeUInt32LE(0x04034b50,0);local.writeUInt16LE(20,4);local.writeUInt16LE(0x800,6);local.writeUInt16LE(8,8);local.writeUInt32LE(checksum,14);local.writeUInt32LE(compressed.length,18);local.writeUInt32LE(bytes.length,22);local.writeUInt16LE(name.length,26);
    central.writeUInt32LE(0x02014b50,0);central.writeUInt16LE(20,4);central.writeUInt16LE(20,6);central.writeUInt16LE(0x800,8);central.writeUInt16LE(8,10);central.writeUInt32LE(checksum,16);central.writeUInt32LE(compressed.length,20);central.writeUInt32LE(bytes.length,24);central.writeUInt16LE(name.length,28);central.writeUInt32LE(offset,42);
    const localEntry=Buffer.concat([local,name,compressed]);locals.push(localEntry);centrals.push(Buffer.concat([central,name]));offset+=localEntry.length;
  }
  const directory=Buffer.concat(centrals),end=Buffer.alloc(22);end.writeUInt32LE(0x06054b50,0);end.writeUInt16LE(entries.length,8);end.writeUInt16LE(entries.length,10);end.writeUInt32LE(directory.length,12);end.writeUInt32LE(offset,16);
  return Buffer.concat([...locals,directory,end]);
}

function unpackDemoFiles(packBytes){
  const bytes=Buffer.isBuffer(packBytes)?packBytes:Buffer.from(packBytes||'');
  if(bytes.subarray(0,2).toString()!=='PK')throw new Error('The uploaded demo pack is not a valid ZIP file.');
  const entries=new Map();let offset=0,totalExpanded=0;
  while(offset+4<=bytes.length){
    const signature=bytes.readUInt32LE(offset);if(signature===0x02014b50||signature===0x06054b50)break;if(signature!==0x04034b50)throw new Error('The demo ZIP structure is invalid.');
    if(entries.size>=32)throw new Error('The demo ZIP contains too many entries.');
    const flags=bytes.readUInt16LE(offset+6),method=bytes.readUInt16LE(offset+8),compressedSize=bytes.readUInt32LE(offset+18),expandedSize=bytes.readUInt32LE(offset+22),nameLength=bytes.readUInt16LE(offset+26),extraLength=bytes.readUInt16LE(offset+28);
    if(flags&1||flags&8)throw new Error('Encrypted or streaming ZIP entries are not accepted for the demo pack.');
    const nameStart=offset+30,nameEnd=nameStart+nameLength,dataStart=nameEnd+extraLength,dataEnd=dataStart+compressedSize;if(dataEnd>bytes.length)throw new Error('The demo ZIP is truncated.');
    const path=bytes.subarray(nameStart,nameEnd).toString('utf8');if(!path||path.includes('\\')||path.startsWith('/')||path.split('/').includes('..'))throw new Error('The demo ZIP contains an unsafe path.');
    const compressed=bytes.subarray(dataStart,dataEnd),content=method===0?Buffer.from(compressed):method===8?inflateRawSync(compressed):null;if(!content)throw new Error('The demo ZIP uses unsupported compression.');
    if(content.length!==expandedSize||crc32(content)!==bytes.readUInt32LE(offset+14))throw new Error(`The demo ZIP entry ${path} failed integrity validation.`);
    totalExpanded+=content.length;if(totalExpanded>10*1024*1024)throw new Error('The demo ZIP expands beyond its safe demonstration-data allowance.');entries.set(path,content);offset=dataEnd;
  }
  const manifestBytes=entries.get('manifest.json');
  if(!manifestBytes){
    const pdfEntries=[...entries.entries()].filter(([path])=>!path.endsWith('/'));
    if(pdfEntries.length!==8||pdfEntries.some(([path,content])=>!path.toLowerCase().endsWith('.pdf')||!content.subarray(0,5).equals(Buffer.from('%PDF-'))))throw new Error('The PDF-only EDU BOT demo pack must contain exactly eight valid PDF files.');
    const files=pdfEntries.map(([path,content])=>{
      const name=path.split('/').at(-1),lower=name.toLowerCase(),category=lower.includes('rubric')?'rubric':lower.includes('roster')?'roster':lower.includes('submission')?'assignment':null;
      if(!category)throw new Error(`The PDF-only demo pack cannot identify the role of ${name}. Use roster, rubric or submission in each PDF filename.`);
      return {name,mimeType:'application/pdf',category,content};
    });
    if(files.filter(file=>file.category==='assignment').length!==6||files.filter(file=>file.category==='rubric').length!==1||files.filter(file=>file.category==='roster').length!==1)throw new Error('The PDF-only demo pack needs one roster PDF, one rubric PDF and six submission PDFs.');
    return files;
  }
  let manifest;try{manifest=JSON.parse(manifestBytes.toString('utf8'));}catch{throw new Error('The demo ZIP manifest is invalid JSON.');}
  if(manifest.schemaVersion!==1||manifest.scenarioId!==HACKATHON_DEMO_SCENARIO||!Array.isArray(manifest.files))throw new Error('This ZIP is not a supported EDU BOT live demo pack.');
  if(manifest.files.length!==8)throw new Error('The EDU BOT demo pack must contain one roster, one rubric and six submissions.');
  const files=manifest.files.map(item=>{
    if(!['assignment','rubric','roster'].includes(item.category)||!String(item.path||'').startsWith('files/'))throw new Error('The demo manifest contains an unsupported file declaration.');
    const content=entries.get(item.path);if(!content)throw new Error(`The demo pack is missing ${item.path}.`);
    return {name:String(item.name||item.path.split('/').at(-1)),mimeType:String(item.mimeType||'application/octet-stream'),category:item.category,content};
  });
  if(files.filter(file=>file.category==='assignment').length!==6||files.filter(file=>file.category==='rubric').length!==1||files.filter(file=>file.category==='roster').length!==1)throw new Error('The demo pack has an invalid academic file set.');
  return files;
}

function demoMission(db,organizationId,missionId){
  const mission=db.prepare('SELECT * FROM missions WHERE id=? AND organization_id=?').get(missionId,organizationId);
  if(!mission)throw new Error('Hackathon demo mission not found.');
  const refs=JSON.parse(mission.input_refs||'{}');
  if(refs.scenarioId!==HACKATHON_DEMO_SCENARIO||!refs.manualAdvance)throw new Error('This mission is not a guided hackathon demonstration.');
  return mission;
}

function status(db,organizationId,missionId){
  const mission=demoMission(db,organizationId,missionId);
  const refs=JSON.parse(mission.input_refs||'{}');
  const tasks=db.prepare('SELECT step_key,status,result,error FROM mission_tasks WHERE organization_id=? AND mission_id=? ORDER BY created_at,rowid').all(organizationId,missionId);
  const findings=db.prepare('SELECT issue_type,observed,expected,verification_state FROM qa_findings WHERE organization_id=? AND mission_id=? ORDER BY created_at').all(organizationId,missionId);
  const approval=db.prepare('SELECT id,status FROM education_approvals WHERE organization_id=? AND mission_id=? ORDER BY created_at DESC LIMIT 1').get(organizationId,missionId)||null;
  const proposal=db.prepare('SELECT status,write_receipt FROM gradebook_proposals WHERE organization_id=? AND mission_id=? ORDER BY created_at DESC LIMIT 1').get(organizationId,missionId)||null;
  const checkpoint=mission.status==='completed'?'completed':approval?.status==='pending'?'approval_required':findings.length?'failure_detected':'delegated';
  return {missionId,missionStatus:mission.status,checkpoint,tasks,findings,approval,proposalStatus:proposal?.status||null,ai:refs.demoAi||{enabled:false,status:'rehearsal_fallback'}};
}

export async function launchHackathonDemo(db,{uploadRoot,artifactRoot,organizationId,ownerId,packBytes=null,demoAiRuntime=null}){
  db.prepare("UPDATE agents SET enabled=1,activation_state=1 WHERE organization_id=? AND kind='built_in' AND archived_at IS NULL").run(organizationId);
  const demoFiles=packBytes?unpackDemoFiles(packBytes):HACKATHON_DEMO_FILES;
  const fileIds=[];
  for(const file of demoFiles){
    const saved=await saveAcademicFile(db,{uploadRoot,organizationId,uploaderId:ownerId,name:file.name,mimeType:file.mimeType,category:file.category,base64:(Buffer.isBuffer(file.content)?file.content:Buffer.from(file.content)).toString('base64')});
    fileIds.push(saved.fileId);
  }
  const objective='Review six fictional submissions against a 100-point rubric, expose a deliberate total mismatch, independently correct and verify it, stop for lecturer approval, update the protected demo gradebook, and preserve evidence receipts.';
  const created=createEducationMission(db,{
    organizationId,ownerId,templateId:'assignment_assessment',
    title:'LIVE DEMO — Verified Assessment Mission',
    objective,fileIds,demoQaInjection:true,scenarioId:HACKATHON_DEMO_SCENARIO,manualAdvance:true,
    demoAi:{enabled:Boolean(demoAiRuntime),provider:'gemini',model:demoAiRuntime?.model||'gemini-3.1-flash-lite',status:demoAiRuntime?'planning':'rehearsal_fallback'}
  });
  if(demoAiRuntime){
    try{
      const mission=db.prepare('SELECT plan,input_refs FROM missions WHERE id=? AND organization_id=?').get(created.missionId,organizationId),plan=await demoAiRuntime.planMission({objective,files:demoFiles.map(file=>({name:file.name,category:file.category})),steps:JSON.parse(mission.plan).map(step=>({step:step.id,role:step.roleKey,tool:step.tool}))});
      if(artifactRoot)await saveArtifact(db,{artifactRoot,organizationId,missionId:created.missionId,type:'chief_ai_plan',title:'CHIEF live Gemini mission plan',content:JSON.stringify({provider:'gemini',model:demoAiRuntime.model,generatedLive:true,plan},null,2)});
      const refs=JSON.parse(mission.input_refs);refs.demoAi={...refs.demoAi,status:'live',plan};db.prepare('UPDATE missions SET input_refs=?,updated_at=? WHERE id=? AND organization_id=?').run(JSON.stringify(refs),now(),created.missionId,organizationId);
      educationEvent(db,{organizationId,missionId:created.missionId,type:'gemini_plan_generated',detail:`CHIEF used Gemini 3.1 Flash-Lite live to interpret the validated inputs and confirm the governed nine-step delegation plan. ${plan.briefing}`});
    }catch(error){
      const mission=db.prepare('SELECT input_refs FROM missions WHERE id=? AND organization_id=?').get(created.missionId,organizationId),refs=JSON.parse(mission.input_refs);refs.demoAi={...refs.demoAi,status:'rehearsal_fallback',error:String(error?.message||error).slice(0,240)};db.prepare('UPDATE missions SET input_refs=?,updated_at=? WHERE id=? AND organization_id=?').run(JSON.stringify(refs),now(),created.missionId,organizationId);
      educationEvent(db,{organizationId,missionId:created.missionId,type:'gemini_fallback',detail:`Gemini planning was unavailable, so CHIEF preserved the presentation with the validated local plan. ${refs.demoAi.error}`});
    }
  }
  db.prepare("UPDATE missions SET status='paused',updated_at=? WHERE id=? AND organization_id=?").run(now(),created.missionId,organizationId);
  educationEvent(db,{organizationId,missionId:created.missionId,type:'demo_ready',detail:`${packBytes?'Uploaded ZIP validated. ':''}Six fictional submissions, one 100-point rubric and one fictional roster are ready. Presenter controls each demonstration checkpoint.`});
  return {...status(db,organizationId,created.missionId),fileCount:demoFiles.length,submissionCount:submissions.length};
}

export async function advanceHackathonDemo(db,{artifactRoot,organizationId,missionId,demoAiRuntime=null}){
  const initial=status(db,organizationId,missionId);
  if(initial.missionStatus==='completed')return initial;
  if(initial.approval?.status==='pending')return initial;
  const target=initial.findings.length?'completed':'failure_detected';
  const approved=initial.approval&&['approved','consumed'].includes(initial.approval.status);
  const desired=approved?'completed':target==='failure_detected'?'failure_detected':'approval_required';
  db.prepare("UPDATE missions SET status='running',updated_at=? WHERE id=? AND organization_id=?").run(now(),missionId,organizationId);
  for(let step=0;step<12;step++){
    const outcome=await runNextEducationTask(db,{artifactRoot,mockSheets:true,missionId,includeManual:true,demoAiRuntime});
    if(!outcome)break;
    const current=status(db,organizationId,missionId);
    if(current.missionStatus==='blocked'||current.checkpoint===desired)break;
    await new Promise(resolve=>setTimeout(resolve,450));
  }
  const current=status(db,organizationId,missionId);
  if(current.missionStatus==='running')db.prepare("UPDATE missions SET status='paused',updated_at=? WHERE id=? AND organization_id=?").run(now(),missionId,organizationId);
  return status(db,organizationId,missionId);
}

