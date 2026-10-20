import test from 'node:test';
import assert from 'node:assert/strict';
import { createApp, publicIp, normalizeRisk, clientIp } from '../server.mjs';

const riskFixture={ip:'1.1.1.1',location:{country:'Australia',city:'Sydney'},isp:{isp:'Example Network',asn:'AS13335'},risk:{is_vpn:false,is_proxy:false,is_tor:false,is_datacenter:true,risk_score:20}};
async function withApp(task,options={}) {
  const server=createApp(options);await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  const base=`http://127.0.0.1:${server.address().port}`;
  try{await task(base);}finally{server.closeAllConnections();await new Promise(resolve=>server.close(resolve));}
}

test('private and reserved addresses cannot be sent to upstream lookup',()=>{
  for(const ip of ['127.0.0.1','10.0.0.1','172.16.0.1','192.168.1.1','169.254.169.254','100.64.0.1','0.0.0.0','224.0.0.1','198.18.0.1','203.0.113.1','192.0.2.1','::1','fe80::1','fc00::1','2001:db8::1','::ffff:127.0.0.1','localhost','https://example.com']) assert.equal(publicIp(ip),false,ip);
  for(const ip of ['1.1.1.1','8.8.8.8','2606:4700:4700::1111']) assert.equal(publicIp(ip),true,ip);
});
test('risk normalization preserves unknown booleans',()=>{
  const result=normalizeRisk({...riskFixture,risk:{...riskFixture.risk,is_vpn:undefined,is_abuser:'false'}});
  assert.equal(result.flags.is_vpn,null);assert.equal(result.flags.is_abuser,null);assert.equal(result.flags.is_datacenter,true);
  assert.throws(()=>normalizeRisk({error:'Quota exhausted'}));
});
test('forwarded IP headers are ignored outside explicitly trusted deployments',()=>{
  const req={headers:{'cf-connecting-ip':'1.1.1.1','x-forwarded-for':'8.8.8.8'},socket:{remoteAddress:'::ffff:127.0.0.1'}};
  assert.equal(clientIp(req,false),'127.0.0.1');assert.equal(clientIp(req,true),'1.1.1.1');
});
test('static routes, health check and security headers work without external dependencies',async()=>withApp(async base=>{
  const health=await fetch(`${base}/healthz`);assert.equal(health.status,200);assert.equal((await health.json()).status,'ok');
  const home=await fetch(base);assert.match(await home.text(),/SpeedLens/);assert.equal(home.headers.get('x-frame-options'),'DENY');assert.match(home.headers.get('content-security-policy'),/frame-ancestors 'none'/);
  const secret=await fetch(`${base}/.env`);assert.equal(secret.status,404);
  const bad=await fetch(`${base}/api/lookup?ip=169.254.169.254`);assert.equal(bad.status,400);
  const head=await fetch(base,{method:'HEAD'});assert.equal((await head.text()).length,0);
}));
test('lookup deduplicates requests, caches results and does not expose upstream raw fields',async()=>{
  let calls=0;
  await withApp(async base=>{
    const responses=await Promise.all([fetch(`${base}/api/lookup?ip=1.1.1.1`),fetch(`${base}/api/lookup?ip=1.1.1.1`)]);
    const payloads=await Promise.all(responses.map(r=>r.json()));assert.equal(calls,1);assert.equal(payloads[0].flags.is_datacenter,true);
    const cached=await fetch(`${base}/api/lookup?ip=1.1.1.1`).then(r=>r.json());assert.equal(cached.cached,true);assert.equal(calls,1);
    assert.equal(payloads[0].private_key,undefined);
  },{upstreamJson:async()=>{calls++;await new Promise(r=>setTimeout(r,20));return {...riskFixture,private_key:'not for response'};}});
});
test('risk provider failures use a geo fallback with unknown risk, never clean',async()=>withApp(async base=>{
  const response=await fetch(`${base}/api/lookup?ip=1.1.1.1`);const payload=await response.json();assert.equal(response.status,200);assert.equal(payload.source,'ipwho.is');assert.deepEqual(payload.flags,{});
},{upstreamJson:async url=>{if(url.includes('ipquery.io'))throw new Error('timeout');return {success:true,ip:'1.1.1.1',country:'Australia',connection:{isp:'Example'}};}}));
test('missing data sources return an error and never a fabricated risk profile',async()=>withApp(async base=>{
  const response=await fetch(`${base}/api/lookup?ip=1.1.1.1`);assert.equal(response.status,503);assert.ok((await response.json()).error);
},{upstreamJson:async()=>{throw new Error('network');}}));
test('a source returning the wrong IP cannot contaminate the requested risk profile',async()=>withApp(async base=>{
  const response=await fetch(`${base}/api/lookup?ip=1.1.1.1`);assert.equal(response.status,503);
},{upstreamJson:async url=>url.includes('ipquery.io') ? {...riskFixture,ip:'8.8.8.8'} : {success:true,ip:'8.8.8.8'}}));
test('speed tokens enforce exact byte budgets, single use and upload limits',async()=>withApp(async base=>{
  const forbidden=await fetch(`${base}/api/speed/download`);assert.equal(forbidden.status,403);
  const session=await fetch(`${base}/api/speed/session`,{method:'POST'}).then(r=>r.json());const headers={'X-Probe-Token':session.token};
  const down=await fetch(`${base}/api/speed/download`,{headers});assert.equal(down.headers.get('cache-control'),'no-store, no-transform');assert.equal((await down.arrayBuffer()).byteLength,4*1024*1024);
  const reused=await fetch(`${base}/api/speed/download`,{headers});assert.equal(reused.status,409);
  const upload=await fetch(`${base}/api/speed/upload`,{method:'POST',headers,body:Buffer.alloc(1024*1024)}).then(r=>r.json());assert.equal(upload.bytes,1024*1024);
  const second=await fetch(`${base}/api/speed/session`,{method:'POST'}).then(r=>r.json());
  const large=await fetch(`${base}/api/speed/upload`,{method:'POST',headers:{'X-Probe-Token':second.token},body:Buffer.alloc(1024*1024+1)});assert.equal(large.status,413);
}));
test('cross-site session creation and excessive lookup requests are rejected',async()=>withApp(async base=>{
  const cross=await fetch(`${base}/api/speed/session`,{method:'POST',headers:{'sec-fetch-site':'cross-site'}});assert.equal(cross.status,403);
  let last;
  for(let i=0;i<61;i++) last=await fetch(`${base}/api/lookup?ip=invalid`);
  assert.equal(last.status,429);assert.equal(last.headers.get('retry-after'),'60');
}));
