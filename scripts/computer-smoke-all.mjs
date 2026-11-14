import { DatabaseSync } from 'node:sqlite';
import { resolve } from 'node:path';
import { createDockerComputerProvider } from '../apps/api/computer-provider.mjs';

const sleep=milliseconds=>new Promise(resolveSleep=>setTimeout(resolveSleep,milliseconds));
const desktopOnly=process.argv.includes('--desktop-only');
const db=new DatabaseSync(resolve(process.env.COLLEAGUE_ZERO_DB||'data/build-bot-colleague-zero.sqlite'));
const provider=createDockerComputerProvider();

async function waitFor(label,operation,{attempts=30,delayMs=1000}={}){
  let lastError;
  for(let attempt=1;attempt<=attempts;attempt+=1){
    try{return await operation();}catch(error){lastError=error;if(attempt<attempts)await sleep(delayMs);}
  }
  throw new Error(`${label} did not become ready: ${lastError?.message||lastError}`);
}

async function verifyComputer(entry){
  const totalStarted=performance.now();
  const originalState=entry.state;
  let runtime={...entry};
  let restore='none';
  if(originalState==='running'){
    const actual=await provider.status(entry);
    if(actual.state==='paused')await provider.resume(entry);
    const started=await provider.start(entry);
    runtime={...entry,state:'running',provider_ref:started.providerRef,volume_ref:started.volumeRef,host_port:started.hostPort};
    restore='none';
  }else if(originalState==='paused'){
    const actual=await provider.status(entry);
    if(actual.state==='paused')await provider.resume(entry);
    const target=actual.state==='missing'?{...entry,state:'stopped',provider_ref:null}:entry;
    const provisioned=!target.provider_ref||!target.volume_ref?await provider.provision(target):{providerRef:target.provider_ref,volumeRef:target.volume_ref};
    const started=await provider.start({...target,provider_ref:provisioned.providerRef,volume_ref:provisioned.volumeRef});
    runtime={...entry,state:'running',provider_ref:started.providerRef,volume_ref:started.volumeRef,host_port:started.hostPort};restore='pause';
  }else{
    const provisioned=entry.provider_ref&&entry.volume_ref
      ?{providerRef:entry.provider_ref,volumeRef:entry.volume_ref}
      :await provider.provision(entry);
    const started=await provider.start({...entry,provider_ref:provisioned.providerRef,volume_ref:provisioned.volumeRef});
    runtime={...entry,state:'running',provider_ref:started.providerRef,volume_ref:started.volumeRef,host_port:started.hostPort};
    restore='stop';
  }
  try{
    const desktopStarted=performance.now();
    await waitFor(`${entry.name} noVNC`,async()=>{
      const response=await fetch(`http://127.0.0.1:${runtime.host_port}/vnc.html`);
      if(!response.ok)throw new Error(`HTTP ${response.status}`);
      return response;
    });
    const desktopMs=Math.round(performance.now()-desktopStarted),browserStarted=performance.now();
    if(!desktopOnly)await waitFor(`${entry.name} Chromium`,async()=>provider.browserAction(runtime,{action:'text'}));
    const browserMs=desktopOnly?0:Math.round(performance.now()-browserStarted),totalMs=Math.round(performance.now()-totalStarted);
    const speed=desktopMs>3000||(!desktopOnly&&browserMs>3000)?'SLOW':'PASS';
    console.log(`${speed}  ${entry.organization_name} / ${entry.name}: desktop ${desktopMs} ms${desktopOnly?'':` · Chromium ${browserMs} ms`} · total ${totalMs} ms`);
    return {name:entry.name,organization:entry.organization_name,desktopMs,browserMs,totalMs,speed};
  }finally{
    if(restore==='pause')await provider.pause(runtime);
    if(restore==='stop')await provider.stop(runtime);
  }
}

try{
  const available=await provider.available();
  if(!available.available)throw new Error(available.error||'Docker is unavailable.');
  const computers=db.prepare(`SELECT c.*,a.name,a.slug,o.name AS organization_name FROM computers c JOIN agents a ON a.id=c.agent_id AND a.organization_id=c.organization_id JOIN organizations o ON o.id=c.organization_id WHERE a.kind='built_in' AND a.deleted_at IS NULL AND a.archived_at IS NULL ORDER BY o.name,CASE WHEN a.slug='chief' THEN 0 ELSE 1 END,a.name`).all();
  const counts=new Map();for(const computer of computers)counts.set(computer.organization_id,(counts.get(computer.organization_id)||0)+1);
  const invalid=[...counts.entries()].filter(([,count])=>count!==11);
  if(invalid.length)throw new Error(`Expected eleven built-in computers per workspace; invalid counts: ${invalid.map(([organizationId,count])=>`${organizationId}=${count}`).join(', ')}.`);
  const results=[];for(const computer of computers)results.push(await verifyComputer(computer));
  const sorted=results.map(result=>result.totalMs).sort((a,b)=>a-b),median=sorted[Math.floor(sorted.length/2)],p95=sorted[Math.min(sorted.length-1,Math.ceil(sorted.length*.95)-1)],slow=results.filter(result=>result.speed==='SLOW');
  console.log(`PASS  All ${computers.length} built-in bot computers across ${counts.size} workspace(s) are operational.`);
  console.log(`SPEED Median ${median} ms · p95 ${p95} ms · slow checks ${slow.length}`);
}finally{
  db.close();
}
