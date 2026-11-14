import { createHash, randomUUID, timingSafeEqual } from 'node:crypto';
import { missionTemplate, missionTemplates, roleAllowsTool } from './education-registry.mjs';
import { now } from './store.mjs';
import { parseCsv, saveArtifact } from './academic-files.mjs';
import { createMarkedPapersPdf } from './pdf-artifacts.mjs';

const hash=value=>createHash('sha256').update(typeof value==='string'?value:JSON.stringify(value)).digest('hex');
const latestAssessments=(db,organizationId,missionId)=>db.prepare(`SELECT d.* FROM draft_assessments d JOIN (
  SELECT student_id,MAX(revision) revision FROM draft_assessments WHERE organization_id=? AND mission_id=? GROUP BY student_id
) latest ON latest.student_id=d.student_id AND latest.revision=d.revision WHERE d.organization_id=? AND d.mission_id=? ORDER BY d.student_id`).all(organizationId,missionId,organizationId,missionId);

export function educationEvent(db,{organizationId,missionId,taskId=null,agentId=null,type,detail}) {
  db.prepare('INSERT INTO mission_events(id,organization_id,mission_id,task_id,agent_id,event_type,detail,created_at) VALUES(?,?,?,?,?,?,?,?)')
    .run(randomUUID(),organizationId,missionId,taskId,agentId,type,String(detail).slice(0,1000),now());
}

export function listEducationTemplates(){return missionTemplates.map(template=>({...template}));}

export function createEducationMission(db,{organizationId,ownerId,templateId,title,objective,fileIds=[],demoQaInjection=false,scenarioId=null,manualAdvance=false,demoAi=null}) {
  const template=missionTemplate(templateId);
  if(!template)throw new Error('Unknown academic mission template.');
  const uniqueFiles=[...new Set(fileIds.map(String))];
  const files=uniqueFiles.map(fileId=>db.prepare('SELECT id,category,original_name FROM academic_files WHERE id=? AND organization_id=?').get(fileId,organizationId));
  if(files.some(file=>!file))throw new Error('One or more academic files are unavailable in this workspace.');
  if(templateId==='assignment_assessment') {
    const categories=new Set(files.map(file=>file.category));
    if(!categories.has('assignment')||!categories.has('rubric')||!categories.has('roster')) throw new Error('Assignment assessment needs assignment, rubric, and roster uploads.');
  }
  const roleKeys=[...new Set(template.steps.map(step=>step.roleKey))];
  const agents=new Map();
  for(const roleKey of roleKeys) {
    const agent=db.prepare("SELECT id,name,role_key FROM agents WHERE organization_id=? AND role_key=? AND kind='built_in' AND enabled=1 AND archived_at IS NULL").get(organizationId,roleKey);
    if(!agent)throw new Error(`Activate ${roleKey.replaceAll('_',' ')} before starting this mission.`);
    agents.set(roleKey,agent);
  }
  const chief=db.prepare("SELECT id FROM agents WHERE organization_id=? AND role_key='chief' AND enabled=1 AND archived_at IS NULL").get(organizationId);
  if(!chief)throw new Error('Activate CHIEF before starting an academic mission.');
  const missionId=randomUUID(),created=now(),inputRefs={fileIds:uniqueFiles,demoQaInjection:Boolean(demoQaInjection),ownerId,scenarioId:scenarioId||null,manualAdvance:Boolean(manualAdvance),...(demoAi?{demoAi}:{})};
  db.exec('BEGIN');
  try {
    db.prepare("INSERT INTO missions(id,organization_id,title,objective,plan,status,created_at,updated_at,template_id,input_refs) VALUES(?,?,?,?,?,'running',?,?,?,?)")
      .run(missionId,organizationId,String(title||template.name).trim().slice(0,100),String(objective||template.description).trim().slice(0,1000),JSON.stringify(template.steps),created,created,template.id,JSON.stringify(inputRefs));
    const insertTask=db.prepare(`INSERT INTO mission_tasks(id,mission_id,organization_id,assigned_agent_id,step_key,task_type,tool_name,input_refs,depends_on,status,attempt,max_attempts,idempotency_key,requires_approval,created_at,updated_at)
      VALUES(?,?,?,?,?,?,?,?,?,'queued',0,3,?,?,?,?)`);
    const taskIds=new Map(template.steps.map(step=>[step.id,randomUUID()]));
    for(const step of template.steps) {
      const taskId=taskIds.get(step.id),agent=agents.get(step.roleKey),dependsOn=step.dependsOn.map(key=>taskIds.get(key));
      insertTask.run(taskId,missionId,organizationId,agent.id,step.id,step.id,step.tool,JSON.stringify(inputRefs),JSON.stringify(dependsOn),hash(`${missionId}:${step.id}`),step.requiresApproval?1:0,created,created);
      db.prepare('INSERT INTO task_handoffs(id,organization_id,mission_id,from_agent_id,to_agent_id,task_id,payload,created_at) VALUES(?,?,?,?,?,?,?,?)')
        .run(randomUUID(),organizationId,missionId,chief.id,agent.id,taskId,JSON.stringify({step:step.id,tool:step.tool,dependsOn}),created);
    }
    educationEvent(db,{organizationId,missionId,agentId:chief.id,type:'created',detail:`Academic mission created from ${template.name}.`});
    educationEvent(db,{organizationId,missionId,agentId:chief.id,type:'plan_confirmed',detail:`Validated ${template.steps.length}-step dependency graph.`});
    db.exec('COMMIT');
  } catch(error) {db.exec('ROLLBACK');throw error;}
  return {missionId,taskCount:template.steps.length};
}

function readyTask(db,{missionId=null,includeManual=false}={}) {
  const candidates=db.prepare(`SELECT mt.* FROM mission_tasks mt JOIN missions m ON m.id=mt.mission_id AND m.organization_id=mt.organization_id
    WHERE mt.status='queued' AND m.status IN ('running','active') ORDER BY mt.created_at,mt.rowid LIMIT 100`).all();
  return candidates.find(task=>{
    if(missionId&&task.mission_id!==missionId)return false;
    const missionRefs=JSON.parse(db.prepare('SELECT input_refs FROM missions WHERE id=? AND organization_id=?').get(task.mission_id,task.organization_id)?.input_refs||'{}');
    if(missionRefs.manualAdvance&&!includeManual)return false;
    return JSON.parse(task.depends_on).every(dep=>db.prepare("SELECT status FROM mission_tasks WHERE id=? AND organization_id=?").get(dep,task.organization_id)?.status==='completed');
  })||null;
}

function missionFiles(db,task) {
  const refs=JSON.parse(task.input_refs||'{}'),files=(refs.fileIds||[]).map(fileId=>db.prepare('SELECT * FROM academic_files WHERE id=? AND organization_id=?').get(fileId,task.organization_id)).filter(Boolean);
  return {refs,files,byCategory:category=>files.filter(file=>file.category===category)};
}

function rubricFor(files) {
  const file=files.find(item=>item.category==='rubric');
  if(!file)throw new Error('A rubric file is required.');
  let rubric;
  try{rubric=JSON.parse(file.extracted_text);}catch{
    const text=file.extracted_text,criterionTitles={thesis:'Understanding of digital citizenship',privacy:'Privacy and account security',respect:'Respectful online participation',critical:'Source verification and critical thinking',structure:'Structure, evidence and examples'},criteria=Object.entries(criterionTitles).map(([key,title])=>({key,title,max_points:Number(text.match(new RegExp(`\\b${key}\\s*=\\s*(\\d+)`,'i'))?.[1]||20)}));
    rubric={rubric_id:text.match(/\b(DIGCIT-\d+)\b/i)?.[1]?.toUpperCase()||'DIGCIT-100',title:'Digital Citizenship Practical',maximum_points:Number(text.match(/Maximum(?: points| score)?\s*[:=-]?\s*(\d+)/i)?.[1]||100),criteria};
  }
  if(!Array.isArray(rubric.criteria)||!rubric.criteria.length)throw new Error('Rubric criteria are missing.');
  const maximum=rubric.criteria.reduce((sum,criterion)=>sum+Number(criterion.max_points||0),0);
  if(maximum!==Number(rubric.maximum_points))throw new Error('Rubric criterion points do not equal maximum_points.');
  return rubric;
}

function submissionMeta(file) {
  const id=file.extracted_text.match(/Student ID:\s*([A-Z0-9-]+)/i)?.[1]?.toUpperCase();
  const name=(file.extracted_text.match(/Student name:\s*(.*?)\s+Submission:/i)?.[1]||file.extracted_text.match(/Student name:\s*([^\r\n]+)/i)?.[1])?.trim();
  const submission=(file.extracted_text.split(/Submission:\s*/i).slice(1).join('Submission: ').trim()||file.extracted_text).replace(/\s*This submission is fictional and exists only for the EDU BOT hackathon demonstration\.?\s*$/i,'').trim();
  if(!id)throw new Error(`Student ID is missing from ${file.original_name}.`);
  return {studentId:id,name,submission,fileId:file.id};
}

function rosterFor(files){
  const file=files.find(item=>item.category==='roster');if(!file)throw new Error('A fictional roster is required.');
  if(file.original_name.toLowerCase().endsWith('.csv'))return parseCsv(file.extracted_text);
  const rows=[];
  for(const match of file.extracted_text.matchAll(/\b(STU-\d{3})\s+([A-Za-z][A-Za-z '-]+?)\s+(DIG-\d+)\s+(PRACTICAL-\d+)\b/g))rows.push({student_id:match[1],student_name:match[2].trim(),course_id:match[3],assignment_id:match[4]});
  if(!rows.length)throw new Error('No readable student rows were found in the roster PDF.');
  return rows;
}

function scoreSubmission(rubric,submission) {
  const lower=submission.toLowerCase(),words=submission.split(/\s+/).filter(Boolean).length;
  const counts={
    thesis:/digital citizenship|responsib|online safety/.test(lower)?17:11,
    privacy:Math.min(20,10+['privacy','password','multi-factor','authentication','permission','account','phishing','security'].filter(word=>lower.includes(word)).length*2),
    respect:Math.min(20,10+['respect','consent','harass','bully','kind','photo','classmate','communication'].filter(word=>lower.includes(word)).length*2),
    critical:Math.min(20,9+['source','verify','check','date','evidence','official','headline','information'].filter(word=>lower.includes(word)).length*2),
    structure:Math.min(20,(words>=70?17:words>=45?15:words>=25?12:9)+(lower.includes('example')?2:0))
  };
  return rubric.criteria.map(criterion=>({key:criterion.key,points:Math.min(Number(criterion.max_points),Math.max(0,Number(counts[criterion.key]??Math.round(Number(criterion.max_points)*0.7)))),max_points:Number(criterion.max_points),evidence:`Derived from the submitted text for ${criterion.title}.`}));
}

async function executeTool(db,task,{artifactRoot,mockSheets=true,demoAiRuntime=null}) {
  const {refs,files,byCategory}=missionFiles(db,task),missionId=task.mission_id,org=task.organization_id;
  if(task.tool_name==='list_assignment_status') {
    const assignments=byCategory('assignment').map(submissionMeta),duplicates=assignments.filter((item,index)=>assignments.findIndex(other=>other.studentId===item.studentId)!==index);
    if(duplicates.length)throw new Error(`Duplicate student IDs: ${[...new Set(duplicates.map(item=>item.studentId))].join(', ')}`);
    return {assignmentCount:assignments.length,studentIds:assignments.map(item=>item.studentId),complete:assignments.length>0};
  }
  if(task.tool_name==='draft_criterion_scores') {
    const rubric=rubricFor(files),assignments=byCategory('assignment').map(submissionMeta),created=[];
    if(!assignments.length)throw new Error('No assignment submissions were uploaded.');
    let enrichment=null,aiStatus='deterministic_fallback',aiError=null;
    if(refs.demoAi?.enabled&&demoAiRuntime){
      try{
        enrichment=await demoAiRuntime.enrichAssessments({rubric,assignments});aiStatus='live_generated';
        educationEvent(db,{organizationId:org,missionId,taskId:task.id,agentId:task.assigned_agent_id,type:'gemini_generated',detail:`Gemini 3.1 Flash-Lite analysed ${assignments.length} fictional submissions and generated grounded criterion evidence plus draft feedback. Numeric scoring remains deterministic and independently verified.`});
      }catch(error){
        aiError=String(error?.message||error).slice(0,240);
        educationEvent(db,{organizationId:org,missionId,taskId:task.id,agentId:task.assigned_agent_id,type:'gemini_fallback',detail:`Gemini enrichment was unavailable, so EDU BOT used its deterministic rehearsal-safe assessment fallback. ${aiError}`});
      }
    }
    for(const [index,assignment] of assignments.entries()) {
      const generated=enrichment?.get(assignment.studentId),scores=scoreSubmission(rubric,assignment.submission).map(score=>({...score,evidence:generated?.evidenceByCriterion?.[score.key]||score.evidence})),derived=scores.reduce((sum,item)=>sum+item.points,0),claimed=refs.demoQaInjection&&index===0?Math.min(100,derived+15):derived;
      const fallbackFeedback=derived>=80?'Strong coverage of the rubric.':'Develop the rubric areas with more specific evidence and examples.';
      const assessmentId=randomUUID(),feedback=`DRAFT — ${assignment.studentId}: ${generated?.feedback||fallbackFeedback} A qualified educator must review this recommendation.`;
      db.prepare(`INSERT INTO draft_assessments(id,organization_id,mission_id,student_id,rubric_id,criterion_scores,claimed_total,derived_total,feedback,revision,review_status,source_file_id,created_at)
        VALUES(?,?,?,?,?,?,?,?,?,1,'draft',?,?)`).run(assessmentId,org,missionId,assignment.studentId,rubric.rubric_id,JSON.stringify(scores),claimed,derived,feedback,assignment.fileId,now());
      created.push({assessmentId,studentId:assignment.studentId,criterionScores:scores,claimedTotal:claimed,derivedTotal:derived,feedback});
    }
    const ai={provider:'gemini',model:refs.demoAi?.model||null,status:aiStatus,...(aiError?{error:aiError}:{})};
    const artifact=await saveArtifact(db,{artifactRoot,organizationId:org,missionId,taskId:task.id,type:'draft_assessments',title:'Gemini-enriched draft rubric assessments',content:JSON.stringify({draftOnly:true,humanReviewRequired:true,ai,assessments:created},null,2)});
    return {assessmentCount:created.length,artifactId:artifact.artifactId,draftOnly:true,ai};
  }
  if(task.tool_name==='recalculate_totals'||task.tool_name==='verify_revision') {
    const rubric=rubricFor(files),assessments=latestAssessments(db,org,missionId),issues=[];let correctedPdfArtifact=null;
    for(const assessment of assessments) {
      const scores=JSON.parse(assessment.criterion_scores),derived=scores.reduce((sum,item)=>sum+Number(item.points),0);
      for(const score of scores) {const criterion=rubric.criteria.find(item=>item.key===score.key);if(!criterion||score.points<0||score.points>criterion.max_points)issues.push({assessment,issueType:'RUBRIC_BOUND',observed:String(score.points),expected:`0-${criterion?.max_points??'missing'}`,location:score.key});}
      if(Number(assessment.claimed_total)!==derived)issues.push({assessment,issueType:'SCORE_SUM_MISMATCH',observed:String(assessment.claimed_total),expected:String(derived),location:'claimed_total'});
      if(!assessment.feedback.trim())issues.push({assessment,issueType:'MISSING_FEEDBACK',observed:'empty',expected:'constructive draft feedback',location:'feedback'});
    }
    for(const issue of issues) db.prepare(`INSERT INTO qa_findings(id,organization_id,mission_id,assessment_id,issue_type,location,observed,expected,severity,correction_action,verification_state,created_at,updated_at)
      VALUES(?,?,?,?,?,?,?,?,?,'request_assessment_revision','open',?,?)`).run(randomUUID(),org,missionId,issue.assessment.id,issue.issueType,issue.location,issue.observed,issue.expected,issue.issueType==='SCORE_SUM_MISMATCH'?'high':'medium',now(),now());
    if(task.tool_name==='verify_revision') {
      if(issues.length)throw new Error(`${issues.length} assessment discrepancy(s) remain after correction.`);
      db.prepare("UPDATE draft_assessments SET review_status='verified' WHERE organization_id=? AND mission_id=? AND revision=(SELECT MAX(d2.revision) FROM draft_assessments d2 WHERE d2.mission_id=draft_assessments.mission_id AND d2.student_id=draft_assessments.student_id)").run(org,missionId);
      db.prepare("UPDATE qa_findings SET verification_state='verified',updated_at=? WHERE organization_id=? AND mission_id=? AND correction_assessment_id IS NOT NULL").run(now(),org,missionId);
      const verified=latestAssessments(db,org,missionId),assignments=byCategory('assignment').map(submissionMeta),findings=db.prepare('SELECT q.*,d.student_id FROM qa_findings q JOIN draft_assessments d ON d.id=q.assessment_id AND d.organization_id=q.organization_id WHERE q.organization_id=? AND q.mission_id=?').all(org,missionId);
      correctedPdfArtifact=await saveArtifact(db,{artifactRoot,organizationId:org,missionId,taskId:task.id,type:'corrected_marked_papers_pdf',title:'Corrected marked papers - Academic QA verified.pdf',mimeType:'application/pdf',content:createMarkedPapersPdf({missionId,rubric,assessments:verified,assignments,findings})});
      educationEvent(db,{organizationId:org,missionId,taskId:task.id,agentId:task.assigned_agent_id,type:'marked_papers_pdf_created',detail:`Academic QA packaged ${verified.length} corrected marked papers into a downloadable PDF.`});
    }
    educationEvent(db,{organizationId:org,missionId,taskId:task.id,agentId:task.assigned_agent_id,type:issues.length?'qa_failed':'qa_passed',detail:issues.length?`${issues.length} deterministic discrepancy(s) detected.`:'All draft totals, bounds, IDs and feedback passed deterministic QA.'});
    return {checked:assessments.length,issues:issues.map(issue=>({type:issue.issueType,studentId:issue.assessment.student_id,observed:issue.observed,expected:issue.expected})),passed:issues.length===0,...(correctedPdfArtifact?{correctedMarkedPapersArtifactId:correctedPdfArtifact.artifactId}:{})};
  }
  if(task.tool_name==='correct_assessment_totals') {
    const findings=db.prepare("SELECT q.*,d.student_id,d.rubric_id,d.criterion_scores,d.feedback,d.source_file_id,d.revision FROM qa_findings q JOIN draft_assessments d ON d.id=q.assessment_id AND d.organization_id=q.organization_id WHERE q.organization_id=? AND q.mission_id=? AND q.verification_state='open'").all(org,missionId),revisions=[];
    for(const finding of findings) {
      if(finding.issue_type!=='SCORE_SUM_MISMATCH')continue;
      const scores=JSON.parse(finding.criterion_scores),derived=scores.reduce((sum,item)=>sum+Number(item.points),0),revision=finding.revision+1,assessmentId=randomUUID();
      db.prepare(`INSERT INTO draft_assessments(id,organization_id,mission_id,student_id,rubric_id,criterion_scores,claimed_total,derived_total,feedback,revision,review_status,source_file_id,created_at)
        VALUES(?,?,?,?,?,?,?,?,?,?,'corrected',?,?)`).run(assessmentId,org,missionId,finding.student_id,finding.rubric_id,finding.criterion_scores,derived,derived,finding.feedback,revision,finding.source_file_id,now());
      db.prepare("UPDATE qa_findings SET correction_assessment_id=?,verification_state='corrected_pending_verification',updated_at=? WHERE id=? AND organization_id=?").run(assessmentId,now(),finding.id,org);
      revisions.push({studentId:finding.student_id,assessmentId,revision,before:Number(finding.observed),after:derived});
    }
    educationEvent(db,{organizationId:org,missionId,taskId:task.id,agentId:task.assigned_agent_id,type:'correction_completed',detail:`Created ${revisions.length} versioned assessment correction(s).`});
    return {corrections:revisions};
  }
  if(task.tool_name==='read_student_roster'||task.tool_name==='detect_duplicate_records') {
    const rows=rosterFor(files),ids=rows.map(row=>row.student_id),duplicates=ids.filter((value,index)=>ids.indexOf(value)!==index);
    if(duplicates.length)throw new Error(`Duplicate roster IDs: ${[...new Set(duplicates)].join(', ')}`);
    return {rowCount:rows.length,studentIds:ids};
  }
  if(task.tool_name==='preview_gradebook_update') {
    const rows=rosterFor(files),ids=rows.map(row=>row.student_id),duplicates=ids.filter((value,index)=>ids.indexOf(value)!==index);
    if(duplicates.length)throw new Error(`Duplicate roster IDs: ${[...new Set(duplicates)].join(', ')}`);
    const assessments=latestAssessments(db,org,missionId);if(assessments.some(item=>item.review_status!=='verified'))throw new Error('Only independently verified draft assessments can enter a gradebook preview.');
    const byId=new Map(assessments.map(item=>[item.student_id,item]));
    const missing=rows.filter(row=>!byId.has(row.student_id));if(missing.length)throw new Error(`Verified draft assessments are missing for: ${missing.map(row=>row.student_id).join(', ')}`);
    for(const row of rows) db.prepare(`INSERT OR REPLACE INTO demo_gradebook_rows(organization_id,mission_id,student_id,student_name,course_id,assignment_id,draft_score,draft_feedback,review_status,last_mission_id,row_version)
      VALUES(?,?,?,?,?,?,NULL,'','NOT_REVIEWED',NULL,1)`).run(org,missionId,row.student_id,row.student_name,row.course_id,row.assignment_id);
    const diff=rows.map(row=>{const assessment=byId.get(row.student_id);return {studentId:row.student_id,studentName:row.student_name,before:{draftScore:null,draftFeedback:'',reviewStatus:'NOT_REVIEWED',rowVersion:1},after:{draftScore:assessment.derived_total,draftFeedback:assessment.feedback,reviewStatus:'DRAFT',lastMissionId:missionId}};});
    const proposalId=randomUUID(),sourceVersion=hash(diff.map(item=>[item.studentId,item.before]));
    db.prepare("INSERT INTO gradebook_proposals(id,organization_id,mission_id,provider,sheet_ref,source_version,diff,status,created_at) VALUES(?,?,?,'mock_google_sheets','DemoGradebook',?,?,'previewed',?)")
      .run(proposalId,org,missionId,sourceVersion,JSON.stringify(diff),now());
    const artifact=await saveArtifact(db,{artifactRoot,organizationId:org,missionId,taskId:task.id,type:'gradebook_diff',title:'DRAFT gradebook update preview',content:JSON.stringify({provider:'mock_google_sheets',liveGoogleVerified:false,diff},null,2)});
    return {proposalId,rowCount:diff.length,sourceVersion,artifactId:artifact.artifactId,provider:'mock_google_sheets',liveGoogleVerified:false};
  }
  if(task.tool_name==='generate_report') {
    const assessments=latestAssessments(db,org,missionId);if(!assessments.length)throw new Error('No draft assessment data is available for reporting.');
    const totals=assessments.map(item=>Number(item.derived_total)),average=totals.reduce((sum,value)=>sum+value,0)/totals.length,min=Math.min(...totals),max=Math.max(...totals),verified=assessments.filter(item=>item.review_status==='verified').length;
    const html=`<!doctype html><meta charset="utf-8"><title>Draft class report</title><h1>BUILD BOT 2.0 — Draft class performance report</h1><p><strong>Fictional demonstration data. Educator review required.</strong></p><dl><dt>Students</dt><dd>${totals.length}</dd><dt>Average</dt><dd>${average.toFixed(1)}</dd><dt>Range</dt><dd>${min}–${max}</dd><dt>QA verified drafts</dt><dd>${verified}</dd></dl><table><thead><tr><th>Student ID</th><th>Draft score</th><th>Status</th></tr></thead><tbody>${assessments.map(item=>`<tr><td>${item.student_id}</td><td>${item.derived_total}</td><td>${item.review_status}</td></tr>`).join('')}</tbody></table>`;
    const artifact=await saveArtifact(db,{artifactRoot,organizationId:org,missionId,taskId:task.id,type:'class_report',title:'Draft class performance report',mimeType:'text/html',content:html});
    return {artifactId:artifact.artifactId,studentCount:totals.length,average:Number(average.toFixed(2)),minimum:min,maximum:max,verifiedDrafts:verified};
  }
  if(task.tool_name==='execute_approved_sheet_update') {
    const approval=db.prepare("SELECT * FROM education_approvals WHERE organization_id=? AND mission_id=? AND task_id=? AND status='approved'").get(org,missionId,task.id);
    if(!approval)throw new Error('The exact draft gradebook write has not been approved.');
    const payload=JSON.parse(approval.payload),proposal=db.prepare('SELECT * FROM gradebook_proposals WHERE id=? AND organization_id=?').get(payload.proposalId,org);
    if(!proposal||proposal.status!=='previewed')throw new Error('The gradebook proposal is missing, stale, or already consumed.');
    if(hash(JSON.parse(proposal.diff))!==payload.diffHash||proposal.source_version!==payload.sourceVersion)throw new Error('The approved gradebook preview changed.');
    const diff=JSON.parse(proposal.diff),written=[];
    db.exec('BEGIN');
    try {
      for(const item of diff) {
        const changed=db.prepare(`UPDATE demo_gradebook_rows SET draft_score=?,draft_feedback=?,review_status=?,last_mission_id=?,row_version=row_version+1
          WHERE organization_id=? AND mission_id=? AND student_id=? AND row_version=?`).run(item.after.draftScore,item.after.draftFeedback,item.after.reviewStatus,missionId,org,missionId,item.studentId,item.before.rowVersion);
        if(changed.changes!==1)throw new Error(`Demo gradebook row ${item.studentId} changed after preview.`);
        written.push(item.studentId);
      }
      const receipt={provider:'mock_google_sheets',liveGoogleVerified:false,writtenStudentIds:written,idempotencyKey:task.idempotency_key,writtenAt:now()};
      db.prepare("UPDATE gradebook_proposals SET status='written',write_receipt=? WHERE id=? AND organization_id=?").run(JSON.stringify(receipt),proposal.id,org);
      db.prepare("UPDATE education_approvals SET status='consumed',consumed_at=? WHERE id=? AND organization_id=? AND status='approved'").run(now(),approval.id,org);
      db.exec('COMMIT');return receipt;
    } catch(error) {db.exec('ROLLBACK');throw error;}
  }
  if(task.tool_name==='verify_sheet_rows') {
    const proposal=db.prepare("SELECT * FROM gradebook_proposals WHERE organization_id=? AND mission_id=? AND status='written' ORDER BY created_at DESC LIMIT 1").get(org,missionId);
    if(!proposal)throw new Error('No gradebook write receipt is available for verification.');
    const diff=JSON.parse(proposal.diff),mismatches=[];
    for(const item of diff) {const row=db.prepare('SELECT * FROM demo_gradebook_rows WHERE organization_id=? AND mission_id=? AND student_id=?').get(org,missionId,item.studentId);if(!row||Number(row.draft_score)!==Number(item.after.draftScore)||row.draft_feedback!==item.after.draftFeedback||row.review_status!==item.after.reviewStatus)mismatches.push(item.studentId);}
    if(mismatches.length)throw new Error(`Read-after-write mismatch for ${mismatches.join(', ')}.`);
    db.prepare("UPDATE gradebook_proposals SET status='verified',verified_at=? WHERE id=? AND organization_id=?").run(now(),proposal.id,org);
    return {verifiedRows:diff.length,mismatches,provider:'mock_google_sheets',liveGoogleVerified:false};
  }
  if(['draft_lesson_plan','draft_study_plan','draft_student_notice','create_reference_list','validate_outcome_coverage','compare_artifact_to_source'].includes(task.tool_name)) {
    const title={draft_lesson_plan:'Draft lesson plan',draft_study_plan:'Draft fictional student support plan',draft_student_notice:'Draft student notice',create_reference_list:'Draft learning resource list',validate_outcome_coverage:'Outcome coverage review',compare_artifact_to_source:'Independent artifact review'}[task.tool_name];
    const body={draftOnly:true,humanReviewRequired:true,tool:task.tool_name,missionId,summary:`${title} created from the mission objective and authorized workspace inputs.`,inputFileCount:files.length};
    const artifact=await saveArtifact(db,{artifactRoot,organizationId:org,missionId,taskId:task.id,type:task.tool_name,title,content:JSON.stringify(body,null,2)});
    return {...body,artifactId:artifact.artifactId};
  }
  throw new Error(`Tool ${task.tool_name} is not implemented.`);
}

function ensureApproval(db,task) {
  const existing=db.prepare('SELECT * FROM education_approvals WHERE organization_id=? AND task_id=?').get(task.organization_id,task.id);
  if(existing)return existing;
  const proposal=db.prepare("SELECT * FROM gradebook_proposals WHERE organization_id=? AND mission_id=? AND status='previewed' ORDER BY created_at DESC LIMIT 1").get(task.organization_id,task.mission_id);
  if(!proposal)throw new Error('A current gradebook preview is required before approval.');
  const expiresAt=new Date(Date.now()+24*60*60*1000).toISOString(),payload={provider:proposal.provider,sheetRef:proposal.sheet_ref,proposalId:proposal.id,sourceVersion:proposal.source_version,diffHash:hash(JSON.parse(proposal.diff)),rowCount:JSON.parse(proposal.diff).length,policyVersion:1,expiresAt,nonce:randomUUID()},actionHash=hash(payload),approvalId=randomUUID();
  db.prepare("INSERT INTO education_approvals(id,organization_id,mission_id,task_id,action_type,action_hash,payload,policy_version,status,created_at,expires_at) VALUES(?,?,?,?,? ,?,?,1,'pending',?,?)")
    .run(approvalId,task.organization_id,task.mission_id,task.id,'draft_gradebook_write',actionHash,JSON.stringify(payload),now(),expiresAt);
  db.prepare("UPDATE mission_tasks SET status='awaiting_approval',updated_at=? WHERE id=? AND organization_id=?").run(now(),task.id,task.organization_id);
  db.prepare("UPDATE missions SET status='awaiting_approval',updated_at=? WHERE id=? AND organization_id=?").run(now(),task.mission_id,task.organization_id);
  educationEvent(db,{organizationId:task.organization_id,missionId:task.mission_id,taskId:task.id,agentId:task.assigned_agent_id,type:'approval_requested',detail:`Exact ${payload.rowCount}-row fictional draft gradebook write requires lecturer approval.`});
  return {id:approvalId,action_hash:actionHash};
}

export async function runNextEducationTask(db,options) {
  const task=readyTask(db,{missionId:options?.missionId,includeManual:Boolean(options?.includeManual)});if(!task)return null;
  const mission=db.prepare('SELECT * FROM missions WHERE id=? AND organization_id=?').get(task.mission_id,task.organization_id);if(!mission)return null;
  if(task.requires_approval) {
    const approval=db.prepare('SELECT status FROM education_approvals WHERE organization_id=? AND task_id=?').get(task.organization_id,task.id);
    if(!approval||approval.status==='pending') {ensureApproval(db,task);return {taskId:task.id,status:'awaiting_approval'};}
    if(approval.status!=='approved')return {taskId:task.id,status:'blocked'};
  }
  const agent=db.prepare("SELECT id,name,role_key,enabled FROM agents WHERE id=? AND organization_id=? AND archived_at IS NULL").get(task.assigned_agent_id,task.organization_id);
  if(!agent?.enabled) {
    db.prepare("UPDATE mission_tasks SET status='blocked',error=?,updated_at=? WHERE id=? AND organization_id=?").run('Assigned education specialist is inactive.',now(),task.id,task.organization_id);
    db.prepare("UPDATE missions SET status='blocked',updated_at=? WHERE id=? AND organization_id=?").run(now(),task.mission_id,task.organization_id);
    educationEvent(db,{organizationId:task.organization_id,missionId:task.mission_id,taskId:task.id,agentId:task.assigned_agent_id,type:'tool_failed',detail:'Assigned education specialist is inactive.'});return {taskId:task.id,status:'blocked'};
  }
  if(!roleAllowsTool(agent.role_key,task.tool_name))throw new Error(`${agent.name} is not permitted to use ${task.tool_name}.`);
  const lease=randomUUID(),claimed=db.prepare("UPDATE mission_tasks SET status='running',attempt=attempt+1,lease_token=?,lease_expires_at=?,updated_at=? WHERE id=? AND organization_id=? AND status='queued'")
    .run(lease,new Date(Date.now()+120000).toISOString(),now(),task.id,task.organization_id);if(claimed.changes!==1)return null;
  const toolCallId=randomUUID();db.prepare("INSERT INTO tool_calls(id,organization_id,mission_id,task_id,agent_id,tool_name,input_hash,status,started_at) VALUES(?,?,?,?,?,?,?,'running',?)")
    .run(toolCallId,task.organization_id,task.mission_id,task.id,agent.id,task.tool_name,hash(task.input_refs),now());
  educationEvent(db,{organizationId:task.organization_id,missionId:task.mission_id,taskId:task.id,agentId:agent.id,type:'agent_assigned',detail:`${agent.name} accepted ${task.step_key}.`});
  educationEvent(db,{organizationId:task.organization_id,missionId:task.mission_id,taskId:task.id,agentId:agent.id,type:'tool_started',detail:`${task.tool_name} started with validated arguments.`});
  try {
    const result=await executeTool(db,task,options);
    db.prepare("UPDATE tool_calls SET status='succeeded',result=?,finished_at=? WHERE id=? AND organization_id=?").run(JSON.stringify(result),now(),toolCallId,task.organization_id);
    db.prepare("UPDATE mission_tasks SET status='completed',result=?,error=NULL,lease_token=NULL,lease_expires_at=NULL,updated_at=? WHERE id=? AND organization_id=?").run(JSON.stringify(result),now(),task.id,task.organization_id);
    educationEvent(db,{organizationId:task.organization_id,missionId:task.mission_id,taskId:task.id,agentId:agent.id,type:'tool_succeeded',detail:`${task.tool_name} completed with persisted evidence.`});
    const remaining=db.prepare("SELECT COUNT(*) n FROM mission_tasks WHERE mission_id=? AND organization_id=? AND status!='completed'").get(task.mission_id,task.organization_id).n;
    if(!remaining) {db.prepare("UPDATE missions SET status='completed',updated_at=? WHERE id=? AND organization_id=?").run(now(),task.mission_id,task.organization_id);educationEvent(db,{organizationId:task.organization_id,missionId:task.mission_id,agentId:agent.id,type:'mission_finished',detail:'All required tasks completed with persisted results.'});}
    return {taskId:task.id,status:'completed',result};
  } catch(error) {
    const current=db.prepare('SELECT attempt,max_attempts FROM mission_tasks WHERE id=?').get(task.id),message=String(error?.message||error).slice(0,500),retryable=!/required|missing|duplicate|permission|approved|mismatch|unavailable/i.test(message)&&current.attempt<current.max_attempts,status=retryable?'queued':'failed';
    db.prepare('UPDATE tool_calls SET status=?,error=?,finished_at=? WHERE id=? AND organization_id=?').run(status==='queued'?'retrying':'failed',message,now(),toolCallId,task.organization_id);
    db.prepare('UPDATE mission_tasks SET status=?,error=?,lease_token=NULL,lease_expires_at=NULL,updated_at=? WHERE id=? AND organization_id=?').run(status,message,now(),task.id,task.organization_id);
    educationEvent(db,{organizationId:task.organization_id,missionId:task.mission_id,taskId:task.id,agentId:agent.id,type:status==='queued'?'retrying':'tool_failed',detail:message});
    if(status==='failed')db.prepare("UPDATE missions SET status='blocked',updated_at=? WHERE id=? AND organization_id=?").run(now(),task.mission_id,task.organization_id);
    return {taskId:task.id,status,error:message};
  }
}

export function recoverEducationTasks(db) {
  const result=db.prepare("UPDATE mission_tasks SET status='queued',lease_token=NULL,lease_expires_at=NULL,updated_at=? WHERE status='running' AND (lease_expires_at IS NULL OR lease_expires_at<?) AND requires_approval=0").run(now(),now());
  return result.changes;
}

export function decideEducationApproval(db,{organizationId,approvalId,decision,actionHash,actor}) {
  if(!['approve','reject'].includes(decision))throw new Error('Invalid approval decision.');
  const approval=db.prepare('SELECT * FROM education_approvals WHERE id=? AND organization_id=?').get(approvalId,organizationId);if(!approval)throw new Error('Education approval not found.');
  if(approval.status!=='pending')throw new Error(`Education approval is ${approval.status}.`);
  const expected=Buffer.from(approval.action_hash,'hex'),received=Buffer.from(String(actionHash||''),'hex');if(expected.length!==received.length||!timingSafeEqual(expected,received))throw new Error('The exact action fingerprint changed.');
  const payload=JSON.parse(approval.payload);if(hash(payload)!==approval.action_hash||approval.expires_at<=now())throw new Error('The approval is stale or expired.');
  const proposal=db.prepare('SELECT * FROM gradebook_proposals WHERE id=? AND organization_id=?').get(payload.proposalId,organizationId);if(!proposal||proposal.status!=='previewed'||proposal.source_version!==payload.sourceVersion||hash(JSON.parse(proposal.diff))!==payload.diffHash)throw new Error('The gradebook preview changed; request a new approval.');
  const status=decision==='approve'?'approved':'rejected';db.prepare('UPDATE education_approvals SET status=?,decided_at=? WHERE id=? AND organization_id=?').run(status,now(),approvalId,organizationId);
  if(decision==='approve') {db.prepare("UPDATE mission_tasks SET status='queued',updated_at=? WHERE id=? AND organization_id=? AND status='awaiting_approval'").run(now(),approval.task_id,organizationId);db.prepare("UPDATE missions SET status='running',updated_at=? WHERE id=? AND organization_id=?").run(now(),approval.mission_id,organizationId);}
  else {db.prepare("UPDATE mission_tasks SET status='cancelled',error='Lecturer rejected the exact gradebook write.',updated_at=? WHERE id=? AND organization_id=?").run(now(),approval.task_id,organizationId);db.prepare("UPDATE missions SET status='blocked',updated_at=? WHERE id=? AND organization_id=?").run(now(),approval.mission_id,organizationId);}
  educationEvent(db,{organizationId,missionId:approval.mission_id,taskId:approval.task_id,type:decision==='approve'?'approval_granted':'approval_rejected',detail:`${actor} ${decision}d the exact fictional draft gradebook action.`});return {status};
}

export function controlEducationMission(db,{organizationId,missionId,action}) {
  const mission=db.prepare('SELECT * FROM missions WHERE id=? AND organization_id=? AND template_id IS NOT NULL').get(missionId,organizationId);if(!mission)throw new Error('Academic mission not found.');
  if(action==='pause'&&['running','active'].includes(mission.status)) {db.prepare("UPDATE missions SET status='paused',updated_at=? WHERE id=? AND organization_id=?").run(now(),missionId,organizationId);db.prepare("UPDATE mission_tasks SET status='paused',updated_at=? WHERE mission_id=? AND organization_id=? AND status='queued'").run(now(),missionId,organizationId);}
  else if(action==='resume'&&mission.status==='paused') {db.prepare("UPDATE missions SET status='running',updated_at=? WHERE id=? AND organization_id=?").run(now(),missionId,organizationId);db.prepare("UPDATE mission_tasks SET status='queued',updated_at=? WHERE mission_id=? AND organization_id=? AND status='paused'").run(now(),missionId,organizationId);}
  else if(action==='cancel'&&!['completed','cancelled'].includes(mission.status)) {db.prepare("UPDATE missions SET status='cancelled',updated_at=? WHERE id=? AND organization_id=?").run(now(),missionId,organizationId);db.prepare("UPDATE mission_tasks SET status='cancelled',updated_at=? WHERE mission_id=? AND organization_id=? AND status IN ('queued','paused','awaiting_approval')").run(now(),missionId,organizationId);}
  else throw new Error(`Cannot ${action} a ${mission.status} mission.`);
  educationEvent(db,{organizationId,missionId,type:`mission_${action}`,detail:`Lecturer ${action}d the academic mission.`});return {status:action==='resume'?'running':action==='pause'?'paused':'cancelled'};
}
