import { chromium } from 'playwright-core';
import { spawn } from 'node:child_process';

const sleep=milliseconds=>new Promise(resolve=>setTimeout(resolve,milliseconds));
async function connectBrowser(){
  try{return await chromium.connectOverCDP('http://127.0.0.1:9222');}catch{}
  const launcher=spawn('/opt/build-bot/launch-chromium.sh',[],{detached:true,stdio:'ignore'});launcher.unref();
  let lastError;
  for(let attempt=0;attempt<90;attempt+=1){try{return await chromium.connectOverCDP('http://127.0.0.1:9222');}catch(error){lastError=error;await sleep(500);}}
  throw lastError||new Error('Chromium did not become ready.');
}

let raw='';for await(const chunk of process.stdin)raw+=chunk;if(raw.length>100_000)throw new Error('Browser action payload is too large.');
const payload=JSON.parse(raw||'{}');
const browser=await connectBrowser();
const context=browser.contexts()[0],page=context.pages()[0]||await context.newPage();
let result;
if(payload.action==='navigate'){
  const url=new URL(String(payload.url||''));
  if(url.protocol!=='https:')throw new Error('Only public HTTPS navigation is allowed.');
  await page.goto(url.href,{waitUntil:'domcontentloaded',timeout:30000});result={url:page.url(),title:await page.title()};
}else if(payload.action==='click'){
  await page.locator(String(payload.selector||'')).click({timeout:10000});result={url:page.url(),title:await page.title()};
}else if(payload.action==='fill'){
  await page.locator(String(payload.selector||'')).fill(String(payload.value||''),{timeout:10000});result={ok:true};
}else if(payload.action==='text'){
  result={url:page.url(),title:await page.title(),text:(await page.locator('body').innerText()).slice(0,20000)};
}else if(payload.action==='screenshot'){
  result={url:page.url(),title:await page.title(),pngBase64:(await page.screenshot({type:'png'})).toString('base64')};
}else throw new Error('Unsupported browser action.');
console.log(JSON.stringify(result));
await browser.close();
