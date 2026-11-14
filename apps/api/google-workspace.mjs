const objectSchema=(properties,required=[])=>({type:'object',properties,required,additionalProperties:false});
const s={type:'string'},id={type:'string',minLength:1},obj={type:'object'},arr={type:'array'};
const tool=(name,description,risk,inputSchema)=>({name:`google.${name}`,description,inputSchema,annotations:{readOnlyHint:risk==='read',destructiveHint:risk==='consequential_write'},risk});

export const GOOGLE_WORKSPACE_TOOLS=Object.freeze([
  tool('drive.createFolder','Create a folder in the connected Google Drive.','reversible_write',objectSchema({name:id,parentId:s},['name'])),
  tool('drive.uploadFile','Upload a base64 file to Google Drive.','reversible_write',objectSchema({name:id,mimeType:id,base64:id,parentId:s},['name','mimeType','base64'])),
  tool('drive.listFiles','List files visible to this app connection.','read',objectSchema({query:s,pageSize:{type:'integer',minimum:1,maximum:100}})),
  tool('drive.getFileMetadata','Read Google Drive file metadata.','read',objectSchema({fileId:id},['fileId'])),
  tool('drive.exportFile','Export a Google Workspace file.','read',objectSchema({fileId:id,mimeType:id},['fileId','mimeType'])),
  tool('drive.moveFile','Move a Drive file between folders.','reversible_write',objectSchema({fileId:id,addParentId:id,removeParentId:s},['fileId','addParentId'])),
  tool('docs.createDocument','Create a Google Doc.','reversible_write',objectSchema({title:id,parentId:s},['title'])),
  tool('docs.getDocument','Read a Google Doc.','read',objectSchema({documentId:id},['documentId'])),
  tool('docs.updateDocument','Apply reviewed Google Docs batch updates.','reversible_write',objectSchema({documentId:id,requests:arr},['documentId','requests'])),
  tool('docs.exportPdf','Export a Google Doc as PDF.','read',objectSchema({documentId:id},['documentId'])),
  tool('slides.createPresentation','Create a Google Slides presentation.','reversible_write',objectSchema({title:id},['title'])),
  tool('slides.getPresentation','Read presentation structure and metadata.','read',objectSchema({presentationId:id},['presentationId'])),
  tool('slides.batchUpdate','Apply reviewed Google Slides batch updates.','reversible_write',objectSchema({presentationId:id,requests:arr},['presentationId','requests'])),
  tool('slides.exportPresentation','Export a presentation.','read',objectSchema({presentationId:id,mimeType:id},['presentationId','mimeType'])),
  tool('sheets.createSpreadsheet','Create a Google Sheet.','reversible_write',objectSchema({title:id},['title'])),
  tool('sheets.getValues','Read values from a sheet range.','read',objectSchema({spreadsheetId:id,range:id},['spreadsheetId','range'])),
  tool('sheets.updateValues','Write approved values to a sheet range.','consequential_write',objectSchema({spreadsheetId:id,range:id,values:arr,valueInputOption:{type:'string',enum:['RAW','USER_ENTERED']}},['spreadsheetId','range','values'])),
  tool('sheets.formatRubric','Apply formatting requests to a rubric sheet.','reversible_write',objectSchema({spreadsheetId:id,requests:arr},['spreadsheetId','requests'])),
  tool('sheets.validateRubricTotal','Validate that numeric rubric points total exactly 100.','read',objectSchema({spreadsheetId:id,range:id},['spreadsheetId','range'])),
  tool('gmail.createDraft','Create a Gmail draft without sending it.','draft',objectSchema({to:id,subject:id,bodyText:id,cc:s,bcc:s},['to','subject','bodyText'])),
  tool('gmail.getDraftMetadata','Read safe Gmail draft metadata.','read',objectSchema({draftId:id},['draftId'])),
  tool('gmail.sendDraft','Send one exact, previously reviewed Gmail draft.','consequential_write',objectSchema({draftId:id},['draftId'])),
  tool('calendar.listCalendars','List calendars available to the connected account.','read',objectSchema({})),
  tool('calendar.findAvailability','Read busy intervals for a time window.','read',objectSchema({timeMin:id,timeMax:id,calendarIds:arr},['timeMin','timeMax'])),
  tool('calendar.proposeEvent','Prepare an event proposal without creating it.','draft',objectSchema({summary:id,start:obj,end:obj,attendees:arr,description:s},['summary','start','end'])),
  tool('calendar.createEvent','Create one exact approved calendar event.','consequential_write',objectSchema({calendarId:id,summary:id,start:obj,end:obj,attendees:arr,description:s},['calendarId','summary','start','end'])),
  tool('calendar.updateEvent','Update one exact approved calendar event.','consequential_write',objectSchema({calendarId:id,eventId:id,patch:obj},['calendarId','eventId','patch'])),
  tool('calendar.cancelEvent','Cancel one exact approved calendar event.','consequential_write',objectSchema({calendarId:id,eventId:id,sendUpdates:{type:'string',enum:['all','externalOnly','none']}},['calendarId','eventId']))
]);

const jsonOrText=async response=>{const buffer=Buffer.from(await response.arrayBuffer());const type=response.headers.get('content-type')||'';if(type.includes('json'))try{return JSON.parse(buffer.toString('utf8'));}catch{}return {mimeType:type,dataBase64:buffer.toString('base64')};};
const escapeHeader=value=>String(value||'').replace(/[\r\n]+/g,' ').trim();
const message=args=>{const headers=[`To: ${escapeHeader(args.to)}`,args.cc?`Cc: ${escapeHeader(args.cc)}`:null,args.bcc?`Bcc: ${escapeHeader(args.bcc)}`:null,`Subject: ${escapeHeader(args.subject)}`,'Content-Type: text/plain; charset="UTF-8"','',String(args.bodyText||'')].filter(value=>value!==null).join('\r\n');return Buffer.from(headers).toString('base64url');};
const ids=value=>{const found=[];for(const key of ['id','fileId','documentId','presentationId','spreadsheetId','draftId','eventId'])if(value?.[key])found.push(String(value[key]));return [...new Set(found)];};

export function createGoogleWorkspace({oauthRuntime,fetchImpl=fetch}={}){
  async function call({organizationId,connectionId,name,args}){
    if(name==='google.calendar.proposeEvent')return {result:{proposal:{...args,status:'not_created'}},beforeEvidence:[],afterEvidence:[],rollback:null,providerRequestId:null,externalResourceIds:[]};
    const token=await oauthRuntime.accessToken({organizationId,connectionId});
    const request=route(name,args),headers={authorization:`Bearer ${token}`,...request.headers};
    const response=await fetchImpl(request.url,{method:request.method||'GET',headers,body:request.body}),payload=await jsonOrText(response);
    if(!response.ok){const error=new Error(payload?.error?.message||payload?.error||`Google API request failed (${response.status}).`);error.status=response.status;throw error;}
    let result=payload;
    if(name==='google.sheets.validateRubricTotal'){
      const values=payload.values||[],numbers=values.flat(Infinity).map(Number).filter(Number.isFinite),total=numbers.reduce((sum,value)=>sum+value,0);
      result={total,valid:Math.abs(total-100)<0.00001,checkedValues:numbers.length};
    }
    const resourceIds=ids(result),write=!GOOGLE_WORKSPACE_TOOLS.find(item=>item.name===name)?.annotations.readOnlyHint;
    return {result,beforeEvidence:write?[{kind:'approved_arguments',value:args}]:[],afterEvidence:write?[{kind:'provider_result',resourceIds}]:[],rollback:rollbackFor(name,args,result),providerRequestId:response.headers.get('x-guploader-uploadid')||response.headers.get('x-request-id')||null,externalResourceIds:resourceIds};
  }
  return {tools:GOOGLE_WORKSPACE_TOOLS,call};
}

function route(name,args){
  const q=value=>encodeURIComponent(value),json=value=>({headers:{'content-type':'application/json'},body:JSON.stringify(value)});
  const routes={
    'google.drive.createFolder':()=>({url:'https://www.googleapis.com/drive/v3/files',method:'POST',...json({name:args.name,mimeType:'application/vnd.google-apps.folder',parents:args.parentId?[args.parentId]:undefined})}),
    'google.drive.listFiles':()=>({url:`https://www.googleapis.com/drive/v3/files?pageSize=${Math.min(100,args.pageSize||50)}&fields=files(id,name,mimeType,parents,modifiedTime,webViewLink)${args.query?`&q=${q(args.query)}`:''}`}),
    'google.drive.getFileMetadata':()=>({url:`https://www.googleapis.com/drive/v3/files/${q(args.fileId)}?fields=id,name,mimeType,parents,modifiedTime,size,webViewLink`}),
    'google.drive.exportFile':()=>({url:`https://www.googleapis.com/drive/v3/files/${q(args.fileId)}/export?mimeType=${q(args.mimeType)}`}),
    'google.drive.moveFile':()=>({url:`https://www.googleapis.com/drive/v3/files/${q(args.fileId)}?addParents=${q(args.addParentId)}${args.removeParentId?`&removeParents=${q(args.removeParentId)}`:''}&fields=id,parents`,method:'PATCH'}),
    'google.docs.createDocument':()=>({url:'https://docs.googleapis.com/v1/documents',method:'POST',...json({title:args.title})}),
    'google.docs.getDocument':()=>({url:`https://docs.googleapis.com/v1/documents/${q(args.documentId)}`}),
    'google.docs.updateDocument':()=>({url:`https://docs.googleapis.com/v1/documents/${q(args.documentId)}:batchUpdate`,method:'POST',...json({requests:args.requests})}),
    'google.docs.exportPdf':()=>({url:`https://www.googleapis.com/drive/v3/files/${q(args.documentId)}/export?mimeType=${q('application/pdf')}`}),
    'google.slides.createPresentation':()=>({url:'https://slides.googleapis.com/v1/presentations',method:'POST',...json({title:args.title})}),
    'google.slides.getPresentation':()=>({url:`https://slides.googleapis.com/v1/presentations/${q(args.presentationId)}`}),
    'google.slides.batchUpdate':()=>({url:`https://slides.googleapis.com/v1/presentations/${q(args.presentationId)}:batchUpdate`,method:'POST',...json({requests:args.requests})}),
    'google.slides.exportPresentation':()=>({url:`https://www.googleapis.com/drive/v3/files/${q(args.presentationId)}/export?mimeType=${q(args.mimeType)}`}),
    'google.sheets.createSpreadsheet':()=>({url:'https://sheets.googleapis.com/v4/spreadsheets',method:'POST',...json({properties:{title:args.title}})}),
    'google.sheets.getValues':()=>({url:`https://sheets.googleapis.com/v4/spreadsheets/${q(args.spreadsheetId)}/values/${q(args.range)}`}),
    'google.sheets.updateValues':()=>({url:`https://sheets.googleapis.com/v4/spreadsheets/${q(args.spreadsheetId)}/values/${q(args.range)}?valueInputOption=${q(args.valueInputOption||'USER_ENTERED')}`,method:'PUT',...json({values:args.values})}),
    'google.sheets.formatRubric':()=>({url:`https://sheets.googleapis.com/v4/spreadsheets/${q(args.spreadsheetId)}:batchUpdate`,method:'POST',...json({requests:args.requests})}),
    'google.sheets.validateRubricTotal':()=>({url:`https://sheets.googleapis.com/v4/spreadsheets/${q(args.spreadsheetId)}/values/${q(args.range)}`}),
    'google.gmail.createDraft':()=>({url:'https://gmail.googleapis.com/gmail/v1/users/me/drafts',method:'POST',...json({message:{raw:message(args)}})}),
    'google.gmail.getDraftMetadata':()=>({url:`https://gmail.googleapis.com/gmail/v1/users/me/drafts/${q(args.draftId)}?format=metadata`}),
    'google.gmail.sendDraft':()=>({url:'https://gmail.googleapis.com/gmail/v1/users/me/drafts/send',method:'POST',...json({id:args.draftId})}),
    'google.calendar.listCalendars':()=>({url:'https://www.googleapis.com/calendar/v3/users/me/calendarList'}),
    'google.calendar.findAvailability':()=>({url:'https://www.googleapis.com/calendar/v3/freeBusy',method:'POST',...json({timeMin:args.timeMin,timeMax:args.timeMax,items:(args.calendarIds||['primary']).map(id=>({id}))})}),
    'google.calendar.createEvent':()=>({url:`https://www.googleapis.com/calendar/v3/calendars/${q(args.calendarId)}/events`,method:'POST',...json({summary:args.summary,start:args.start,end:args.end,attendees:args.attendees,description:args.description})}),
    'google.calendar.updateEvent':()=>({url:`https://www.googleapis.com/calendar/v3/calendars/${q(args.calendarId)}/events/${q(args.eventId)}`,method:'PATCH',...json(args.patch)}),
    'google.calendar.cancelEvent':()=>({url:`https://www.googleapis.com/calendar/v3/calendars/${q(args.calendarId)}/events/${q(args.eventId)}?sendUpdates=${q(args.sendUpdates||'all')}`,method:'DELETE'})
  };
  if(name==='google.drive.uploadFile'){
    const boundary=`bb_${Date.now()}`,metadata=JSON.stringify({name:args.name,parents:args.parentId?[args.parentId]:undefined}),body=Buffer.concat([Buffer.from(`--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${metadata}\r\n--${boundary}\r\nContent-Type: ${args.mimeType}\r\nContent-Transfer-Encoding: base64\r\n\r\n${args.base64}\r\n--${boundary}--`)]);
    return {url:'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart',method:'POST',headers:{'content-type':`multipart/related; boundary=${boundary}`},body};
  }
  const builder=routes[name];if(!builder)throw new Error(`Unsupported Google Workspace tool: ${name}`);return builder();
}

function rollbackFor(name,args,result){
  if(name==='google.drive.moveFile')return {supported:true,toolName:name,arguments:{fileId:args.fileId,addParentId:args.removeParentId,removeParentId:args.addParentId},requiresApproval:true};
  if(['google.docs.updateDocument','google.slides.batchUpdate','google.sheets.updateValues','google.sheets.formatRubric','google.calendar.updateEvent'].includes(name))return {supported:false,reason:'Provider history may restore this change; automatic rollback is not safe.'};
  if(name==='google.calendar.createEvent')return {supported:true,toolName:'google.calendar.cancelEvent',arguments:{calendarId:args.calendarId,eventId:result.id,sendUpdates:'all'},requiresApproval:true};
  return {supported:false,reason:'No safe automatic rollback is available.'};
}
