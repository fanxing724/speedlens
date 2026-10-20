import test from 'node:test';
import assert from 'node:assert/strict';
import {parseTrace,parseHeaderIp,maskIp,probeExit,deadline,eachLimit} from '../public/probes.mjs';

test('trace parser preserves valid source evidence and ignores non-IP challenge pages',()=>{
  assert.deepEqual(parseTrace('ip=1.1.1.1\nloc=AU\ncolo=SYD\nuag=foo=bar\n'),{ip:'1.1.1.1',countryCode:'AU',colo:'SYD'});
  assert.throws(()=>parseTrace('<html>Forbidden</html>'));
  assert.throws(()=>parseTrace('ip=999.1.1.1'));
});
test('IP response headers must contain a valid IP and missing headers remain unknown',()=>{
  assert.equal(parseHeaderIp(new Headers({'x-request-ip':'8.8.8.8'})),'8.8.8.8');
  assert.equal(parseHeaderIp(new Headers({'x-response-cinfo':'client=2606:4700:4700::1111;edge=abc'})),'2606:4700:4700::1111');
  assert.throws(()=>parseHeaderIp(new Headers()));
});
test('masking hides IPv4/IPv6 and can explicitly reveal the original address',()=>{
  assert.equal(maskIp('113.123.45.67'),'113.***.**.**');
  assert.equal(maskIp('2606:4700:4700::1111'),'2606:4700:****:****');
  assert.equal(maskIp('8.8.8.8',false),'8.8.8.8');
  assert.equal(maskIp('<img>'),'—');
});
test('browser exit probe reads CORS text and records the actual probe hostname',async()=>{
  const original=globalThis.fetch;
  globalThis.fetch=async(url,options)=>{assert.equal(options.credentials,'omit');assert.equal(new URL(url).host,'chatgpt.com');return new Response('ip=1.1.1.1\nloc=AU\n');};
  try{const result=await probeExit({url:'https://chatgpt.com/cdn-cgi/trace'},new AbortController().signal);assert.equal(result.ip,'1.1.1.1');assert.equal(result.host,'chatgpt.com');}finally{globalThis.fetch=original;}
});
test('an unreadable or non-success trace cannot become a successful exit result',async()=>{
  const original=globalThis.fetch;
  try{globalThis.fetch=async()=>new Response('ip=1.1.1.1',{status:403});await assert.rejects(probeExit({url:'https://example.com/cdn-cgi/trace'},new AbortController().signal),/403/);
    globalThis.fetch=async()=>new Response('challenge');await assert.rejects(probeExit({url:'https://example.com/cdn-cgi/trace'},new AbortController().signal),/有效/);
  }finally{globalThis.fetch=original;}
});
test('cancelled requests reject before starting external fetches',async()=>{
  const controller=new AbortController();controller.abort(new Error('stopped'));
  await assert.rejects(deadline(controller.signal,100,()=>{throw new Error('must not run');}),/stopped/);
});
test('probe queue obeys the concurrency limit',async()=>{
  let active=0,maximum=0,completed=0;
  await eachLimit([1,2,3,4,5,6],2,new AbortController().signal,async()=>{active++;maximum=Math.max(maximum,active);await new Promise(resolve=>setTimeout(resolve,5));active--;completed++;});
  assert.equal(maximum,2);assert.equal(completed,6);
});
