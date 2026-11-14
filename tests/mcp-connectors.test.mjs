import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeMcpConnector, verifyMcpConnector } from '../apps/api/mcp-connectors.mjs';

test('MCP connector configuration stores only an environment secret reference',()=>{
  const connector=normalizeMcpConnector({connectorType:'composio',displayName:'School tools',authMode:'x-api-key',secretRef:'env:COMPOSIO_API_KEY'});
  assert.equal(connector.config.endpoint,'https://connect.composio.dev/mcp');
  assert.equal(connector.secretRef,'env:COMPOSIO_API_KEY');
  const consumer=normalizeMcpConnector({connectorType:'composio',displayName:'Personal tools',authMode:'x-consumer-api-key',secretRef:'env:COMPOSIO_CONSUMER_KEY'});assert.equal(consumer.config.authMode,'x-consumer-api-key');
  assert.throws(()=>normalizeMcpConnector({connectorType:'zapier',displayName:'Zapier'}),/valid HTTPS/);
  assert.throws(()=>normalizeMcpConnector({connectorType:'mcp',displayName:'Unsafe',endpoint:'http://localhost:3000/mcp'}),/public HTTPS/);
  assert.throws(()=>normalizeMcpConnector({connectorType:'mcp',displayName:'Leaky',endpoint:'https://tools.vendor.com/mcp?token=secret'}),/query parameters/);
  assert.throws(()=>normalizeMcpConnector({connectorType:'zapier',displayName:'Zapier',endpoint:'https://mcp.zapier.com/api/mcp/s/example/mcp',authMode:'bearer',secretRef:'raw-secret'}),/environment secret reference/);
});

test('MCP verification initializes a public server and discovers tools without exposing its secret',async()=>{
  const calls=[];
  const fetchImpl=async(url,options)=>{
    calls.push({url,options});const request=JSON.parse(options.body);
    if(request.method==='initialize')return new Response(JSON.stringify({jsonrpc:'2.0',id:'initialize',result:{protocolVersion:'2025-11-25',serverInfo:{name:'Test tools',version:'1.0'}}}),{status:200,headers:{'Content-Type':'application/json','Mcp-Session-Id':'session-1'}});
    if(request.method==='notifications/initialized')return new Response(null,{status:202});
    return new Response(JSON.stringify({jsonrpc:'2.0',id:'tools',result:{tools:[{name:'calendar_read',description:'Read calendar items'}]}}),{status:200,headers:{'Content-Type':'application/json'}});
  };
  const result=await verifyMcpConnector({config:JSON.stringify({endpoint:'https://tools.vendor.com/mcp',authMode:'bearer'}),secret_ref:'env:TEST_MCP_TOKEN'},{fetchImpl,lookupImpl:async()=>[{address:'93.184.216.34'}],environment:{TEST_MCP_TOKEN:'server-only-token'}});
  assert.equal(result.verified,true);assert.deepEqual(result.tools.map(tool=>tool.name),['calendar_read']);
  assert.equal(calls[0].options.headers.Authorization,'Bearer server-only-token');assert.equal(calls[2].options.headers['Mcp-Session-Id'],'session-1');
  assert.doesNotMatch(JSON.stringify(result),/server-only-token/);
});
