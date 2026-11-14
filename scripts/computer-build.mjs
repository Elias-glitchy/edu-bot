import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';

const run=promisify(execFile),dockerCommand=process.env.COLLEAGUE_ZERO_DOCKER_COMMAND||(process.platform==='win32'&&existsSync('C:\\Program Files\\Docker\\Docker\\resources\\bin\\docker.exe')?'C:\\Program Files\\Docker\\Docker\\resources\\bin\\docker.exe':'docker');
const {stdout,stderr}=await run(dockerCommand,['build','-t',process.env.COLLEAGUE_ZERO_COMPUTER_IMAGE||'build-bot-computer:dev',resolve('infra/computer-image')],{timeout:20*60_000,windowsHide:true,maxBuffer:20_000_000});
if(stdout)process.stdout.write(stdout);if(stderr)process.stderr.write(stderr);
