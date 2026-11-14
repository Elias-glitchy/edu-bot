export function applySecurityHeaders(req,res,requestId){
  const frameAncestors=String(req.url||'').startsWith('/computer-stream/')?"'self'":"'none'";
  res.setHeader('X-Request-Id',requestId);
  res.setHeader('X-Content-Type-Options','nosniff');
  res.setHeader('Referrer-Policy','no-referrer');
  res.setHeader('Permissions-Policy','camera=(), microphone=(), geolocation=(), payment=(), usb=()');
  res.setHeader('Cross-Origin-Opener-Policy','same-origin');
  res.setHeader('Content-Security-Policy',`default-src 'self'; img-src 'self' data: blob:; style-src 'self' 'unsafe-inline'; script-src 'self'; connect-src 'self' ws: wss:; worker-src 'self' blob:; object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors ${frameAncestors}`);
  if(req.headers['x-forwarded-proto']==='https'||req.socket?.encrypted)res.setHeader('Strict-Transport-Security','max-age=31536000; includeSubDomains');
}

export class RateLimiter {
  constructor({windowMs=60_000,limit=240,clock=()=>Date.now()}={}){this.windowMs=windowMs;this.limit=limit;this.clock=clock;this.buckets=new Map();}
  consume(key,{limit=this.limit}={}){
    const instant=this.clock(),windowStart=instant-this.windowMs;let bucket=this.buckets.get(key)||[];bucket=bucket.filter(value=>value>windowStart);
    if(bucket.length>=limit){this.buckets.set(key,bucket);return {allowed:false,retryAfterSeconds:Math.max(1,Math.ceil((bucket[0]+this.windowMs-instant)/1000))};}
    bucket.push(instant);this.buckets.set(key,bucket);if(this.buckets.size>10_000)for(const [name,values] of this.buckets)if(!values.some(value=>value>windowStart))this.buckets.delete(name);return {allowed:true,remaining:limit-bucket.length};
  }
}

export const createRateLimiter=options=>new RateLimiter(options);
