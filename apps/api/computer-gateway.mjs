import { request as httpRequest } from 'node:http';
import { connect } from 'node:net';
import { resolveStreamToken } from './computers.mjs';

const target=(db,url)=>{const match=url.pathname.match(/^\/computer-stream\/([^/]+)(\/.*)?$/);if(!match)return null;const access=resolveStreamToken(db,match[1]);return access?{access,path:match[2]||'/'}:null;};
const cleanHeaders=headers=>Object.fromEntries(Object.entries(headers).filter(([key])=>!['cookie','authorization','host'].includes(key.toLowerCase())).map(([key,value])=>[key,value]));

export function proxyComputerHttp(db,req,res,url){
  const destination=target(db,url);if(!destination){res.writeHead(401,{'Content-Type':'text/plain','Cache-Control':'no-store'});res.end('Computer stream token is invalid or expired.');return;}
  const upstream=httpRequest({host:'127.0.0.1',port:destination.access.host_port,path:destination.path+url.search,method:req.method,headers:{...cleanHeaders(req.headers),host:`127.0.0.1:${destination.access.host_port}`}},response=>{const headers={...response.headers,'cache-control':'no-store','x-content-type-options':'nosniff'};delete headers['set-cookie'];res.writeHead(response.statusCode||502,headers);response.pipe(res);});
  upstream.on('error',()=>{if(!res.headersSent)res.writeHead(502,{'Content-Type':'text/plain','Cache-Control':'no-store'});res.end('Bot computer stream is unavailable.');});req.pipe(upstream);
}
export function proxyComputerUpgrade(db,req,socket,head){
  const url=new URL(req.url,'http://localhost'),destination=target(db,url);if(!destination){socket.end('HTTP/1.1 401 Unauthorized\r\nConnection: close\r\n\r\n');return;}
  const upstream=connect(destination.access.host_port,'127.0.0.1',()=>{const headers=cleanHeaders(req.headers),lines=[`${req.method} ${destination.path+url.search} HTTP/${req.httpVersion}`,...Object.entries(headers).map(([key,value])=>`${key}: ${String(value).replace(/[\r\n]/g,'')}`),`host: 127.0.0.1:${destination.access.host_port}`,'',''];upstream.write(lines.join('\r\n'));if(head?.length)upstream.write(head);socket.pipe(upstream).pipe(socket);});
  const close=()=>{if(!socket.destroyed)socket.destroy();if(!upstream.destroyed)upstream.destroy();};upstream.on('error',close);socket.on('error',close);
}
