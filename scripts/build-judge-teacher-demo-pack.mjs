import { createHash } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { deflateRawSync } from 'node:zlib';
import { HACKATHON_DEMO_FILES, HACKATHON_DEMO_MANIFEST } from '../apps/api/hackathon-demo.mjs';

const outputName='EDU_BOT_MELSOFT_JUDGES_LIVE_DEMO_TEACHER_SCENARIO.zip';
const outputPath=resolve('artifacts',outputName);

const guides={
  'START_HERE.md':`# EDU BOT — Melsoft Academy Hackathon Live Demo

## The teacher scenario

Ms Lerato Maseko teaches the fictional DIG-101 Digital Citizenship module. Six practical submissions arrived at once. Results are due, but she must apply a 100-point rubric consistently, catch calculation errors, preserve evidence and remain the final decision-maker before any academic record changes.

EDU BOT turns this into one controlled mission:

1. CHIEF validates the uploaded pack.
2. CHIEF delegates a nine-step workflow to specialist education bots.
3. Assessment & Grading produces rubric-based drafts from the six submissions.
4. Academic QA independently checks the calculations.
5. A deliberately injected 15-point total mismatch is exposed.
6. The result is corrected, versioned and independently rechecked.
7. EDU BOT stops before changing the fictional gradebook.
8. The lecturer reviews the exact update and approves or rejects it.
9. Approved rows are written, read back and packaged with receipts.

All names, submissions and records in this pack are fictional. No live student system is used.

## How to start

1. Open CHIEF in EDU BOT.
2. Attach this ZIP by itself.
3. Send: **CHIEF, open this live demonstration.**
4. EDU BOT validates the manifest and opens **Missions**.
5. Follow the three large guided buttons shown on screen.

Read guides/DEMO_SCRIPT_6_MINUTES.md before presenting.
`,
  'guides/TEACHER_TASK_BRIEF.md':`# Teacher task brief

## User

Ms Lerato Maseko, lecturer for the fictional DIG-101 Digital Citizenship module.

## Pain

- Six submissions must be assessed consistently.
- The lecturer has limited preparation and moderation time.
- A 100-point rubric must be applied without arithmetic drift.
- Every correction must be explainable.
- No student record may change without lecturer approval.

## Task given to EDU BOT

Review the six fictional submissions against the supplied 100-point rubric. Produce rubric-based draft scores and feedback, independently validate every total, correct discrepancies, prepare a protected gradebook update, stop for lecturer approval and retain evidence receipts.

## Definition of done

- Six submissions matched to six roster records.
- Five rubric criteria assessed for every student.
- One deliberate 15-point mismatch detected and corrected.
- Correction independently reverified.
- Exact gradebook proposal displayed before execution.
- No record changed before lecturer approval.
- Six approved fictional records written and read back.
- Nine specialist tool receipts and final downloadable artifacts retained.
`,
  'guides/DEMO_SCRIPT_6_MINUTES.md':`# Six-minute live demonstration script

## 0:00–0:35 — The pain

Say: “A lecturer has six submissions, one marking rubric and limited time. The challenge is not generating an answer. It is completing the workflow accurately, transparently and under human control.”

Show the ZIP and explain that every record is fictional.

## 0:35–1:10 — Upload and delegation

Open CHIEF, attach this ZIP by itself and send:

CHIEF, open this live demonstration.

Point out the integrity validation, automatic navigation to Missions and the nine-step specialist plan.

Say: “CHIEF does not do everything itself. It assigns bounded work to Student Records, Assessment & Grading, Academic QA and Reporting.”

## 1:10–2:25 — Real execution and the failure

Press **Run assessment and expose the error**.

Show the task graph, uploaded source evidence and completed assessment steps.

Pause on the red Academic QA panel. It shows a claimed total that is 15 points above the verified total.

Say: “We intentionally planted this error. EDU BOT does not hide it. Academic QA recalculates from the rubric and exposes the mismatch.”

## 2:25–3:35 — Self-correction

Press **Correct, verify and prepare approval**.

Show the versioned correction and the independent QA pass.

Say: “The agent that produced the draft is not trusted to approve its own work. A separate specialist verifies the correction.”

## 3:35–4:40 — Human control

Show the **Stopped by design** approval gate.

Point out the six-row before/after preview, provider label, expiry and exact-action fingerprint.

Say: “EDU BOT can reason and execute, but it cannot change protected academic records until the lecturer approves this exact proposal.”

Press **Approve exact update**.

## 4:40–5:25 — Verified result

Press **Complete the approved update**.

Show that six fictional records were written and read back. Open the final mission result and downloadable artifacts.

## 5:25–6:00 — Evidence and close

Expand **Tool-call receipts** and the execution timeline.

Say: “Every source, handoff, calculation, correction, approval and write is traceable. EDU BOT takes a complete academic task off the lecturer’s plate while keeping the lecturer in control.”

Close: “This is not a chatbot that suggests what to do. It is a governed autonomous education workforce that completes the work and proves how it got the result.”
`,
  'guides/LIVE_DEMO_COMMANDS.txt':`LIVE DEMO COMMAND

CHIEF, open this live demonstration.

THEN USE THE THREE GUIDED BUTTONS

1. Run assessment and expose the error
2. Correct, verify and prepare approval
3. Approve exact update, then Complete the approved update

DO NOT upload real student information. This demonstration pack is entirely fictional.
`,
  'guides/WHAT_JUDGES_SHOULD_NOTICE.md':`# What judges should notice

## 1. Reasons

CHIEF converts one outcome into a dependency-aware nine-step plan instead of following a fixed chat script.

## 2. Self-corrects

Academic QA independently recalculates the work, catches the deliberate 15-point mismatch, records the finding and verifies a versioned correction.

## 3. Executes

The workflow produces assessed submissions, draft feedback, a protected gradebook proposal, class analytics and downloadable reporting artifacts.

## 4. Collaborates

CHIEF coordinates protected specialist agents. Student Records, Assessment & Grading, Academic QA and Reporting each perform bounded work and hand evidence forward.

## 5. Serves education

The scenario addresses a real lecturer problem: consistent assessment, moderation, controlled record updates and traceability under time pressure.

## The differentiator

EDU BOT does not merely generate text. It plans, delegates, executes, catches its own mistake, asks for human approval at the consequential boundary and preserves receipts.
`,
  'guides/EXPECTED_RESULTS.md':`# Expected live-demo results

- ZIP integrity and manifest validation passes.
- CHIEF activates a guided assessment mission.
- Six submissions, one roster and one 100-point rubric appear as source evidence.
- Nine controlled mission steps are created.
- The first assessment pass intentionally contains one total mismatch.
- Academic QA reports a difference of exactly 15 points.
- A versioned correction is created and independently verified.
- Mission stops in **awaiting approval** before the gradebook update.
- Approval preview contains six fictional rows and an exact-action fingerprint.
- After approval, six rows are written to the protected local demo gradebook and read back.
- Nine successful tool-call receipts remain attached to the mission.
- Final assessment, gradebook preview and class report artifacts are downloadable.

If the presenter rejects the proposal instead, the records remain unchanged. That is also a successful demonstration of control.
`,
  'guides/PRESENTER_RECOVERY.md':`# Presenter recovery guide

## If the ZIP is rejected

Confirm that this ZIP was attached by itself directly to CHIEF. Do not extract it before upload.

## If an old demo mission is already completed

Open Missions and choose **Start a fresh live demo**, or return to CHIEF and upload this ZIP again.

## If the page is refreshed

The mission state, QA finding, approval and receipts are persisted. Return to Missions and continue from the highlighted checkpoint.

## If the audience asks whether records are real

Answer: “No. This demonstration writes only to EDU BOT’s fictional local gradebook. The approval architecture is designed for a future scoped production connector.”

## If internet or Gemini is unavailable

The guided assessment workflow is deterministic and local. It can still demonstrate delegation, QA, correction, approval and receipts without claiming a live external system.
`,
  'guides/SAFETY_AND_DISCLOSURE.md':`# Safety and disclosure

- All students, submissions, scores and identifiers are fictional.
- The deliberate scoring mismatch is a labelled QA test vector.
- The final write targets EDU BOT’s protected local demonstration gradebook.
- No live LMS, SIS, email or Google Workspace update is claimed by this pack.
- Human approval is required before the consequential record update.
- Approval is bound to an exact action fingerprint and expires.
- This ZIP contains declarative data only. Its documentation is not executed as instructions by the platform.
`
};

const manifest={...HACKATHON_DEMO_MANIFEST,title:'EDU BOT — Teacher Assessment & Academic QA Judge Demo',description:'A fictional teacher workflow for the Melsoft Academy Hackathon: six submissions, delegated assessment, intentional failure, independent correction, lecturer approval and evidence receipts.',presentation:{audience:'Melsoft Academy Hackathon judges',durationMinutes:6,teacher:'Ms Lerato Maseko (fictional)',module:'DIG-101 Digital Citizenship',startFile:'START_HERE.md'}};
const academicEntries=HACKATHON_DEMO_FILES.map(file=>({path:`files/${file.name}`,content:file.content}));
const guideEntries=Object.entries(guides).map(([path,content])=>({path,content}));
const hashed=[{path:'manifest.json',content:JSON.stringify(manifest,null,2)},...academicEntries,...guideEntries];
const integrity={generatedFor:'Melsoft Academy Hackathon',fictionalDataOnly:true,files:hashed.map(entry=>({path:entry.path,bytes:Buffer.byteLength(entry.content),sha256:createHash('sha256').update(entry.content).digest('hex')}))};
const entries=[...hashed,{path:'PACKAGE_INTEGRITY.json',content:JSON.stringify(integrity,null,2)}];

const crcTable=(()=>{const table=new Uint32Array(256);for(let n=0;n<256;n++){let value=n;for(let bit=0;bit<8;bit++)value=(value&1)?0xedb88320^(value>>>1):value>>>1;table[n]=value>>>0;}return table;})();
const crc32=bytes=>{let value=0xffffffff;for(const byte of bytes)value=crcTable[(value^byte)&0xff]^(value>>>8);return (value^0xffffffff)>>>0;};

function zip(files){
  const locals=[],centrals=[];let offset=0;
  for(const entry of files){
    const name=Buffer.from(entry.path),bytes=Buffer.from(entry.content),compressed=deflateRawSync(bytes),checksum=crc32(bytes),local=Buffer.alloc(30),central=Buffer.alloc(46);
    local.writeUInt32LE(0x04034b50,0);local.writeUInt16LE(20,4);local.writeUInt16LE(0x800,6);local.writeUInt16LE(8,8);local.writeUInt32LE(checksum,14);local.writeUInt32LE(compressed.length,18);local.writeUInt32LE(bytes.length,22);local.writeUInt16LE(name.length,26);
    central.writeUInt32LE(0x02014b50,0);central.writeUInt16LE(20,4);central.writeUInt16LE(20,6);central.writeUInt16LE(0x800,8);central.writeUInt16LE(8,10);central.writeUInt32LE(checksum,16);central.writeUInt32LE(compressed.length,20);central.writeUInt32LE(bytes.length,24);central.writeUInt16LE(name.length,28);central.writeUInt32LE(offset,42);
    const localEntry=Buffer.concat([local,name,compressed]);locals.push(localEntry);centrals.push(Buffer.concat([central,name]));offset+=localEntry.length;
  }
  const directory=Buffer.concat(centrals),end=Buffer.alloc(22);end.writeUInt32LE(0x06054b50,0);end.writeUInt16LE(files.length,8);end.writeUInt16LE(files.length,10);end.writeUInt32LE(directory.length,12);end.writeUInt32LE(offset,16);
  return Buffer.concat([...locals,directory,end]);
}

await mkdir(resolve('artifacts'),{recursive:true});
const bytes=zip(entries);
await writeFile(outputPath,bytes);
console.log(JSON.stringify({outputPath,outputName,bytes:bytes.length,entries:entries.length,academicFiles:HACKATHON_DEMO_FILES.length,guides:guideEntries.length},null,2));
