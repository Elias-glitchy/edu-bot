import { randomBytes } from 'node:crypto';

const clean=value=>String(value??'');

export class CredentialBroker {
  constructor({clock=()=>Date.now(),maxTtlMs=10*60_000}={}){this.clock=clock;this.maxTtlMs=maxTtlMs;this.leases=new Map();}
  purge(){const instant=this.clock();for(const [leaseId,lease] of this.leases)if(lease.expiresAtMs<=instant)this.leases.delete(leaseId);}
  issue({organizationId,connectionId='temporary',values,ttlMs=5*60_000}){
    this.purge();
    if(!organizationId)throw new Error('Organization is required.');
    if(!values||typeof values!=='object'||Array.isArray(values))throw new Error('Credential fields are required.');
    const entries=Object.entries(values);
    if(!entries.length||entries.length>12)throw new Error('Provide between 1 and 12 credential fields.');
    const secretValues={};
    for(const [field,value] of entries){
      if(!/^[a-z][a-z0-9_.-]{0,63}$/i.test(field))throw new Error('Credential field names must be simple identifiers.');
      const secret=clean(value);if(!secret||secret.length>8000)throw new Error('Credential values must be between 1 and 8,000 characters.');
      secretValues[field]=secret;
    }
    const leaseId=randomBytes(24).toString('base64url'),createdAtMs=this.clock(),expiresAtMs=createdAtMs+Math.max(30_000,Math.min(Number(ttlMs)||0,this.maxTtlMs));
    this.leases.set(leaseId,{organizationId,connectionId:clean(connectionId).slice(0,100),values:secretValues,createdAtMs,expiresAtMs});
    return {leaseId,connectionId:clean(connectionId).slice(0,100),fields:Object.keys(secretValues),expiresAt:new Date(expiresAtMs).toISOString()};
  }
  consume({organizationId,leaseId,field}){
    this.purge();const lease=this.leases.get(leaseId);
    if(!lease||lease.organizationId!==organizationId)throw new Error('Credential lease is missing, expired, or outside this workspace.');
    if(!Object.hasOwn(lease.values,field))throw new Error('Credential field is missing or already consumed.');
    const value=lease.values[field];delete lease.values[field];
    if(!Object.keys(lease.values).length)this.leases.delete(leaseId);
    return value;
  }
  revoke({organizationId,leaseId}){const lease=this.leases.get(leaseId);if(!lease||lease.organizationId!==organizationId)return false;this.leases.delete(leaseId);return true;}
  count(){this.purge();return this.leases.size;}
}

export const createCredentialBroker=options=>new CredentialBroker(options);
