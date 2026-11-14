import { createServer } from 'node:http';
import { chmodSync, rmSync } from 'node:fs';
import { spawn } from 'node:child_process';
import { chromium } from 'playwright-core';

const socketPath='/tmp/build-bot-browser.sock';
const sleep=milliseconds=>new Promise(resolve=>setTimeout(resolve,milliseconds));
let connectedBrowser=null,connecting=null;

async function browser(){
  if(connectedBrowser?.isConnected())return connectedBrowser;
  if(connecting)return connecting;
  connecting=(async()=>{
    try{connectedBrowser=await chromium.connectOverCDP('http://127.0.0.1:9222');}
    catch{
      const launcher=spawn('/opt/build-bot/launch-chromium.sh',[],{detached:true,stdio:'ignore'});launcher.unref();
      let lastError;
      for(let attempt=0;attempt<180;attempt+=1){
        try{connectedBrowser=await chromium.connectOverCDP('http://127.0.0.1:9222');break;}
        catch(error){lastError=error;await sleep(250);}
      }
      if(!connectedBrowser)throw lastError||new Error('Chromium did not become ready.');
    }
    connectedBrowser.on('disconnected',()=>{connectedBrowser=null;});
    return connectedBrowser;
  })();
  try{return await connecting;}finally{connecting=null;}
}

async function execute(payload){
  const instance=await browser(),context=instance.contexts()[0],page=context.pages()[0]||await context.newPage();
  if(payload.action==='navigate'){
    const url=new URL(String(payload.url||''));if(url.protocol!=='https:')throw new Error('Only public HTTPS navigation is allowed.');
    await page.goto(url.href,{waitUntil:'domcontentloaded',timeout:30000});return {url:page.url(),title:await page.title()};
  }
  if(payload.action==='click'){await page.locator(String(payload.selector||'')).click({timeout:10000});return {url:page.url(),title:await page.title()};}
  if(payload.action==='fill'){await page.locator(String(payload.selector||'')).fill(String(payload.value||''),{timeout:10000});return {ok:true};}
  if(payload.action==='text')return {url:page.url(),title:await page.title(),text:(await page.locator('body').innerText()).slice(0,20000)};
  if(payload.action==='screenshot')return {url:page.url(),title:await page.title(),pngBase64:(await page.screenshot({type:'png'})).toString('base64')};
  throw new Error('Unsupported browser action.');
}

rmSync(socketPath,{force:true});
const server=createServer((request,response)=>{
  if(request.method!=='POST'||request.url!=='/action'){response.writeHead(404);response.end();return;}
  const chunks=[];let size=0,tooLarge=false;
  request.on('data',chunk=>{size+=chunk.length;if(size>100_000)tooLarge=true;else chunks.push(chunk);});
  request.on('end',async()=>{
    response.setHeader('Content-Type','application/json');
    if(tooLarge){response.writeHead(413);response.end(JSON.stringify({error:'Browser action payload is too large.'}));return;}
    try{const payload=JSON.parse(Buffer.concat(chunks).toString('utf8')||'{}');response.end(JSON.stringify(await execute(payload)));}
    catch(error){response.writeHead(500);response.end(JSON.stringify({error:String(error?.message||error).slice(0,1000)}));}
  });
});
server.listen(socketPath,()=>chmodSync(socketPath,0o600));
