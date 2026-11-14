import { createHash, randomUUID } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, extname, join, resolve, sep } from 'node:path';
import { inflateRawSync } from 'node:zlib';
import { now } from './store.mjs';

const MAX_INDEXED_TEXT_CHARACTERS=500_000;
const imageExtensions=new Set(['.png','.jpg','.jpeg','.webp','.gif']);
const allowedExtensions=new Set(['.txt','.md','.csv','.json','.pdf','.docx','.pptx','.xlsx','.zip',...imageExtensions]);
const mimeByExtension={'.txt':'text/plain','.md':'text/markdown','.csv':'text/csv','.json':'application/json','.pdf':'application/pdf','.docx':'application/vnd.openxmlformats-officedocument.wordprocessingml.document','.pptx':'application/vnd.openxmlformats-officedocument.presentationml.presentation','.xlsx':'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet','.zip':'application/zip','.png':'image/png','.jpg':'image/jpeg','.jpeg':'image/jpeg','.webp':'image/webp','.gif':'image/gif'};
const cleanName=value=>String(value||'').replace(/[^a-zA-Z0-9._ -]/g,'_').replace(/\s+/g,' ').trim().slice(0,120);
export const sha256=value=>createHash('sha256').update(value).digest('hex');

function validateMagic(extension,buffer) {
  if(extension==='.pdf'&&!buffer.subarray(0,5).equals(Buffer.from('%PDF-'))) throw new Error('The PDF signature is invalid.');
  if(['.docx','.pptx','.xlsx'].includes(extension)&&!buffer.subarray(0,2).equals(Buffer.from('PK'))) throw new Error('The Office document signature is invalid.');
  if(extension==='.zip'&&!buffer.subarray(0,2).equals(Buffer.from('PK'))) throw new Error('The ZIP signature is invalid.');
  if(['.txt','.md','.csv','.json'].includes(extension)&&buffer.includes(0)) throw new Error('Text uploads may not contain binary null bytes.');
  if(extension==='.png'&&!buffer.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10]))) throw new Error('The PNG signature is invalid.');
  if(['.jpg','.jpeg'].includes(extension)&&!(buffer[0]===0xff&&buffer[1]===0xd8&&buffer.at(-2)===0xff&&buffer.at(-1)===0xd9)) throw new Error('The JPEG signature is invalid.');
  if(extension==='.webp'&&!(buffer.subarray(0,4).toString()==='RIFF'&&buffer.subarray(8,12).toString()==='WEBP')) throw new Error('The WebP signature is invalid.');
  if(extension==='.gif'&&!['GIF87a','GIF89a'].includes(buffer.subarray(0,6).toString())) throw new Error('The GIF signature is invalid.');
}

function decodeXml(value) {
  return value.replace(/<w:tab\/?\s*>/g,'\t').replace(/<w:br\/?\s*>/g,'\n').replace(/<\/w:p>/g,'\n').replace(/<[^>]+>/g,'')
    .replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&amp;/g,'&').replace(/&quot;/g,'"').replace(/&#39;/g,"'").replace(/\r/g,'').trim();
}

function docxEntry(buffer,target) {
  for(let offset=0;offset+46<=buffer.length;) {
    if(buffer.readUInt32LE(offset)!==0x02014b50){offset++;continue;}
    const method=buffer.readUInt16LE(offset+10),compressed=buffer.readUInt32LE(offset+20),nameLength=buffer.readUInt16LE(offset+28),extraLength=buffer.readUInt16LE(offset+30),commentLength=buffer.readUInt16LE(offset+32),localOffset=buffer.readUInt32LE(offset+42);
    const name=buffer.subarray(offset+46,offset+46+nameLength).toString('utf8');
    if(name===target&&buffer.readUInt32LE(localOffset)===0x04034b50) {
      const localNameLength=buffer.readUInt16LE(localOffset+26),localExtraLength=buffer.readUInt16LE(localOffset+28),start=localOffset+30+localNameLength+localExtraLength,payload=buffer.subarray(start,start+compressed);
      if(method===0)return payload;if(method===8)return inflateRawSync(payload);throw new Error('The DOCX uses an unsupported compression method.');
    }
    offset+=46+nameLength+extraLength+commentLength;
  }
  let offset=0;
  while(offset+30<=buffer.length) {
    if(buffer.readUInt32LE(offset)!==0x04034b50) {offset++;continue;}
    const method=buffer.readUInt16LE(offset+8),compressed=buffer.readUInt32LE(offset+18),nameLength=buffer.readUInt16LE(offset+26),extraLength=buffer.readUInt16LE(offset+28);
    const name=buffer.subarray(offset+30,offset+30+nameLength).toString('utf8'),start=offset+30+nameLength+extraLength,end=start+compressed;
    if(end>buffer.length) break;
    if(name===target) {
      const payload=buffer.subarray(start,end);
      if(method===0)return payload;
      if(method===8)return inflateRawSync(payload);
      throw new Error('The DOCX uses an unsupported compression method.');
    }
    offset=end;
  }
  throw new Error('The DOCX document body is missing or unsupported.');
}

function zipEntryNames(buffer){const names=[];for(let offset=0;offset+46<=buffer.length;){if(buffer.readUInt32LE(offset)!==0x02014b50){offset++;continue;}const nameLength=buffer.readUInt16LE(offset+28),extraLength=buffer.readUInt16LE(offset+30),commentLength=buffer.readUInt16LE(offset+32),name=buffer.subarray(offset+46,offset+46+nameLength).toString('utf8');names.push(name);offset+=46+nameLength+extraLength+commentLength;}if(names.length)return names;for(let offset=0;offset+30<=buffer.length;){if(buffer.readUInt32LE(offset)!==0x04034b50){offset++;continue;}const compressed=buffer.readUInt32LE(offset+18),nameLength=buffer.readUInt16LE(offset+26),extraLength=buffer.readUInt16LE(offset+28),name=buffer.subarray(offset+30,offset+30+nameLength).toString('utf8');names.push(name);offset+=30+nameLength+extraLength+compressed;}return names;}
const decodeGenericXml=value=>value.replace(/<a:br\s*\/>/g,'\n').replace(/<[^>]*\b(?:t|v)[^>]*>([\s\S]*?)<\/[^>]+>/g,'$1 ').replace(/<\/(?:a:p|p|row|si)>/g,'\n').replace(/<[^>]+>/g,'').replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&amp;/g,'&').replace(/&quot;/g,'"').replace(/&#39;/g,"'").replace(/[ \t]+\n/g,'\n').replace(/\n{3,}/g,'\n\n').trim();
function extractPptx(buffer){const names=zipEntryNames(buffer).filter(name=>/^ppt\/slides\/slide\d+\.xml$/.test(name)).sort((a,b)=>Number(a.match(/\d+/)[0])-Number(b.match(/\d+/)[0]));if(!names.length)throw new Error('The PPTX contains no readable slides.');return names.map((name,index)=>`Slide ${index+1}\n${decodeGenericXml(docxEntry(buffer,name).toString('utf8'))}`).join('\n\n');}
function extractXlsx(buffer){const names=zipEntryNames(buffer),sharedName=names.find(name=>name==='xl/sharedStrings.xml'),shared=sharedName?[...docxEntry(buffer,sharedName).toString('utf8').matchAll(/<si[\s\S]*?<\/si>/g)].map(match=>decodeGenericXml(match[0])):[],sheets=names.filter(name=>/^xl\/worksheets\/sheet\d+\.xml$/.test(name)).sort((a,b)=>Number(a.match(/\d+/)[0])-Number(b.match(/\d+/)[0]));if(!sheets.length)throw new Error('The XLSX contains no readable worksheets.');return sheets.map((name,index)=>{const xml=docxEntry(buffer,name).toString('utf8'),rows=[...xml.matchAll(/<row[\s\S]*?<\/row>/g)].map(row=>[...row[0].matchAll(/<c([^>]*)>([\s\S]*?)<\/c>/g)].map(cell=>{const value=cell[2].match(/<v>([\s\S]*?)<\/v>/)?.[1]??decodeGenericXml(cell[2]);return /\bt="s"/.test(cell[1])?shared[Number(value)]??value:value;}).join(',')).join('\n');return `Sheet ${index+1}\n${rows}`;}).join('\n\n');}

function extractPdf(buffer) {
  const raw=buffer.toString('latin1');
  const chunks=[];
  for(const match of raw.matchAll(/stream\r?\n([\s\S]*?)\r?\nendstream/g)) {
    let text=match[1];
    try {text=inflateRawSync(Buffer.from(text,'latin1')).toString('latin1');} catch {}
    for(const string of text.matchAll(/\(([^()]*(?:\\.[^()]*)*)\)\s*Tj/g)) chunks.push(string[1]);
    for(const array of text.matchAll(/\[([\s\S]*?)\]\s*TJ/g)) for(const string of array[1].matchAll(/\(([^()]*)\)/g))chunks.push(string[1]);
  }
  const extracted=chunks.join(' ').replace(/\\([()\\])/g,'$1').replace(/\\n/g,'\n').replace(/\s+/g,' ').trim();
  if(!extracted) throw new Error('No extractable text was found in this PDF. Scanned or encrypted PDFs require OCR and are not supported in this local build.');
  return extracted;
}

export function extractAcademicText(name,buffer) {
  const extension=extname(name).toLowerCase();
  if(!allowedExtensions.has(extension)) throw new Error('Supported uploads are PDF, DOCX, PPTX, XLSX, ZIP, TXT, Markdown, CSV, JSON, PNG, JPEG, WebP, and GIF.');
  validateMagic(extension,buffer);
  if(imageExtensions.has(extension)||extension==='.zip')return '';
  if(extension==='.docx')return decodeXml(docxEntry(buffer,'word/document.xml').toString('utf8'));
  if(extension==='.pptx')return extractPptx(buffer);
  if(extension==='.xlsx')return extractXlsx(buffer);
  if(extension==='.pdf')return extractPdf(buffer);
  const text=buffer.toString('utf8').replace(/^\uFEFF/,'');
  if(extension==='.json')JSON.parse(text);
  return text.trim();
}

export async function saveAcademicFile(db,{uploadRoot,organizationId,uploaderId,name,mimeType,base64,category='reference'}) {
  const originalName=cleanName(name);
  if(!originalName||originalName==='.'||originalName==='..') throw new Error('Choose a valid file name.');
  let buffer;
  try {buffer=Buffer.from(String(base64||''),'base64');} catch {throw new Error('The upload payload is invalid.');}
  if(!buffer.length) throw new Error('Academic files cannot be empty.');
  const extension=extname(originalName).toLowerCase();
  const extractedText=extractAcademicText(originalName,buffer);
  const indexedText=extractedText.slice(0,MAX_INDEXED_TEXT_CHARACTERS),extractionTruncated=indexedText.length<extractedText.length;
  const digest=sha256(buffer),existing=db.prepare('SELECT id FROM academic_files WHERE organization_id=? AND sha256=? AND category=?').get(organizationId,digest,category);
  if(existing)return {fileId:existing.id,deduplicated:true};
  const fileId=randomUUID(),opaque=`${fileId}${extension}`,orgRoot=resolve(uploadRoot,organizationId),storagePath=resolve(orgRoot,opaque);
  if(!storagePath.startsWith(orgRoot+sep)) throw new Error('Upload path validation failed.');
  await mkdir(orgRoot,{recursive:true});await writeFile(storagePath,buffer,{flag:'wx'});
  const metadata={extension,extractedCharacters:extractedText.length,indexedCharacters:indexedText.length,extractionTruncated,untrustedContent:true,image:imageExtensions.has(extension)};
  db.prepare('INSERT INTO academic_files(id,organization_id,uploader_id,original_name,storage_key,mime_type,size,sha256,category,extracted_text,metadata,created_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?)')
    .run(fileId,organizationId,uploaderId,originalName,opaque,mimeByExtension[extension]||mimeType||'application/octet-stream',buffer.length,digest,category,indexedText,JSON.stringify(metadata),now());
  return {fileId,deduplicated:false,sha256:digest,extractedCharacters:extractedText.length,indexedCharacters:indexedText.length,extractionTruncated};
}

export function parseCsv(text) {
  const rows=[];let row=[],cell='',quoted=false;
  for(let index=0;index<=text.length;index++) {
    const char=text[index]??'\n';
    if(char==='"') {if(quoted&&text[index+1]==='"'){cell+='"';index++;}else quoted=!quoted;}
    else if(char===','&&!quoted){row.push(cell);cell='';}
    else if((char==='\n'||char==='\r')&&!quoted){if(char==='\r'&&text[index+1]==='\n')index++;row.push(cell);if(row.some(value=>value!==''))rows.push(row);row=[];cell='';}
    else cell+=char;
  }
  if(rows.length<1)return [];
  const headers=rows.shift().map(value=>value.trim());
  return rows.map(values=>Object.fromEntries(headers.map((header,index)=>[header,String(values[index]??'').trim()])));
}

export async function saveArtifact(db,{artifactRoot,organizationId,missionId=null,taskId=null,type,title,mimeType='application/json',content,revision=1,sensitive=false}) {
  const buffer=Buffer.isBuffer(content)?content:Buffer.from(String(content));
  const artifactId=randomUUID(),extension=mimeType.includes('pdf')?'.pdf':mimeType.includes('html')?'.html':mimeType.includes('csv')?'.csv':mimeType.includes('text')?'.txt':'.json';
  const orgRoot=resolve(artifactRoot,organizationId),storageKey=`${artifactId}${extension}`,storagePath=resolve(orgRoot,storageKey);
  if(!storagePath.startsWith(orgRoot+sep)) throw new Error('Artifact path validation failed.');
  await mkdir(orgRoot,{recursive:true});await writeFile(storagePath,buffer,{flag:'wx'});
  db.prepare('INSERT INTO artifacts(id,organization_id,mission_id,task_id,artifact_type,title,storage_key,mime_type,checksum,revision,sensitive,created_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?)')
    .run(artifactId,organizationId,missionId,taskId,type,title,storageKey,mimeType,sha256(buffer),revision,sensitive?1:0,now());
  return {artifactId,checksum:sha256(buffer),revision};
}

export async function readScopedStorage(root,organizationId,storageKey) {
  const orgRoot=resolve(root,organizationId),file=resolve(orgRoot,storageKey);
  if(!file.startsWith(orgRoot+sep)) throw new Error('Storage path validation failed.');
  return readFile(file);
}
