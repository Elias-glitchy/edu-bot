import { execFile as execFileCallback } from 'node:child_process';
import { spawn } from 'node:child_process';
import { promisify } from 'node:util';
import { existsSync } from 'node:fs';

const execFile=promisify(execFileCallback);
const safeName=value=>String(value).toLowerCase().replace(/[^a-z0-9_.-]/g,'').slice(0,48);
const defaultDockerCommand=()=>process.env.COLLEAGUE_ZERO_DOCKER_COMMAND||(process.platform==='win32'&&existsSync('C:\\Program Files\\Docker\\Docker\\resources\\bin\\docker.exe')?'C:\\Program Files\\Docker\\Docker\\resources\\bin\\docker.exe':'docker');
const delay=milliseconds=>new Promise(resolve=>setTimeout(resolve,milliseconds));

export class ComputerProviderError extends Error {
  constructor(message,status=503){super(message);this.status=status;}
}

export class DockerComputerProvider {
  constructor({image=process.env.COLLEAGUE_ZERO_COMPUTER_IMAGE||'build-bot-computer:dev',command=execFile,dockerCommand=defaultDockerCommand(),maxRunningComputers=process.env.COLLEAGUE_ZERO_MAX_RUNNING_COMPUTERS||1,cpus=process.env.COLLEAGUE_ZERO_COMPUTER_CPUS||3}={}) {
    this.kind='docker';this.image=image;this.command=command;this.dockerCommand=dockerCommand;this.maxRunningComputers=Math.max(1,Number(maxRunningComputers)||1);this.cpus=Math.max(1,Number(cpus)||3);this.provisioning=new Map();
  }
  async run(args,{timeout=120000}={}) {
    try {const result=await this.command(this.dockerCommand,args,{timeout,windowsHide:true,maxBuffer:4_000_000});return String(result.stdout||'').trim();}
    catch(error){throw new ComputerProviderError(String(error?.stderr||error?.message||error).trim().slice(0,500));}
  }
  async runWithInput(args,input,{timeout=120000}={}){
    return new Promise((resolve,reject)=>{
      const child=spawn(this.dockerCommand,args,{windowsHide:true,stdio:['pipe','pipe','pipe']}),stdout=[],stderr=[];let size=0,settled=false;
      const timer=setTimeout(()=>{if(!settled){settled=true;child.kill();reject(new ComputerProviderError('Docker computer action timed out.'));}},timeout);
      child.stdout.on('data',chunk=>{size+=chunk.length;if(size<=4_000_000)stdout.push(chunk);});child.stderr.on('data',chunk=>{size+=chunk.length;if(size<=4_000_000)stderr.push(chunk);});
      child.on('error',error=>{if(settled)return;settled=true;clearTimeout(timer);reject(new ComputerProviderError(String(error.message||error).slice(0,500)));});
      child.on('close',code=>{if(settled)return;settled=true;clearTimeout(timer);const out=Buffer.concat(stdout).toString('utf8').trim(),err=Buffer.concat(stderr).toString('utf8').trim();if(code===0)resolve(out);else reject(new ComputerProviderError((err||`Docker exited with code ${code}.`).slice(0,500)));});
      child.stdin.end(input);
    });
  }
  names(computer){
    const suffix=safeName(computer.id).replaceAll('-','').slice(0,24);
    return {container:`build-bot-${suffix}`,volume:`build-bot-${suffix}-home`};
  }
  async available(){
    try {await this.run(['version','--format','{{.Server.Version}}'],{timeout:30000});return {available:true,provider:this.kind};}
    catch(error){return {available:false,provider:this.kind,error:'Docker Desktop is not ready. Install/enable WSL 2, start Docker Desktop, and retry.'};}
  }
  async status(computer){
    if(!computer.provider_ref)return {state:'unprovisioned',hostPort:null};
    try{
      const dockerState=await this.run(['inspect','--format','{{.State.Status}}',computer.provider_ref],{timeout:20000});
      let hostPort=null;
      if(['running','paused'].includes(dockerState)){
        const portLine=await this.run(['port',computer.provider_ref,'6080/tcp'],{timeout:20000});
        const match=portLine.match(/:(\d+)\s*$/);hostPort=match?Number(match[1]):null;
      }
      return {state:dockerState==='created'?'stopped':dockerState,hostPort};
    }catch(error){
      if(/no such (object|container)/i.test(error.message))return {state:'missing',hostPort:null};
      throw error;
    }
  }
  async provision(computer){
    const existing=this.provisioning.get(computer.id);if(existing)return existing;
    const pending=this.provisionOnce(computer).finally(()=>this.provisioning.delete(computer.id));
    this.provisioning.set(computer.id,pending);return pending;
  }
  async provisionOnce(computer){
    const {container,volume}=this.names(computer);
    await this.run(['volume','create',volume]);
    let exists=await this.run(['container','ls','-a','--filter',`name=^/${container}$`,'--format','{{.Names}}']).catch(()=> '');
    if(exists){
      const currentImage=await this.run(['inspect','--format','{{.Image}}',container]),desiredImage=await this.run(['image','inspect',this.image,'--format','{{.Id}}']);
      if(currentImage!==desiredImage){await this.run(['rm','--force',container]);exists='';}
      else {
        const currentNanoCpus=Number(await this.run(['inspect','--format','{{.HostConfig.NanoCpus}}',container]));
        if(currentNanoCpus!==Math.round(this.cpus*1_000_000_000))await this.run(['update','--cpus',String(this.cpus),container]);
      }
    }
    if(!exists)try{await this.run(['create','--name',container,
        '--label',`build-bot.computer-id=${computer.id}`,'--label',`build-bot.organization-id=${computer.organization_id}`,
        '--read-only','--cap-drop','ALL','--security-opt','no-new-privileges:true','--pids-limit','512','--memory','2g','--cpus',String(this.cpus),'--shm-size','1g',
        '--tmpfs','/tmp:rw,noexec,nosuid,size=512m','--tmpfs','/run:rw,noexec,nosuid,size=64m',
        '--mount',`type=volume,source=${volume},target=/home/bot`,'-p','127.0.0.1::6080',this.image]);}
      catch(error){
        if(!/already in use|already exists|conflict/i.test(error.message))throw error;
        const owner=await this.run(['inspect','--format','{{ index .Config.Labels "build-bot.computer-id" }}',container]).catch(()=> '');
        if(owner!==computer.id)throw error;
      }
    return {providerRef:container,volumeRef:volume};
  }
  async start(computer){
    const prepared=await this.provision(computer),names={container:prepared.providerRef,volume:prepared.volumeRef};
    await this.run(['start',names.container]);
    const portLine=await this.run(['port',names.container,'6080/tcp']);
    const match=portLine.match(/:(\d+)\s*$/);if(!match)throw new ComputerProviderError('Docker started the bot computer but did not publish its noVNC port.');
    const hostPort=Number(match[1]),desktopUrl=`http://127.0.0.1:${hostPort}/vnc.html`;let lastError;
    for(let attempt=0;attempt<45;attempt+=1){
      try{const response=await fetch(desktopUrl,{signal:AbortSignal.timeout(2000)});if(response.ok)return {providerRef:names.container,volumeRef:names.volume,hostPort};lastError=new Error(`HTTP ${response.status}`);}
      catch(error){lastError=error;}
      await delay(1000);
    }
    await this.run(['stop','--time','15',names.container]).catch(()=>{});
    throw new ComputerProviderError(`The bot computer started, but its live desktop did not become ready: ${String(lastError?.message||lastError||'startup timeout').slice(0,200)}`);
  }
  async stop(computer){if(computer.provider_ref)await this.run(['stop','--time','15',computer.provider_ref]).catch(()=>{});return {stopped:true};}
  async pause(computer){if(computer.provider_ref)await this.run(['pause',computer.provider_ref]);return {paused:true};}
  async resume(computer){if(computer.provider_ref)await this.run(['unpause',computer.provider_ref]);return {running:true};}
  async reset(computer){
    const names=this.names(computer),container=computer.provider_ref||names.container;
    await this.run(['rm','--force',container]).catch(()=>{});
    return this.provision({...computer,provider_ref:null,volume_ref:computer.volume_ref||names.volume});
  }
  async destroy(computer,{deleteVolume=false}={}){
    const names=this.names(computer);await this.run(['rm','--force',computer.provider_ref||names.container]).catch(()=>{});
    if(deleteVolume)await this.run(['volume','rm',computer.volume_ref||names.volume]).catch(()=>{});
    return {destroyed:true,volumeDeleted:deleteVolume};
  }
  async browserAction(computer,payload){
    if(!computer.provider_ref||computer.state!=='running')throw new ComputerProviderError('The bot computer must be running before browser automation.');
    let output;
    try{output=await this.runWithInput(['exec','-i',computer.provider_ref,'curl','--silent','--show-error','--unix-socket','/tmp/build-bot-browser.sock','-H','Content-Type: application/json','--data-binary','@-','http://localhost/action'],JSON.stringify(payload),{timeout:90000});}
    catch(error){
      if(!/Could not connect|Failed to connect|No such file/i.test(error.message))throw error;
      output=await this.runWithInput(['exec','-i',computer.provider_ref,'node','/opt/build-bot/browser-action.mjs'],JSON.stringify(payload),{timeout:90000});
    }
    try{const result=JSON.parse(output.split(/\r?\n/).at(-1));if(result.error)throw new ComputerProviderError(result.error);return result;}
    catch(error){if(error instanceof ComputerProviderError)throw error;throw new ComputerProviderError('The browser automation sidecar returned an invalid result.');}
  }
}

export class FakeComputerProvider {
  constructor(){this.kind='fake';this.records=new Map();this.port=46000;}
  async available(){return {available:true,provider:this.kind};}
  async status(computer){const record=this.records.get(computer.id);return record?{state:record.state,hostPort:record.hostPort||null}:{state:'missing',hostPort:null};}
  async provision(computer){const result={providerRef:`fake-${computer.id}`,volumeRef:`fake-${computer.id}-home`};this.records.set(computer.id,{state:'stopped',...result});return result;}
  async start(computer){let record=this.records.get(computer.id);if(!record)record={state:'stopped',...await this.provision(computer)};record.state='running';record.hostPort=++this.port;this.records.set(computer.id,record);return record;}
  async stop(computer){const record=this.records.get(computer.id);if(record)record.state='stopped';return {stopped:true};}
  async pause(computer){const record=this.records.get(computer.id);if(record)record.state='paused';return {paused:true};}
  async resume(computer){const record=this.records.get(computer.id);if(record)record.state='running';return {running:true};}
  async reset(computer){const previous=this.records.get(computer.id);const result={providerRef:previous?.providerRef||`fake-${computer.id}`,volumeRef:previous?.volumeRef||`fake-${computer.id}-home`};this.records.set(computer.id,{state:'stopped',...result});return result;}
  async destroy(computer){this.records.delete(computer.id);return {destroyed:true};}
  async browserAction(computer,payload){const record=this.records.get(computer.id);if(!record||record.state!=='running')throw new ComputerProviderError('The bot computer must be running before browser automation.');return {ok:true,action:payload.action,url:payload.url||'about:blank',title:'Fake computer'};}
}

export const createDockerComputerProvider=options=>new DockerComputerProvider(options);
export const createFakeComputerProvider=()=>new FakeComputerProvider();
