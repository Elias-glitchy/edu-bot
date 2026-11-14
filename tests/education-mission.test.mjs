import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { createApp } from '../apps/api/server.mjs';

const rubric={rubric_id:'RUBRIC-EDU-DEMO-001',maximum_points:100,criteria:[
  {key:'thesis',title:'Purpose',max_points:20},{key:'privacy',title:'Privacy',max_points:20},{key:'respect',title:'Respect',max_points:20},{key:'critical',title:'Critical evaluation',max_points:20},{key:'structure',title:'Structure',max_points:20}
]};
const roster='student_id,student_name,course_id,assignment_id,draft_score,draft_feedback,review_status\nSTU-001,Amina Jacobs,EDU-DEMO-101,A1,,,NOT_REVIEWED\n';
const assignment='FICTIONAL DEMONSTRATION ASSIGNMENT\nStudent ID: STU-001\nStudent name: Amina Jacobs\nSubmission:\nDigital citizenship and online safety require strong passwords, privacy settings, multi-factor authentication and careful account permissions. Respect means consent before sharing a classmate photo and reporting harassment. I verify a claim using an official source, dates and evidence. For example, I check a scholarship notice before sharing it.';

test('education workforce is fixed, scoped, and runs a real QA-corrected approved mission',async()=>{
  const dir=mkdtempSync(join(tmpdir(),'build-bot-education-')),app=createApp({databasePath:join(dir,'app.sqlite'),uploadRoot:join(dir,'uploads'),artifactRoot:join(dir,'artifacts')});
  await new Promise(resolve=>app.server.listen(0,'127.0.0.1',resolve));
  const base=`http://127.0.0.1:${app.server.address().port}/api`;
  const call=async(path,method='GET',payload,cookie='')=>{const response=await fetch(base+path,{method,headers:{...(payload?{'content-type':'application/json'}:{}),...(cookie?{cookie}:{})},body:payload?JSON.stringify(payload):undefined});return {status:response.status,body:await response.json(),cookie:response.headers.get('set-cookie')?.split(';')[0]};};
  try {
    const owner=await call('/auth/register','POST',{email:'lecturer@example.com',password:'secure-education-password',organization:'Fictional Academy'}),other=await call('/auth/register','POST',{email:'other@example.com',password:'secure-education-password-2',organization:'Other Academy'});
    let state=(await call('/state','GET',undefined,owner.cookie)).body;
    assert.deepEqual(state.agents.map(agent=>agent.slug),['chief','academic-operations','student-records','curriculum-lesson-planning','student-communications','academic-research','student-support-tutoring','academic-reporting-analytics','technology-integrations','assessment-grading','academic-quality-assurance']);
    assert.equal(state.agents.every(agent=>agent.enabled===0),true);
    assert.equal(state.agents.some(agent=>agent.slug==='finance-manager'),false);
    assert.equal((await call('/education/activate-team','POST',{},owner.cookie)).status,200);
    const upload=async(name,content,category)=>call('/academic-files','POST',{name,mimeType:name.endsWith('.csv')?'text/csv':name.endsWith('.json')?'application/json':'text/plain',category,base64:Buffer.from(content).toString('base64')},owner.cookie);
    const rubricFile=await upload('rubric.json',JSON.stringify(rubric),'rubric'),rosterFile=await upload('demo-gradebook.csv',roster,'roster'),assignmentFile=await upload('STU-001.txt',assignment,'assignment');
    assert.equal(rubricFile.status,201);assert.equal(rosterFile.status,201);assert.equal(assignmentFile.status,201);
    assert.equal((await call(`/academic-files/${rubricFile.body.fileId}/download`,'GET',undefined,other.cookie)).status,404);
    const started=await call('/education/missions','POST',{templateId:'assignment_assessment',title:'Assess fictional assignment',objective:'Create verified draft feedback',fileIds:[rubricFile.body.fileId,rosterFile.body.fileId,assignmentFile.body.fileId],demoQaInjection:true},owner.cookie);
    assert.equal(started.status,201,JSON.stringify(started.body));
    for(let i=0;i<30;i++){await app.workEducation();const mission=app.db.prepare('SELECT status FROM missions WHERE id=?').get(started.body.missionId);if(['awaiting_approval','blocked','completed'].includes(mission.status))break;}
    state=(await call('/state','GET',undefined,owner.cookie)).body;
    const mission=state.missions.find(item=>item.id===started.body.missionId);assert.equal(mission.status,'awaiting_approval');
    assert.ok(state.missionTasks.filter(task=>task.mission_id===mission.id&&task.status==='completed').length>=7);
    assert.ok(state.qaFindings.some(finding=>finding.issue_type==='SCORE_SUM_MISMATCH'&&finding.observed!==finding.expected));
    assert.ok(state.missionEvents.some(item=>item.mission_id===mission.id&&item.event_type==='correction_completed'));
    assert.ok(state.missionEvents.some(item=>item.mission_id===mission.id&&item.event_type==='qa_passed'));
    const approval=state.educationApprovals.find(item=>item.mission_id===mission.id&&item.status==='pending');assert.ok(approval);
    assert.equal((await call(`/education/approvals/${approval.id}/approve`,'POST',{actionHash:'0'.repeat(64)},owner.cookie)).status,409);
    assert.equal((await call(`/education/approvals/${approval.id}/approve`,'POST',{actionHash:approval.action_hash},other.cookie)).status,409);
    assert.equal((await call(`/education/approvals/${approval.id}/approve`,'POST',{actionHash:approval.action_hash},owner.cookie)).status,200);
    for(let i=0;i<10;i++){await app.workEducation();if(app.db.prepare('SELECT status FROM missions WHERE id=?').get(mission.id).status==='completed')break;}
    state=(await call('/state','GET',undefined,owner.cookie)).body;
    assert.equal(state.missions.find(item=>item.id===mission.id).status,'completed');
    assert.equal(state.gradebookProposals.find(item=>item.mission_id===mission.id).status,'verified');
    assert.equal(state.gradebookProposals.find(item=>item.mission_id===mission.id).provider,'mock_google_sheets');
    assert.equal(state.gradebookProposals.find(item=>item.mission_id===mission.id).write_receipt.liveGoogleVerified,false);
    assert.ok(state.artifacts.some(item=>item.mission_id===mission.id&&item.artifact_type==='class_report'));
    assert.ok(state.missionEvents.some(item=>item.mission_id===mission.id&&item.event_type==='mission_finished'));
  } finally {await app.close();rmSync(dir,{recursive:true,force:true});}
});
