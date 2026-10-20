import {validIp,median} from './core.mjs';
import {deadline} from './probes.mjs';

function publicHost(host) {
  const name=host.replace(/^\[|\]$/g,'').toLowerCase();
  if(name==='localhost'||name.endsWith('.localhost')||name.endsWith('.local')||name.endsWith('.internal'))return false;
  if(validIp(name)) {
    if(name.includes(':'))return /^[23][\da-f]{3}:/.test(name)&&!name.startsWith('2001:db8:');
    const [a,b]=name.split('.').map(Number);
    return !(a===0||a===10||a===127||a>=224||(a===169&&b===254)||(a===192&&b===168)||(a===172&&b>=16&&b<=31)||(a===100&&b>=64&&b<=127));
  }
  return name.includes('.')&&name.length<=253&&name.split('.').every(part=>/^[a-z\d](?:[a-z\d-]{0,61}[a-z\d])?$/i.test(part));
}
export function normalizeWebsite(value) {
  if(typeof value!=='string'||value.length>2048)throw new Error('请输入有效的 HTTPS 网站地址');
  let url;try{url=new URL(value.includes('://')?value.trim():`https://${value.trim()}`);}catch{throw new Error('请输入有效的网站地址');}
  if(url.protocol!=='https:'||url.username||url.password||(url.port&&url.port!=='443')||!publicHost(url.hostname))throw new Error('请使用公网 HTTPS 网站，不包含账号密码或特殊端口');
  url.hash='';return url.href;
}
export function normalizeDomain(value) {
  const normalized=normalizeWebsite(value.trim().replace(/\.$/,''));const url=new URL(normalized);
  if(url.pathname!=='/'||url.search||validIp(url.hostname.replace(/^\[|\]$/g,'')))throw new Error('请输入域名，例如 example.com，不包含路径或 IP 地址');
  return url.hostname;
}
export const resolvers=[
 {id:'cloudflare',name:'Cloudflare',base:'https://cloudflare-dns.com/dns-query'},
 {id:'google',name:'Google',base:'https://dns.google/resolve'},
 {id:'alidns',name:'阿里 DNS',base:'https://dns.alidns.com/resolve'},
];
export async function resolveDns(resolver,name,type,signal,timeout=12000) {
  if(!['A','AAAA','CNAME','MX','TXT','NS'].includes(type))throw new Error('不支持的 DNS 记录类型');
  name=normalizeDomain(name);
  return deadline(signal,timeout,async ownSignal=>{
    const url=new URL(resolver.base);url.searchParams.set('name',name);url.searchParams.set('type',type);url.searchParams.set('edns_client_subnet','0.0.0.0/0');
    const started=performance.now();const response=await fetch(url,{headers:{accept:'application/dns-json'},credentials:'omit',cache:'no-store',signal:ownSignal});
    if(!response.ok)throw new Error(`解析服务返回 HTTP ${response.status}`);
    const data=await response.json();
    if(!Number.isInteger(data.Status))throw new Error('解析服务响应格式无效');
    const answers=(data.Answer||[]).filter(item=>typeof item.data==='string').slice(0,40).map(item=>({name:item.name,type:item.type,ttl:item.TTL,data:item.data.slice(0,2000)}));
    return {status:data.Status,answers,ms:performance.now()-started,dnssec:data.AD===true};
  });
}
export function connectionSummary(samples) {
  const values=samples.filter(sample=>Number.isFinite(sample.ms)).map(sample=>sample.ms),failed=samples.length-values.length;
  return {count:samples.length,success:values.length,failed,failedPercent:samples.length?failed/samples.length*100:null,min:values.length?Math.min(...values):null,max:values.length?Math.max(...values):null,median:median(values),jitter:values.length>1?values.slice(1).reduce((sum,value,index)=>sum+Math.abs(value-values[index]),0)/(values.length-1):null};
}
export function csvText(rows) {
  const cell=value=>{let text=String(value??'');if(/^[=+@\-\t\r]/.test(text))text=`'${text}`;return `"${text.replace(/"/g,'""')}"`;};
  return '\ufeff'+rows.map(row=>row.map(cell).join(',')).join('\r\n');
}
