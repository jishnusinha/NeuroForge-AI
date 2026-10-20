import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { createApp } from '../server/app.js';
import { trustedCorsOrigins, requestIdOrNew } from '../server/securityPolicy.js';

test('C0 allowlist accepts exact HTTPS origins, rejects wildcard and insecure external origin',()=>{
 assert.deepEqual(trustedCorsOrigins({originList:'https://demo.example, https://api.example',publicAppUrl:'https://demo.example/app'}),
 ['https://demo.example','https://api.example']);
 assert.throws(()=>trustedCorsOrigins({originList:'*'}));
 assert.throws(()=>trustedCorsOrigins({originList:'http://malicious.example'}),/INVALID_PRODUCTION/);
 assert.throws(()=>trustedCorsOrigins({originList:'https://demo.example/path'}),/INVALID_PRODUCTION/);
});

test('C0 request IDs are bounded, printable and not directly taken from hostile headers',()=>{
 assert.equal(requestIdOrNew('valid-id.123',()=> 'fallback'),'valid-id.123');
 assert.equal(requestIdOrNew('bad\nvalue',()=> 'fallback'),'fallback');
 assert.equal(requestIdOrNew('x'.repeat(80),()=> 'fallback'),'fallback');
 assert.equal(requestIdOrNew(['two','values'],()=> 'fallback'),'fallback');
});

async function withHttpApp(callback) {
 const server=createApp({ allowMemoryFallback:true, enforceOriginPolicy:true, allowedOrigins:['https://allowed.example'] }).listen(0,'127.0.0.1');
 await new Promise(resolve=>server.once('listening',resolve));
 try {return await callback(`http://127.0.0.1:${server.address().port}`);}
 finally{await new Promise(resolve=>server.close(resolve));}
}

test('C0 production-like API limits CORS and avoids exposing process memory diagnostics',async()=>{
 await withHttpApp(async base=>{
  const allowed=await fetch(base+'/api/health',{headers:{Origin:'https://allowed.example','x-request-id':'api-test-17'}});
  assert.equal(allowed.status,200);
  assert.equal(allowed.headers.get('access-control-allow-origin'),'https://allowed.example');
  assert.equal(allowed.headers.get('x-request-id'),'api-test-17');
  assert.equal(allowed.headers.get('cache-control'),'no-store');
  assert.equal(allowed.headers.get('x-content-type-options'),'nosniff');

  const denied=await fetch(base+'/api/health',{headers:{Origin:'https://evil.example'}});
  assert.equal(denied.status,403);
  assert.equal((await denied.json()).code,'ORIGIN_NOT_ALLOWED');
  assert.equal(denied.headers.get('access-control-allow-origin'),null);
  const diag=await fetch(base+'/api/v2/diagnostics');
  assert.equal(diag.status,404);
  assert.equal((await diag.json()).code,'NOT_FOUND');
 });
});

test('C0 production process refuses to listen without an explicit MongoDB URI',()=>{
 const entry=fileURLToPath(new URL('../server/index.js',import.meta.url));
 const result=spawnSync(process.execPath,[entry],{
  env:{...process.env,NODE_ENV:'production',MONGODB_URI:'',PORT:'0'},
  encoding:'utf8',timeout:10000,
 });
 assert.equal(result.status,1,result.stderr);
 assert.match(result.stderr,/PRODUCTION_MONGODB_URI_REQUIRED/);
 assert.doesNotMatch(result.stderr,/mongodb:\/\//i);
});
