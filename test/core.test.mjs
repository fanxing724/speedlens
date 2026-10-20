import test from 'node:test';
import assert from 'node:assert/strict';
import { validIp, canonicalIp, compareExits, riskSummary, median, safeHistory } from '../public/core.mjs';

test('IP parser accepts IPv4/IPv6 and rejects addresses that can become HTML or URLs',()=>{
  for(const ip of ['1.1.1.1','8.8.8.8','2606:4700:4700::1111','::1']) assert.equal(validIp(ip),true,ip);
  for(const ip of ['','999.1.1.1','1.2.3','01.2.3.4','https://1.1.1.1','<img>','fe80::1%eth0','1:2:3:4:5:6:7:8:9']) assert.equal(validIp(ip),false,ip);
});
test('equivalent IPv6 addresses compare in canonical form',()=>{
  assert.equal(canonicalIp('2606:4700:4700:0000:0000:0000:0000:1111'),'2606:4700:4700::1111');
  assert.equal(compareExits([{id:'domestic',ip:'2606:4700:4700:0:0:0:0:1111'},{id:'cloudflare',ip:'2606:4700:4700::1111'}]).kind,'same');
});
test('routing needs real observations from both vantage points',()=>{
  assert.equal(compareExits([]).kind,'unknown');
  assert.equal(compareExits([{id:'domestic',ip:'1.1.1.1'}]).kind,'unknown');
  assert.equal(compareExits([{id:'domestic',ip:'1.1.1.1'},{id:'cloudflare',ip:'8.8.8.8'}]).kind,'different');
  assert.equal(compareExits([{id:'domestic',ip:'1.1.1.1'},{id:'cloudflare',ip:'2606:4700:4700::1111'}]).kind,'unknown');
});
test('a replacement domestic probe cannot establish domestic routing evidence',()=>{
  const result=compareExits([{id:'domestic',ip:'1.1.1.1',viaFallback:true,host:'perfops.cloudflareperf.com'},{id:'cloudflare',ip:'8.8.8.8'}]);
  assert.equal(result.kind,'unknown');
});
test('missing risk data never means clean; string values never become flags',()=>{
  assert.equal(riskSummary().kind,'unknown');
  assert.equal(riskSummary({is_vpn:false}).kind,'unknown');
  assert.equal(riskSummary({is_vpn:'false',is_proxy:'false'}).known,0);
  assert.equal(riskSummary({is_vpn:true}).kind,'flagged');
  assert.equal(riskSummary({is_vpn:false,is_proxy:false,is_tor:false,is_datacenter:false,is_abuser:false}).kind,'clear');
});
test('median and stored history handle empty, malformed and excessive values',()=>{
  assert.equal(median([]),null);assert.equal(median([9,1,3]),3);assert.equal(median([10,2]),6);
  const entry={time:new Date().toISOString(),label:'香港节点',exits:[{name:'Cloudflare',ip:'1.1.1.1'}],responded:12,total:18};
  assert.equal(safeHistory([entry,null,{...entry,responded:20},{...entry,exits:[{name:'bad',ip:'<img>'}]}]).length,1);
  assert.equal(safeHistory(Array(30).fill(entry)).length,20);assert.deepEqual(safeHistory({}),[]);
  assert.deepEqual(safeHistory([{...entry,exits:[null]}, {...entry,exits:[undefined]}]),[]);
});
