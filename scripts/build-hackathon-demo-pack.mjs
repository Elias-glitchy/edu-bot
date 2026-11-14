import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { buildHackathonDemoPack, HACKATHON_DEMO_ZIP } from '../apps/api/hackathon-demo.mjs';

const outputDirectory=resolve('artifacts'),outputPath=resolve(outputDirectory,HACKATHON_DEMO_ZIP);
await mkdir(outputDirectory,{recursive:true});
const bytes=buildHackathonDemoPack();
await writeFile(outputPath,bytes);
console.log(`${outputPath}\n${bytes.length} bytes`);
