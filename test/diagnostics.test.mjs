import test from 'node:test';
import assert from 'node:assert/strict';
import {normalizeWebsite,normalizeDomain,connectionSummary,csvText,resolveDns,resolvers} from '../public/diagnostics.mjs';
import {probeExit} from '../public/probes.mjs';

test('custom targets accept HTTPS public sites and reject local networks or credentials',()=>{
 assert.equal(normalizeWebsite('example.com'),'https://example.com/');
 assert.equal(normalizeWebsite('https://example.com/a#x'),'https://example.com/a');
 for(const value of ['http://example.com','https://localhost','https://10.0.0.1','https://127.1','https://169.254.169.254','https://[::ffff:127.0.0.1]','https://user:pass@example.com','https://example.com:8443','file:///etc/passwd'])assert.throws(()=>normalizeWebsite(value),value);
});
test('DNS accepts domain names but rejects paths, queries and IP literals',()=>{
 assert.equal(normalizeDomain('example.com.'),'example.com');
 assert.match(normalizeDomain('例子.测试'),/^xn--/);
 for(const value of ['example.com/path','example.com?token=secret','1.1.1.1','localhost'])assert.throws(()=>normalizeDomain(value));
});
test('quality statistics keep failures distinct from successful samples and handle empty input',()=>{
 const value=connectionSummary([{ms:10},{error:'timeout'},{ms:30},{ms:20}]);
 assert.equal(value.failedPercent,25);assert.equal(value.median,20);assert.equal(value.jitter,15);assert.equal(value.min,10);assert.equal(value.max,30);
 assert.equal(connectionSummary([]).median,null);assert.equal(connectionSummary([{error:'offline'}]).min,null);
});
test('CSV export quotes values and neutralizes spreadsheet formulas',()=>{
 const text=csvText([['name','value'],['=HYPERLINK("bad")','a,b'],['ordinary','a"b']]);
 assert.match(text,/"'=HYPERLINK/);assert.match(text,/"a,b"/);assert.match(text,/"a""b"/);
});
test('DNS distinguishes NXDOMAIN from network failure without inventing records',async()=>{
 const original=globalThis.fetch;
 try {globalThis.fetch=async()=>new Response(JSON.stringify({Status:3}));const result=await resolveDns(resolvers[0],'example.com','A',new AbortController().signal);assert.equal(result.status,3);assert.deepEqual(result.answers,[]);
 globalThis.fetch=async()=>new Response('bad',{status:503});await assert.rejects(resolveDns(resolvers[0],'example.com','A',new AbortController().signal),/503/);
 }finally{globalThis.fetch=original;}
});
test('fallback results disclose the actual successful detection hostname',async()=>{
 const original=globalThis.fetch;const calls=[];
 try {globalThis.fetch=async address=>{calls.push(new URL(address).host);if(calls.length===1)throw new TypeError('CORS');return new Response('ip=1.1.1.1\nloc=AU\n');};
 const value=await probeExit({url:'https://primary.example/cdn-cgi/trace',fallbacks:[{url:'https://backup.example/cdn-cgi/trace'}]},new AbortController().signal);
 assert.equal(value.host,'backup.example');assert.equal(value.viaFallback,true);assert.equal(value.attempts[0].host,'primary.example');
 }finally{globalThis.fetch=original;}
});
test('user cancellation never starts fallback traffic',async()=>{
 const original=globalThis.fetch;const controller=new AbortController();let calls=0;
 try {globalThis.fetch=async()=>{calls++;controller.abort(new Error('cancel'));throw new Error('network');};await assert.rejects(probeExit({url:'https://primary.example/',fallbacks:[{url:'https://backup.example/'}]},controller.signal),/cancel/);assert.equal(calls,1);}finally{globalThis.fetch=original;}
});
