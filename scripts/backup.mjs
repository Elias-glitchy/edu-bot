import { DatabaseSync } from 'node:sqlite';
import { cpSync, existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { resolve, relative, sep } from 'node:path';

const projectRoot=resolve('.'),databasePath=resolve(projectRoot,process.env.COLLEAGUE_ZERO_DB||'data/build-bot-colleague-zero.sqlite'),stamp=new Date().toISOString().replace(/[:.]/g,'-'),backupRoot=resolve(projectRoot,'backups',stamp);
if(!databasePath.startsWith(projectRoot+sep))throw new Error('Database backup source must stay inside the project.');
mkdirSync(backupRoot,{recursive:true});
const backupDatabase=resolve(backupRoot,'build-bot-colleague-zero.sqlite'),db=new DatabaseSync(databasePath);db.exec('PRAGMA wal_checkpoint(FULL)');db.exec(`VACUUM INTO '${backupDatabase.replaceAll("'","''")}'`);db.close();
for(const folder of ['uploads','artifacts']){const source=resolve(projectRoot,'data',folder);if(existsSync(source))cpSync(source,resolve(backupRoot,folder),{recursive:true});}
const files=[];function walk(folder){for(const entry of readdirSync(folder,{withFileTypes:true})){const path=resolve(folder,entry.name);if(entry.isDirectory())walk(path);else files.push({path:relative(backupRoot,path).replaceAll('\\','/'),sha256:createHash('sha256').update(readFileSync(path)).digest('hex')});}}walk(backupRoot);writeFileSync(resolve(backupRoot,'manifest.json'),JSON.stringify({createdAt:new Date().toISOString(),sourceDatabase:relative(projectRoot,databasePath).replaceAll('\\','/'),files},null,2));console.log(`Backup created: ${backupRoot}`);
