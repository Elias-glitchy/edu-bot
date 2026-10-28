import test from 'node:test';
import assert from 'node:assert/strict';
import { livePlan, validatePublicUrl, browsePage, searchX } from '../apps/api/live-tools.mjs';
import { generateChatReply, selectInternalMode } from '../apps/api/chat.mjs';

const publicLookup=async()=>[{address:'93.184.215.14'}];
const agent={name:'CHIEF',role:'Assistant',instructions:''};

test('fresh requests and page URLs force reasoning; ordinary chat stays everyday',()=>{
  assert.equal(selectInternalMode('Hi'),'everyday');
  for(const message of ['What happened today?','Latest news about EVs','Current Bitcoin price','Verify this fact','What are people saying on X?','Summarize https://example.org/story']) {
    assert.equal(selectInternalMode(message),'reasoning',message);
    assert.equal(livePlan(message).needed,true,message);
  }
  assert.equal(searchX().available,false);
});

test('page browsing rejects private destinations and private redirects',async()=>{
  await assert.rejects(validatePublicUrl('http://example.org'),/Only public HTTPS/);
  await assert.rejects(validatePublicUrl('https://localhost:11434/api/chat'),/Only public HTTPS|Local or private/);
  await assert.rejects(validatePublicUrl('https://192.168.1.1/'),/Local or private/);
  const fetchImpl=async()=>new Response(null,{status:302,headers:{Location:'https://127.0.0.1/private'}});
  await assert.rejects(browsePage('https://example.org/start',{fetchImpl,lookupImpl:publicLookup}),/Local or private/);
});

test('live search and page text are supplied to local reasoning model with verified citations',async()=>{
  const calls=[];
  const toolFetch=async(url)=>{
    calls.push(url);
    if(url.startsWith('https://api.search.brave.com/')) return new Response(JSON.stringify({web:{results:[{title:'Fresh report',url:'https://example.org/report',description:'Snippet text'}]}}),{status:200});
    if(url==='https://example.org/report') return new Response('<html><body><main>Verified report text</main></body></html>',{status:200,headers:{'content-type':'text/html'}});
    throw new Error(`Unexpected URL: ${url}`);
  };
  let payload;
  const fetchImpl=async(url,options)=>{assert.equal(url,'http://localhost:11434/api/chat');payload=JSON.parse(options.body);return new Response(JSON.stringify({message:{content:'The report says so [1].'}}),{status:200});};
  const reply=await generateChatReply({agent,message:'What is the latest report?',fetchImpl,toolFetch,lookupImpl:publicLookup,searchApiKey:'test-key'});
  assert.equal(payload.model,'qwen2.5:3b');
  assert.match(JSON.stringify(payload.messages),/Verified report text/);
  assert.match(reply,/Sources:\n\[1\] Fresh report — https:\/\/example\.org\/report/);
  assert.equal(calls.length,2);
});

test('fresh search fails clearly without a search key rather than guessing',async()=>{
  await assert.rejects(generateChatReply({agent,message:'What is the latest news?',searchApiKey:''}),/not configured/);
});
