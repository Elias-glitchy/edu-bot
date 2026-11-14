import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createApp } from '../apps/api/server.mjs';

test('chat attachments are stored, scoped, rendered in state and supplied to the selected bot',async()=>{
  const dir=mkdtempSync(join(tmpdir(),'build-chat-files-')),requests=[];
  const app=createApp({databasePath:join(dir,'app.sqlite'),aiProvider:'openai',openaiApiKey:'test-key',chatFetch:async(_url,options)=>{requests.push(JSON.parse(options.body));return new Response(JSON.stringify({output_text:'I reviewed the attachment.'}),{status:200});}});
  await new Promise(resolve=>app.server.listen(0,'127.0.0.1',resolve));
  const base=`http://127.0.0.1:${app.server.address().port}/api`;
  const call=async(path,method='GET',payload,cookie='')=>{const response=await fetch(base+path,{method,headers:{...(payload?{'content-type':'application/json'}:{}),...(cookie?{cookie}:{})},body:payload?JSON.stringify(payload):undefined});return {status:response.status,body:await response.json(),cookie:response.headers.get('set-cookie')?.split(';')[0]};};
  try{
    const registration=await call('/auth/register','POST',{email:'files@example.invalid',password:'secure-password',organization:'Files'}),cookie=registration.cookie;
    const initial=(await call('/state','GET',undefined,cookie)).body,chief=initial.agents.find(agent=>agent.slug==='chief');
    await call(`/agents/${chief.id}/activate`,'POST',{},cookie);
    const largeBytes=Buffer.alloc(12_100_000,0x61);
    const largeResponse=await fetch(`${base}/academic-files?name=large-reference.md&category=reference`,{method:'POST',headers:{cookie,'content-type':'text/markdown'},body:largeBytes}),largeUpload={status:largeResponse.status,body:await largeResponse.json()};
    assert.equal(largeUpload.status,201);
    const largeRecord=app.db.prepare('SELECT size,extracted_text,metadata FROM academic_files WHERE id=?').get(largeUpload.body.fileId);
    assert.equal(largeRecord.size,largeBytes.length);
    assert.equal(largeRecord.extracted_text.length,500_000);
    assert.equal(JSON.parse(largeRecord.metadata).extractionTruncated,true);
    const upload=await call('/academic-files','POST',{name:'brief.md',mimeType:'text/markdown',category:'reference',base64:Buffer.from(`# Course brief\nUse accessible examples.\n${'Detailed course material. '.repeat(250)}`).toString('base64')},cookie);
    assert.equal(upload.status,201);
    const sent=await call('/chat','POST',{message:'',fileIds:[upload.body.fileId]},cookie);
    assert.equal(sent.status,200);
    const state=(await call('/state','GET',undefined,cookie)).body,ownerMessage=state.messages.find(message=>message.id===sent.body.messageId);
    assert.equal(ownerMessage.body,'Please review the attached files.');
    assert.equal(ownerMessage.attachments.length,1);
    assert.equal(ownerMessage.attachments[0].original_name,'brief.md');
    assert.match(JSON.stringify(requests[0]),/Course brief/);
    assert.match(JSON.stringify(requests[0]),/untrusted reference material/);
  }finally{await app.close();rmSync(dir,{recursive:true,force:true});}
});
