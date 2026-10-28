import { lookup } from 'node:dns/promises';
import { isIP } from 'node:net';

const URL_PATTERN=/https?:\/\/[^\s<>"']+/gi;
const FRESH_PATTERN=/\b(latest|today|tonight|now|current(?:ly)?|up[ -]?to[ -]?date|recent|this (?:week|month|year)|breaking|news|weather|forecast|stock|share price|exchange rate|price|prices|trending|verify|fact[ -]?check|search (?:the )?web|look up|research|browse|open (?:this|the) (?:page|site|url)|what(?:'s| is) happening)\b/i;
const CHANGEABLE_FACT=/\bwho (?:is|are) (?:the )?(?:president|prime minister|ceo|mayor|governor)\b/i;
const X_PATTERN=/(?:\b(?:twitter|tweets?|x\.com)\b|\bon X\b|\bX posts?\b)/i;

export function livePlan(message) {
  const url=(String(message).match(URL_PATTERN)||[])[0]?.replace(/[.,;!?)]*$/,'')||null;
  const xRequested=X_PATTERN.test(message);
  const needed=Boolean(url||xRequested||FRESH_PATTERN.test(message)||CHANGEABLE_FACT.test(message));
  return {needed,url,xRequested,query:String(message).trim().slice(0,400)};
}

function publicAddress(address) {
  const normalized=address.toLowerCase();
  if(isIP(address)===4) {
    const [a,b]=address.split('.').map(Number);
    return !(a===0||a===10||a===127||a>=224||a===169&&b===254||a===172&&b>=16&&b<=31||a===192&&b===168||a===100&&b>=64&&b<=127||a===198&&b>=18&&b<=19);
  }
  if(isIP(address)===6) return /^[23][0-9a-f]{2,3}:/i.test(normalized)&&!normalized.includes('.');
  return false;
}

export async function validatePublicUrl(value,{lookupImpl=lookup}={}) {
  let url;
  try {url=new URL(value);} catch {throw new Error('Enter a valid public HTTPS page URL.');}
  if(url.protocol!=='https:'||url.username||url.password||url.port&&url.port!=='443') throw new Error('Only public HTTPS pages can be browsed.');
  const host=url.hostname.toLowerCase();
  if(!host.includes('.')||isIP(host)||/(^|\.)(localhost|local|internal|test|example)$/.test(host)) throw new Error('Local or private pages cannot be browsed.');
  const addresses=await lookupImpl(host,{all:true});
  if(!addresses.length||addresses.some(item=>!publicAddress(item.address))) throw new Error('Local or private pages cannot be browsed.');
  return url;
}

function cleanHtml(html) {
  return html.replace(/<\s*(script|style|noscript|svg|nav|footer|header)\b[^>]*>[\s\S]*?<\s*\/\s*\1\s*>/gi,' ')
    .replace(/<[^>]+>/g,' ').replace(/&nbsp;|&#160;/gi,' ').replace(/&amp;/gi,'&')
    .replace(/&lt;/gi,'<').replace(/&gt;/gi,'>').replace(/&quot;/gi,'"')
    .replace(/&#39;|&apos;/gi,"'").replace(/\s+/g,' ').trim().slice(0,3200);
}

async function limitedText(response,maxBytes=140000) {
  if(!response.body) return (await response.text()).slice(0,maxBytes);
  const reader=response.body.getReader();
  const chunks=[];let size=0;
  try {
    while(size<maxBytes) {
      const {done,value}=await reader.read();if(done)break;
      const piece=value.slice(0,maxBytes-size);chunks.push(piece);size+=piece.length;
    }
  } finally {await reader.cancel().catch(()=>{});}
  return new TextDecoder().decode(Buffer.concat(chunks));
}

export async function browsePage(value,{fetchImpl=fetch,lookupImpl=lookup}={}) {
  let current=value;
  for(let redirect=0;redirect<3;redirect++) {
    const url=await validatePublicUrl(current,{lookupImpl});
    const response=await fetchImpl(url.toString(),{redirect:'manual',headers:{Accept:'text/html, text/plain;q=0.9'},signal:AbortSignal.timeout(10000)});
    if(response.status>=300&&response.status<400&&response.headers.get('location')) {
      current=new URL(response.headers.get('location'),url).toString();continue;
    }
    if(!response.ok) throw new Error(`Page browsing failed (${response.status}).`);
    if(!/text\/(html|plain)/i.test(response.headers.get('content-type')||'')) throw new Error('This page is not readable text or HTML.');
    const raw=await limitedText(response);
    return {url:url.toString(),text:cleanHtml(raw)};
  }
  throw new Error('The page redirected too many times.');
}

export async function searchWeb(query,{fetchImpl=fetch,apiKey=process.env.COLLEAGUE_ZERO_BRAVE_SEARCH_API_KEY}={}) {
  if(!apiKey) throw new Error('Live web search is not configured. Add a server-side Brave Search API key to enable fresh answers.');
  const url=new URL('https://api.search.brave.com/res/v1/web/search');
  url.searchParams.set('q',query.slice(0,400));url.searchParams.set('count','4');
  const response=await fetchImpl(url.toString(),{headers:{Accept:'application/json','X-Subscription-Token':apiKey},signal:AbortSignal.timeout(10000)});
  if(!response.ok) throw new Error(`Live web search failed (${response.status}).`);
  const result=await response.json();
  return (result.web?.results||[]).slice(0,4).filter(item=>item.title&&String(item.url||'').startsWith('https://')).map(item=>({title:String(item.title).slice(0,180),url:String(item.url),snippet:String(item.description||'').slice(0,700)}));
}

export function searchX() {
  return {available:false,note:'Native X search is not connected. Web search can look for indexed public X pages, but cannot verify a complete or real-time X feed.'};
}

export async function gatherLiveContext(message,{fetchImpl=fetch,lookupImpl=lookup,apiKey=process.env.COLLEAGUE_ZERO_BRAVE_SEARCH_API_KEY}={}) {
  const plan=livePlan(message);
  if(!plan.needed) return {sources:[],note:null};
  const sources=[];
  if(plan.url) {
    const page=await browsePage(plan.url,{fetchImpl,lookupImpl});
    sources.push({title:new URL(page.url).hostname,url:page.url,text:page.text});
  } else {
    const query=plan.xRequested?`${plan.query} site:x.com`:plan.query;
    const results=await searchWeb(query,{fetchImpl,apiKey});
    if(!results.length) throw new Error('Live search returned no sources. Try a more specific question.');
    for(const result of results.slice(0,3)) {
      let text=result.snippet;
      try {const page=await browsePage(result.url,{fetchImpl,lookupImpl});text=page.text||text;}
      catch { /* A search snippet is still useful, but is labeled as such below. */ }
      sources.push({title:result.title,url:result.url,text:text.slice(0,3200),excerptOnly:text===result.snippet});
    }
  }
  return {sources,note:plan.xRequested?searchX().note:null};
}
