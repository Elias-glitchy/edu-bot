import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createApp } from '../apps/api/server.mjs';
import { buildHackathonDemoPack, HACKATHON_DEMO_ZIP } from '../apps/api/hackathon-demo.mjs';

test('uploading the official demo ZIP to CHIEF validates it and opens the guided mission without Gemini',async()=>{
  const dir=mkdtempSync(join(tmpdir(),'edu-bot-demo-pack-')),app=createApp({databasePath:join(dir,'app.sqlite'),uploadRoot:join(dir,'uploads'),artifactRoot:join(dir,'artifacts')});
  await new Promise(resolve=>app.server.listen(0,'127.0.0.1',resolve));
  const base=`http://127.0.0.1:${app.server.address().port}/api`,call=async(path,method='GET',payload,cookie='')=>{const response=await fetch(base+path,{method,headers:{...(payload?{'content-type':'application/json'}:{}),...(cookie?{cookie}:{})},body:payload?JSON.stringify(payload):undefined});return {status:response.status,body:await response.json(),cookie:response.headers.get('set-cookie')?.split(';')[0]};};
  try{
    const registered=await call('/auth/register','POST',{email:'zip-demo@example.invalid',password:'secure-demo-password',organization:'ZIP Demo'}),cookie=registered.cookie,zip=buildHackathonDemoPack();
    const uploaded=await call('/academic-files','POST',{name:HACKATHON_DEMO_ZIP,mimeType:'application/zip',category:'reference',base64:zip.toString('base64')},cookie);
    assert.equal(uploaded.status,201);
    const response=await call('/chat','POST',{message:'CHIEF, open this live demonstration.',fileIds:[uploaded.body.fileId]},cookie);
    assert.equal(response.status,200);assert.equal(response.body.navigateTo,'chief');assert.equal(response.body.demoCheckpoint,'delegated');assert.ok(response.body.demoMissionId);assert.match(response.body.reply,/passed integrity and manifest validation/i);
    const state=(await call('/state','GET',undefined,cookie)).body,mission=state.missions.find(item=>item.id===response.body.demoMissionId);
    assert.equal(mission.status,'paused');assert.equal(mission.input_refs.scenarioId,'melsoft-verified-assessment');assert.equal(state.missionTasks.filter(item=>item.mission_id===mission.id).length,9);assert.equal(state.agents.find(item=>item.slug==='chief').enabled,1);
  }finally{await app.close();rmSync(dir,{recursive:true,force:true});}
});

test('guided hackathon demo exposes failure, stops for approval, corrects and preserves receipts',async()=>{
  const dir=mkdtempSync(join(tmpdir(),'edu-bot-live-demo-')),app=createApp({databasePath:join(dir,'app.sqlite'),uploadRoot:join(dir,'uploads'),artifactRoot:join(dir,'artifacts')});
  await new Promise(resolve=>app.server.listen(0,'127.0.0.1',resolve));
  const base=`http://127.0.0.1:${app.server.address().port}/api`;
  const call=async(path,method='GET',payload,cookie='')=>{const response=await fetch(base+path,{method,headers:{...(payload?{'content-type':'application/json'}:{}),...(cookie?{cookie}:{})},body:payload?JSON.stringify(payload):undefined});return {status:response.status,body:await response.json(),cookie:response.headers.get('set-cookie')?.split(';')[0]};};
  try{
    const registered=await call('/auth/register','POST',{email:'demo@example.invalid',password:'secure-demo-password',organization:'Melsoft Demo'}),cookie=registered.cookie;
    const launched=await call('/education/demo/launch','POST',{},cookie);
    assert.equal(launched.status,201);assert.equal(launched.body.submissionCount,6);assert.equal(launched.body.fileCount,8);assert.equal(launched.body.missionStatus,'paused');assert.equal(launched.body.checkpoint,'delegated');
    const missionId=launched.body.missionId;

    const failure=await call(`/education/demo/${missionId}/advance`,'POST',{},cookie);
    assert.equal(failure.status,200);assert.equal(failure.body.checkpoint,'failure_detected');assert.equal(failure.body.missionStatus,'paused');assert.equal(failure.body.findings.length,1);
    assert.equal(Number(failure.body.findings[0].observed)-Number(failure.body.findings[0].expected),15);

    const stopped=await call(`/education/demo/${missionId}/advance`,'POST',{},cookie);
    assert.equal(stopped.status,200);assert.equal(stopped.body.checkpoint,'approval_required');assert.equal(stopped.body.missionStatus,'awaiting_approval');assert.equal(stopped.body.approval.status,'pending');
    let state=(await call('/state','GET',undefined,cookie)).body;
    const finding=state.qaFindings.find(item=>item.mission_id===missionId),approval=state.educationApprovals.find(item=>item.mission_id===missionId),markedPapers=state.artifacts.find(item=>item.mission_id===missionId&&item.artifact_type==='corrected_marked_papers_pdf');
    assert.equal(finding.verification_state,'verified');assert.equal(state.gradebookProposals.find(item=>item.mission_id===missionId).status,'previewed');
    assert.equal(markedPapers.mime_type,'application/pdf');assert.match(markedPapers.title,/corrected marked papers/i);
    assert.equal((await call(`/education/approvals/${approval.id}/approve`,'POST',{actionHash:approval.action_hash},cookie)).status,200);

    const completed=await call(`/education/demo/${missionId}/advance`,'POST',{},cookie);
    assert.equal(completed.status,200);assert.equal(completed.body.checkpoint,'completed');assert.equal(completed.body.missionStatus,'completed');
    state=(await call('/state','GET',undefined,cookie)).body;
    const proposal=state.gradebookProposals.find(item=>item.mission_id===missionId),tasks=state.missionTasks.filter(item=>item.mission_id===missionId),calls=state.toolCalls.filter(item=>item.mission_id===missionId);
    assert.equal(proposal.status,'verified');assert.equal(proposal.write_receipt.writtenStudentIds.length,6);assert.equal(proposal.write_receipt.liveGoogleVerified,false);
    assert.equal(tasks.length,9);assert.ok(tasks.every(item=>item.status==='completed'));assert.equal(calls.length,9);assert.ok(calls.every(item=>item.status==='succeeded'));
    assert.ok(state.artifacts.some(item=>item.mission_id===missionId&&item.artifact_type==='class_report'));
    assert.ok(state.missionEvents.some(item=>item.mission_id===missionId&&item.event_type==='correction_completed'));
    assert.ok(state.missionEvents.some(item=>item.mission_id===missionId&&item.event_type==='mission_finished'));
  }finally{await app.close();rmSync(dir,{recursive:true,force:true});}
});

test('hybrid demo uses Gemini live for CHIEF planning and grounded assessment feedback',async()=>{
  const dir=mkdtempSync(join(tmpdir(),'edu-bot-hybrid-demo-')),studentIds=['STU-001','STU-002','STU-003','STU-004','STU-005','STU-006'],criteria=['thesis','privacy','respect','critical','structure'],requests=[];
  const chatFetch=async(_url,options)=>{
    const payload=JSON.parse(options.body),prompt=payload.contents.at(-1).parts[0].text;requests.push(prompt);
    const content=prompt.includes('Plan this live academic mission')
      ?JSON.stringify({briefing:'Six submissions require a verified assessment workflow.',delegationSummary:'CHIEF delegates nine governed steps to specialist bots.',risks:['Incorrect totals','Unapproved record changes'],approvalBoundary:'Stop before writing any academic record.'})
      :JSON.stringify({assessments:studentIds.map(studentId=>({studentId,evidenceByCriterion:Object.fromEntries(criteria.map(key=>[key,`Grounded ${key} evidence for ${studentId}.`])),feedback:`Constructive Gemini feedback for ${studentId}.`}))});
    return new Response(JSON.stringify({candidates:[{content:{parts:[{text:content}]}}]}),{status:200,headers:{'content-type':'application/json'}});
  };
  const app=createApp({databasePath:join(dir,'app.sqlite'),uploadRoot:join(dir,'uploads'),artifactRoot:join(dir,'artifacts'),geminiApiKey:'test-gemini-key',chatFetch});
  await new Promise(resolve=>app.server.listen(0,'127.0.0.1',resolve));
  const base=`http://127.0.0.1:${app.server.address().port}/api`,call=async(path,method='GET',payload,cookie='')=>{const response=await fetch(base+path,{method,headers:{...(payload?{'content-type':'application/json'}:{}),...(cookie?{cookie}:{})},body:payload?JSON.stringify(payload):undefined});return {status:response.status,body:await response.json(),cookie:response.headers.get('set-cookie')?.split(';')[0]};};
  try{
    const registered=await call('/auth/register','POST',{email:'hybrid@example.invalid',password:'secure-demo-password',organization:'Hybrid Demo'}),cookie=registered.cookie;
    const launched=await call('/education/demo/launch','POST',{},cookie);assert.equal(launched.status,201);assert.equal(launched.body.ai.status,'live');
    const failure=await call(`/education/demo/${launched.body.missionId}/advance`,'POST',{},cookie);assert.equal(failure.body.checkpoint,'failure_detected',JSON.stringify(failure.body));
    const state=(await call('/state','GET',undefined,cookie)).body,assessment=state.missionTasks.find(item=>item.mission_id===launched.body.missionId&&item.step_key==='assess');
    assert.equal(assessment.result.ai.status,'live_generated');assert.equal(assessment.result.ai.model,'gemini-3.1-flash-lite');
    assert.ok(state.missionEvents.some(item=>item.mission_id===launched.body.missionId&&item.event_type==='gemini_plan_generated'));
    assert.ok(state.missionEvents.some(item=>item.mission_id===launched.body.missionId&&item.event_type==='gemini_generated'));
    assert.equal(requests.length,2);
  }finally{await app.close();rmSync(dir,{recursive:true,force:true});}
});
