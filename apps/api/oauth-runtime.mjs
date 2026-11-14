import { createHash, randomBytes, randomUUID } from 'node:crypto';

export const GOOGLE_OAUTH_SCOPES=Object.freeze([
  'openid','email','profile',
  'https://www.googleapis.com/auth/drive.file',
  'https://www.googleapis.com/auth/calendar.events',
  'https://www.googleapis.com/auth/gmail.compose'
]);
const now=()=>new Date().toISOString();
const sha=value=>createHash('sha256').update(value).digest();
const hash=value=>sha(value).toString('hex');
const b64url=value=>Buffer.from(value).toString('base64url');
const jsonOrText=async response=>{const text=await response.text();try{return JSON.parse(text);}catch{return {error:text||`HTTP ${response.status}`};}};

export function createOAuthRuntime(db,{vault,environment=process.env,fetchImpl=fetch}={}){
  const locks=new Map();
  const config=()=>({
    clientId:environment.COLLEAGUE_ZERO_GOOGLE_CLIENT_ID,
    clientSecret:environment.COLLEAGUE_ZERO_GOOGLE_CLIENT_SECRET,
    redirectUri:environment.COLLEAGUE_ZERO_GOOGLE_REDIRECT_URI||'http://localhost:3005/api/connectors/oauth/callback'
  });
  const requireConfigured=()=>{const value=config();if(!vault?.configured||!value.clientId||!value.clientSecret)throw new Error('Google OAuth is awaiting credentials. Configure the Google client ID, client secret, redirect URI, and token encryption key.');return value;};
  const connector=(organizationId,connectionId)=>db.prepare("SELECT * FROM connector_connections WHERE id=? AND organization_id=? AND connector_type='google_workspace'").get(connectionId,organizationId);

  async function tokenRequest(params){
    const response=await fetchImpl('https://oauth2.googleapis.com/token',{method:'POST',headers:{'content-type':'application/x-www-form-urlencoded'},body:new URLSearchParams(params)}),payload=await jsonOrText(response);
    if(!response.ok){const error=new Error(payload.error_description||payload.error||'Google token exchange failed.');error.code=payload.error;error.status=response.status;throw error;}
    return payload;
  }
  async function start({organizationId,connectionId,userId}){
    const target=connector(organizationId,connectionId);if(!target)throw new Error('Google Workspace connection not found.');
    const oauth=requireConfigured(),state=randomBytes(32).toString('base64url'),verifier=randomBytes(64).toString('base64url'),challenge=b64url(sha(verifier)),created=now(),expiresAt=new Date(Date.now()+10*60_000).toISOString(),sealed=vault.encrypt({verifier});
    db.prepare("UPDATE oauth_states SET status='expired' WHERE organization_id=? AND connection_id=? AND status='pending'").run(organizationId,connectionId);
    db.prepare('INSERT INTO oauth_states(id,organization_id,connection_id,user_id,provider,state_hash,pkce_verifier_encrypted,redirect_uri,status,expires_at,created_at) VALUES(?,?,?,?,?,?,?,?,?,?,?)')
      .run(randomUUID(),organizationId,connectionId,userId,'google',hash(state),JSON.stringify(sealed),oauth.redirectUri,'pending',expiresAt,created);
    db.prepare("UPDATE connector_connections SET status='authorizing',updated_at=? WHERE id=? AND organization_id=?").run(created,connectionId,organizationId);
    const query=new URLSearchParams({client_id:oauth.clientId,redirect_uri:oauth.redirectUri,response_type:'code',scope:GOOGLE_OAUTH_SCOPES.join(' '),access_type:'offline',include_granted_scopes:'true',prompt:'consent',state,code_challenge:challenge,code_challenge_method:'S256'});
    return {authorizationUrl:`https://accounts.google.com/o/oauth2/v2/auth?${query}`,expiresAt};
  }
  async function callback({state,code}){
    if(!state||!code)throw new Error('OAuth state and authorization code are required.');
    const stateHash=hash(state),flow=db.prepare("SELECT * FROM oauth_states WHERE state_hash=? AND status='pending'").get(stateHash);
    if(!flow)throw new Error('No active OAuth flow matches this callback.');
    if(flow.expires_at<=now()){db.prepare("UPDATE oauth_states SET status='expired' WHERE id=?").run(flow.id);throw new Error('OAuth flow expired. Start the connection again.');}
    const target=connector(flow.organization_id,flow.connection_id);if(!target)throw new Error('Google Workspace connection no longer exists.');
    const claimed=db.prepare("UPDATE oauth_states SET status='exchanging' WHERE id=? AND status='pending'").run(flow.id);if(!claimed.changes)throw new Error('OAuth flow was already used. Start the connection again.');
    const oauth=requireConfigured(),sealed=JSON.parse(flow.pkce_verifier_encrypted),{verifier}=vault.decrypt({...sealed,auth_tag:sealed.authTag});
    let tokens;try{tokens=await tokenRequest({code,client_id:oauth.clientId,client_secret:oauth.clientSecret,redirect_uri:flow.redirect_uri,grant_type:'authorization_code',code_verifier:verifier});}catch(error){db.prepare("UPDATE oauth_states SET status='failed',consumed_at=? WHERE id=? AND status='exchanging'").run(now(),flow.id);db.prepare("UPDATE connector_connections SET status='reauthorization_required',updated_at=? WHERE id=? AND organization_id=?").run(now(),flow.connection_id,flow.organization_id);throw error;}
    let email=null;
    try{const profileResponse=await fetchImpl('https://openidconnect.googleapis.com/v1/userinfo',{headers:{authorization:`Bearer ${tokens.access_token}`}}),profile=await jsonOrText(profileResponse);if(profileResponse.ok)email=profile.email||null;}catch{}
    const scopes=String(tokens.scope||GOOGLE_OAUTH_SCOPES.join(' ')).split(/\s+/).filter(Boolean),accessExpiresAt=new Date(Date.now()+Math.max(60,Number(tokens.expires_in||3600))*1000).toISOString();
    const previous=vault.get({organizationId:flow.organization_id,connectionId:flow.connection_id});
    vault.put({organizationId:flow.organization_id,connectionId:flow.connection_id,values:{accessToken:tokens.access_token,refreshToken:tokens.refresh_token||previous?.values?.refreshToken||null,tokenType:tokens.token_type||'Bearer'},scopeSet:scopes,accessExpiresAt});
    const completed=now();
    db.prepare("UPDATE oauth_states SET status='consumed',consumed_at=? WHERE id=? AND status='exchanging'").run(completed,flow.id);
    db.prepare("UPDATE connector_connections SET status='verified',scopes=?,account_email=?,last_verified_at=?,updated_at=? WHERE id=? AND organization_id=?").run(JSON.stringify(scopes),email,completed,completed,flow.connection_id,flow.organization_id);
    return {organizationId:flow.organization_id,connectionId:flow.connection_id,status:'verified',accountEmail:email,scopes};
  }
  async function refresh({organizationId,connectionId}){
    const lockKey=`${organizationId}:${connectionId}`;if(locks.has(lockKey))return locks.get(lockKey);
    const work=(async()=>{const oauth=requireConfigured(),credential=vault.get({organizationId,connectionId});if(!credential?.values?.refreshToken)throw new Error('Google connection requires reauthorization.');
      try{const tokens=await tokenRequest({client_id:oauth.clientId,client_secret:oauth.clientSecret,refresh_token:credential.values.refreshToken,grant_type:'refresh_token'}),accessExpiresAt=new Date(Date.now()+Math.max(60,Number(tokens.expires_in||3600))*1000).toISOString(),scopes=String(tokens.scope||credential.scopeSet.join(' ')).split(/\s+/).filter(Boolean);vault.put({organizationId,connectionId,values:{...credential.values,accessToken:tokens.access_token,tokenType:tokens.token_type||credential.values.tokenType},scopeSet:scopes,accessExpiresAt});return tokens.access_token;}catch(error){if(error.code==='invalid_grant')db.prepare("UPDATE connector_connections SET status='reauthorization_required',updated_at=? WHERE id=? AND organization_id=?").run(now(),connectionId,organizationId);throw error;}})();
    locks.set(lockKey,work);try{return await work;}finally{locks.delete(lockKey);}
  }
  async function accessToken({organizationId,connectionId}){
    const credential=vault.get({organizationId,connectionId});if(!credential)throw new Error('Google connection is not authorized.');
    if(!credential.accessExpiresAt||Date.parse(credential.accessExpiresAt)-Date.now()>90_000)return credential.values.accessToken;
    return refresh({organizationId,connectionId});
  }
  async function revoke({organizationId,connectionId}){
    const target=connector(organizationId,connectionId);if(!target)throw new Error('Google Workspace connection not found.');
    const credential=vault.get({organizationId,connectionId});
    if(credential?.values){const token=credential.values.refreshToken||credential.values.accessToken;if(token)try{await fetchImpl(`https://oauth2.googleapis.com/revoke?token=${encodeURIComponent(token)}`,{method:'POST',headers:{'content-type':'application/x-www-form-urlencoded'}});}catch{}}
    vault.deleteConnection({organizationId,connectionId});const timestamp=now();
    db.prepare("UPDATE connector_connections SET status='reauthorization_required',scopes='[]',account_email=NULL,last_verified_at=NULL,updated_at=? WHERE id=? AND organization_id=?").run(timestamp,connectionId,organizationId);
    db.prepare("UPDATE mcp_tool_catalog SET status='disabled',updated_at=? WHERE organization_id=? AND connection_id=?").run(timestamp,organizationId,connectionId);
    db.prepare('UPDATE tool_policy_grants SET revoked_at=? WHERE organization_id=? AND connection_id=? AND revoked_at IS NULL').run(timestamp,organizationId,connectionId);
    return {ok:true,status:'reauthorization_required'};
  }
  function health({organizationId,connectionId}){
    const target=connector(organizationId,connectionId);if(!target)return null;
    const metadata=vault.metadata({organizationId,connectionId})[0]||null;
    return {id:target.id,provider:'google',status:target.status,accountEmail:target.account_email||null,scopes:JSON.parse(target.scopes),lastVerifiedAt:target.last_verified_at,credentialVault:metadata?{configured:true,accessExpiresAt:metadata.access_expires_at,updatedAt:metadata.updated_at}:{configured:false},oauthConfigured:Boolean(vault.configured&&config().clientId&&config().clientSecret)};
  }
  return {configured:Boolean(vault?.configured&&config().clientId&&config().clientSecret),start,callback,accessToken,refresh,revoke,health};
}
