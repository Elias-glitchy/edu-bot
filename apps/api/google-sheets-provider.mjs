import { createSign } from 'node:crypto';

const base64url=value=>Buffer.from(JSON.stringify(value)).toString('base64url');
const spreadsheetId=value=>{const id=String(value||'').trim();if(!/^[A-Za-z0-9_-]{20,200}$/.test(id))throw new Error('A valid dedicated Google spreadsheet ID is required.');return id;};
const rangeValue=value=>{const range=String(value||'').trim();if(!range||range.length>250||/[\r\n]/.test(range))throw new Error('A valid sheet range is required.');return range;};

export class GoogleSheetsProvider {
  constructor({credentials,fetchImpl=fetch,clock=()=>Date.now()}={}){
    const parsed=typeof credentials==='string'?JSON.parse(credentials):credentials;
    if(!parsed?.client_email||!parsed?.private_key)throw new Error('Google service-account credentials are incomplete.');
    this.clientEmail=parsed.client_email;this.privateKey=parsed.private_key;this.fetchImpl=fetchImpl;this.clock=clock;this.cachedToken=null;
  }
  async accessToken(){
    if(this.cachedToken&&this.cachedToken.expiresAt>this.clock()+60_000)return this.cachedToken.value;
    const issued=Math.floor(this.clock()/1000),header=base64url({alg:'RS256',typ:'JWT'}),claims=base64url({iss:this.clientEmail,scope:'https://www.googleapis.com/auth/spreadsheets',aud:'https://oauth2.googleapis.com/token',iat:issued,exp:issued+3600}),unsigned=`${header}.${claims}`,signer=createSign('RSA-SHA256');signer.update(unsigned);signer.end();const assertion=`${unsigned}.${signer.sign(this.privateKey).toString('base64url')}`;
    const response=await this.fetchImpl('https://oauth2.googleapis.com/token',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({grant_type:'urn:ietf:params:oauth:grant-type:jwt-bearer',assertion}),signal:AbortSignal.timeout(30_000)});if(!response.ok)throw new Error(`Google credential exchange failed (${response.status}).`);const result=await response.json();if(!result.access_token)throw new Error('Google did not return an access token.');this.cachedToken={value:result.access_token,expiresAt:this.clock()+Math.max(60,Number(result.expires_in)||3600)*1000};return result.access_token;
  }
  async request(path,options={}){const token=await this.accessToken(),response=await this.fetchImpl(`https://sheets.googleapis.com/v4/${path}`,{...options,headers:{'Authorization':`Bearer ${token}`,'Content-Type':'application/json',...(options.headers||{})},signal:AbortSignal.timeout(60_000)});if(!response.ok)throw new Error(`Google Sheets request failed (${response.status}).`);return response.json();}
  async verify(value){const id=spreadsheetId(value);const result=await this.request(`spreadsheets/${id}?fields=spreadsheetId,properties.title`);return {provider:'google_sheets',spreadsheetId:result.spreadsheetId,title:result.properties?.title||'',verified:true};}
  async readRange(value,range){const id=spreadsheetId(value),safeRange=rangeValue(range);return this.request(`spreadsheets/${id}/values/${encodeURIComponent(safeRange)}`);}
  async updateRange(value,range,values){const id=spreadsheetId(value),safeRange=rangeValue(range);if(!Array.isArray(values)||!values.length)throw new Error('Values are required.');return this.request(`spreadsheets/${id}/values/${encodeURIComponent(safeRange)}?valueInputOption=RAW`,{method:'PUT',body:JSON.stringify({range:safeRange,majorDimension:'ROWS',values})});}
}

export function createGoogleSheetsProvider(credentials,options={}){return credentials?new GoogleSheetsProvider({credentials,...options}):null;}
