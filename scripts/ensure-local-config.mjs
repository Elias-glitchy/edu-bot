import { randomBytes } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const target=resolve('.env.local');
let content='';
try{content=await readFile(target,'utf8');}catch(error){if(error.code!=='ENOENT')throw error;}
if(!/^COLLEAGUE_ZERO_TOKEN_ENCRYPTION_KEY=/m.test(content)){
  const prefix=content&& !content.endsWith('\n')?'\n':'';
  content+=`${prefix}# Local encrypted OAuth vault key. Never commit or share this file.\nCOLLEAGUE_ZERO_TOKEN_ENCRYPTION_KEY=${randomBytes(32).toString('base64')}\n`;
  await writeFile(target,content,{encoding:'utf8',mode:0o600});
}
