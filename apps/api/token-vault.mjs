import { createCipheriv, createDecipheriv, createHash, randomBytes, randomUUID } from 'node:crypto';

const timestamp=()=>new Date().toISOString();

function keyBytes(value){
  if(!value)return null;
  const raw=String(value).trim();
  if(/^[a-f0-9]{64}$/i.test(raw))return Buffer.from(raw,'hex');
  try{const decoded=Buffer.from(raw,'base64');if(decoded.length===32)return decoded;}catch{}
  const utf8=Buffer.from(raw,'utf8');
  if(utf8.length===32)return utf8;
  return null;
}

export function createTokenVault(db,{encryptionKey,keyVersion='v1'}={}){
  const key=keyBytes(encryptionKey);
  const configured=Boolean(key);
  const requireKey=()=>{if(!key)throw new Error('Credential vault is not configured. Set COLLEAGUE_ZERO_TOKEN_ENCRYPTION_KEY to a 32-byte base64, hex, or text key.');return key;};
  const encrypt=value=>{
    const iv=randomBytes(12),cipher=createCipheriv('aes-256-gcm',requireKey(),iv),plaintext=Buffer.from(JSON.stringify(value));
    const ciphertext=Buffer.concat([cipher.update(plaintext),cipher.final()]);
    return {ciphertext:ciphertext.toString('base64'),iv:iv.toString('base64'),authTag:cipher.getAuthTag().toString('base64'),keyVersion};
  };
  const decrypt=record=>{
    const decipher=createDecipheriv('aes-256-gcm',requireKey(),Buffer.from(record.iv,'base64'));
    decipher.setAuthTag(Buffer.from(record.auth_tag||record.authTag,'base64'));
    return JSON.parse(Buffer.concat([decipher.update(Buffer.from(record.ciphertext,'base64')),decipher.final()]).toString('utf8'));
  };
  return {
    configured,
    encrypt,
    decrypt,
    put({organizationId,connectionId,credentialType='oauth_tokens',values,scopeSet=[],accessExpiresAt=null}){
      const sealed=encrypt(values),now=timestamp(),existing=db.prepare('SELECT id,created_at FROM connection_credentials WHERE organization_id=? AND connection_id=? AND credential_type=?').get(organizationId,connectionId,credentialType);
      const credentialId=existing?.id||randomUUID();
      db.prepare(`INSERT INTO connection_credentials(id,organization_id,connection_id,credential_type,ciphertext,iv,auth_tag,key_version,scope_set,access_expires_at,created_at,updated_at)
        VALUES(?,?,?,?,?,?,?,?,?,?,?,?) ON CONFLICT(organization_id,connection_id,credential_type) DO UPDATE SET ciphertext=excluded.ciphertext,iv=excluded.iv,auth_tag=excluded.auth_tag,key_version=excluded.key_version,scope_set=excluded.scope_set,access_expires_at=excluded.access_expires_at,updated_at=excluded.updated_at`)
        .run(credentialId,organizationId,connectionId,credentialType,sealed.ciphertext,sealed.iv,sealed.authTag,sealed.keyVersion,JSON.stringify(scopeSet),accessExpiresAt,existing?.created_at||now,now);
      return {id:credentialId,scopeSet,accessExpiresAt,updatedAt:now};
    },
    get({organizationId,connectionId,credentialType='oauth_tokens'}){
      const row=db.prepare('SELECT * FROM connection_credentials WHERE organization_id=? AND connection_id=? AND credential_type=?').get(organizationId,connectionId,credentialType);
      if(!row)return null;
      return {values:decrypt(row),scopeSet:JSON.parse(row.scope_set),accessExpiresAt:row.access_expires_at,updatedAt:row.updated_at};
    },
    metadata({organizationId,connectionId}){
      return db.prepare('SELECT credential_type,scope_set,access_expires_at,updated_at FROM connection_credentials WHERE organization_id=? AND connection_id=?').all(organizationId,connectionId).map(row=>({...row,scope_set:JSON.parse(row.scope_set)}));
    },
    deleteConnection({organizationId,connectionId}){return db.prepare('DELETE FROM connection_credentials WHERE organization_id=? AND connection_id=?').run(organizationId,connectionId).changes;},
    fingerprint(){return key?createHash('sha256').update(key).digest('hex').slice(0,12):null;}
  };
}
