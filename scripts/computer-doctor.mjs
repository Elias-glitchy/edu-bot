import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { existsSync } from 'node:fs';

const run=promisify(execFile),checks=[];
const dockerCommand=process.env.COLLEAGUE_ZERO_DOCKER_COMMAND||(process.platform==='win32'&&existsSync('C:\\Program Files\\Docker\\Docker\\resources\\bin\\docker.exe')?'C:\\Program Files\\Docker\\Docker\\resources\\bin\\docker.exe':'docker');
async function check(name,command,args){try{const {stdout}=await run(command,args,{timeout:15000,windowsHide:true});checks.push({name,ok:true,detail:String(stdout).trim().split(/\r?\n/)[0]||'ready'});}catch(error){checks.push({name,ok:false,detail:String(error?.stderr||error?.message||error).trim().split(/\r?\n/)[0]});}}
await check('WSL','wsl.exe',['--status']);
await check('Docker engine',dockerCommand,['version','--format','{{.Server.Version}}']);
await check('Computer image',dockerCommand,['image','inspect','build-bot-computer:dev','--format','{{.Id}}']);
for(const item of checks)console.log(`${item.ok?'PASS':'FAIL'}  ${item.name}: ${item.detail}`);
if(checks.some(item=>!item.ok))process.exitCode=1;
