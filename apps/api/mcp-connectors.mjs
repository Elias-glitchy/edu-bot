import { validatePublicUrl } from './live-tools.mjs';

export const MCP_CONNECTOR_TYPES=Object.freeze({
  mcp:{label:'Remote MCP',defaultEndpoint:''},
  composio:{label:'Composio',defaultEndpoint:'https://connect.composio.dev/mcp'},
  zapier:{label:'Zapier MCP',defaultEndpoint:''}
});

const cleanName=value=>{
  const name=String(value||'').trim();
  if(name.length<2||name.length>80)throw new Error('Connector name must be between 2 and 80 characters.');
  return name;
};

export function normalizeMcpConnector(input={}){
  const connectorType=String(input.connectorType||'').trim().toLowerCase(),definition=MCP_CONNECTOR_TYPES[connectorType];
  if(!definition)throw new Error('Choose Remote MCP, Composio, or Zapier MCP.');
  const displayName=cleanName(input.displayName||definition.label),rawEndpoint=String(input.endpoint||definition.defaultEndpoint).trim();
  let endpoint;
  try{endpoint=new URL(rawEndpoint);}catch{throw new Error('Enter a valid HTTPS MCP endpoint.');}
  if(endpoint.protocol!=='https:'||endpoint.username||endpoint.password||endpoint.port&&endpoint.port!=='443'||endpoint.search||endpoint.hash)throw new Error('MCP endpoints must use public HTTPS without embedded credentials, query parameters, or fragments.');
  const authMode=String(input.authMode||'none').trim().toLowerCase();
  if(!['none','bearer','x-api-key','x-consumer-api-key'].includes(authMode))throw new Error('Unsupported MCP authentication mode.');
  const secretRef=String(input.secretRef||'').trim();
  if(authMode!=='none'&&!/^env:[A-Z][A-Z0-9_]{1,63}$/.test(secretRef))throw new Error('Authenticated connectors require an environment secret reference such as env:COMPOSIO_API_KEY.');
  return {connectorType,displayName,config:{endpoint:endpoint.toString(),authMode},secretRef:authMode==='none'?null:secretRef};
}

function responseMessage(text,contentType){
  const trimmed=String(text||'').trim();
  if(!trimmed)return null;
  if(String(contentType||'').includes('text/event-stream')){
    const data=trimmed.split(/\r?\n/).filter(line=>line.startsWith('data:')).map(line=>line.slice(5).trim()).find(line=>line&&line!=='[DONE]');
    return data?JSON.parse(data):null;
  }
  return JSON.parse(trimmed);
}

function secretHeaders(connection,environment){
  const config=typeof connection.config==='string'?JSON.parse(connection.config):connection.config;
  if(config.authMode==='none')return {};
  const name=String(connection.secret_ref||'').replace(/^env:/,''),secret=environment[name];
  if(!secret)throw new Error(`Connector credential ${connection.secret_ref} is not configured on the BUILD BOT server.`);
  if(config.authMode==='bearer')return {Authorization:`Bearer ${secret}`};
  return {[config.authMode]:secret};
}

async function send(endpoint,payload,{fetchImpl,headers,sessionId}){
  const response=await fetchImpl(endpoint,{
    method:'POST',redirect:'error',signal:AbortSignal.timeout(15000),
    headers:{Accept:'application/json, text/event-stream','Content-Type':'application/json','MCP-Protocol-Version':'2025-11-25',...(sessionId?{'Mcp-Session-Id':sessionId}:{}),...headers},
    body:JSON.stringify(payload)
  });
  if(response.status===401||response.status===403)throw new Error('The MCP server rejected its configured credential.');
  if(!response.ok)throw new Error(`The MCP server returned HTTP ${response.status}.`);
  return {message:responseMessage(await response.text(),response.headers.get('content-type')),sessionId:response.headers.get('mcp-session-id')||sessionId};
}

export async function verifyMcpConnector(connection,{fetchImpl=fetch,lookupImpl,environment=process.env}={}){
  const config=typeof connection.config==='string'?JSON.parse(connection.config):connection.config;
  const endpoint=(await validatePublicUrl(config.endpoint,{lookupImpl})).toString(),headers=secretHeaders(connection,environment);
  const initialized=await send(endpoint,{jsonrpc:'2.0',id:'initialize',method:'initialize',params:{protocolVersion:'2025-11-25',capabilities:{},clientInfo:{name:'BUILD BOT 2.0',version:'2.0'}}},{fetchImpl,headers});
  if(initialized.message?.error)throw new Error(`MCP initialization failed: ${initialized.message.error.message||'Unknown error'}`);
  await send(endpoint,{jsonrpc:'2.0',method:'notifications/initialized',params:{}},{fetchImpl,headers,sessionId:initialized.sessionId});
  const listed=await send(endpoint,{jsonrpc:'2.0',id:'tools',method:'tools/list',params:{}},{fetchImpl,headers,sessionId:initialized.sessionId});
  if(listed.message?.error)throw new Error(`MCP tool discovery failed: ${listed.message.error.message||'Unknown error'}`);
  const tools=(Array.isArray(listed.message?.result?.tools)?listed.message.result.tools:[]).slice(0,200).map(tool=>({name:String(tool.name||''),description:String(tool.description||'').slice(0,500),inputSchema:tool.inputSchema&&typeof tool.inputSchema==='object'?tool.inputSchema:{type:'object',properties:{}},annotations:tool.annotations&&typeof tool.annotations==='object'?tool.annotations:{}})).filter(tool=>tool.name);
  return {verified:true,serverInfo:initialized.message?.result?.serverInfo||null,protocolVersion:initialized.message?.result?.protocolVersion||'2025-11-25',tools};
}

export async function callMcpTool(connection,{name,arguments:toolArguments},{fetchImpl=fetch,lookupImpl,environment=process.env}={}){
  const config=typeof connection.config==='string'?JSON.parse(connection.config):connection.config;
  const endpoint=(await validatePublicUrl(config.endpoint,{lookupImpl})).toString(),headers=secretHeaders(connection,environment);
  const initialized=await send(endpoint,{jsonrpc:'2.0',id:'initialize',method:'initialize',params:{protocolVersion:'2025-11-25',capabilities:{},clientInfo:{name:'BUILD BOT 2.0',version:'2.0'}}},{fetchImpl,headers});
  if(initialized.message?.error)throw new Error(`MCP initialization failed: ${initialized.message.error.message||'Unknown error'}`);
  await send(endpoint,{jsonrpc:'2.0',method:'notifications/initialized',params:{}},{fetchImpl,headers,sessionId:initialized.sessionId});
  const called=await send(endpoint,{jsonrpc:'2.0',id:'tool-call',method:'tools/call',params:{name,arguments:toolArguments||{}}},{fetchImpl,headers,sessionId:initialized.sessionId});
  if(called.message?.error)throw new Error(`MCP tool execution failed: ${called.message.error.message||'Unknown error'}`);
  return {result:called.message?.result??null,sessionId:called.sessionId||null};
}
