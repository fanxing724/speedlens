import { canonicalIp, validIp } from './core.mjs';

export function parseTrace(text) {
  const pairs=String(text).split(/\r?\n/).map(line=>{const i=line.indexOf('=');return i<0 ? [] : [line.slice(0,i),line.slice(i+1)];});
  const data=Object.fromEntries(pairs.filter(pair=>pair.length===2));
  if(!validIp(data.ip)) throw new Error('探针没有返回有效出口 IP');
  return {ip:canonicalIp(data.ip),countryCode:/^[A-Z]{2}$/.test(data.loc||'') ? data.loc : null,colo:data.colo||null};
}

export function parseHeaderIp(headers) {
  for(const key of ['x-request-ip','x-response-cinfo','cdn-user-ip']) {
    const value=headers.get(key)||'';
    if(validIp(value.trim()))return canonicalIp(value.trim());
    for(const token of value.match(/[\da-fA-F:.]+/g)||[])if(validIp(token))return canonicalIp(token);
  }
  throw new Error('浏览器无法读取出口 IP 响应头');
}

export function maskIp(ip,hidden=true) {
  if(!validIp(ip))return '—';
  if(!hidden)return ip;
  if(ip.includes(':'))return `${canonicalIp(ip).split(':').slice(0,2).join(':')}:****:****`;
  return ip.split('.').map((part,i)=>i===0 ? part : '*'.repeat(part.length)).join('.');
}

export async function deadline(signal,ms,task) {
  const controller=new AbortController();
  const abort=()=>controller.abort(signal.reason);
  if(signal?.aborted)throw signal.reason;
  signal?.addEventListener('abort',abort,{once:true});
  const timer=setTimeout(()=>controller.abort(new DOMException('探针超时','TimeoutError')),ms);
  try{return await task(controller.signal);}finally{clearTimeout(timer);signal?.removeEventListener('abort',abort);}
}

export async function probeExit(target,signal) {
  return deadline(signal,7000,async ownSignal=>{
    const url=new URL(target.url);url.searchParams.set('_sl',`${Date.now()}-${Math.random().toString(16).slice(2)}`);
    const started=performance.now();
    const response=await fetch(url,{method:target.method||'GET',signal:ownSignal,cache:'no-store',credentials:'omit',referrerPolicy:'no-referrer'});
    if(!response.ok)throw new Error(`探针返回 HTTP ${response.status}`);
    let data;
    if(target.probe==='header') {
      data={ip:parseHeaderIp(response.headers)};
      if(response.body)await response.body.cancel();
    } else if(target.probe==='json') {
      const body=await response.json();
      const ip=target.id==='domestic' ? body.data?.ip : body.ip;
      if(!validIp(ip))throw new Error('探针没有返回有效出口 IP');
      data={ip:canonicalIp(ip),location:target.id==='domestic'&&Array.isArray(body.data?.location) ? body.data.location.join(' · ') : null};
    } else data=parseTrace(await response.text());
    return {...data,ms:performance.now()-started,host:url.host};
  });
}

export async function eachLimit(items,concurrency,signal,task) {
  let cursor=0;
  await Promise.all(Array.from({length:Math.min(concurrency,items.length)},async()=>{
    while(cursor<items.length&&!signal.aborted)await task(items[cursor++]);
  }));
}
