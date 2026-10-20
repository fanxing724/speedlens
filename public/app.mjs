import { exitSources, services, groups } from './catalog.mjs';
import { validIp, canonicalIp, compareExits, riskFields, riskSummary, median, safeHistory } from './core.mjs';

const $ = id => document.getElementById(id);
const state = { busy:false, controller:null, sources:[], services:[], filter:'all', primary:null, info:null, report:null, context:null, lastStarted:null };
const HISTORY_KEY = 'speedlens.history.v1';
let history = [];
try { history = safeHistory(JSON.parse(localStorage.getItem(HISTORY_KEY) || '[]')); } catch { /* Storage may be blocked. */ }
try { document.documentElement.dataset.theme = localStorage.getItem('speedlens.theme') === 'light' ? 'light' : 'dark'; } catch { /* Use dark default. */ }

function element(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text != null) node.textContent = text;
  return node;
}
function toast(message) {
  $('toast').textContent = message;
  $('toast').hidden = false;
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => $('toast').hidden = true,4500);
}
function notice(message) { $('notice').textContent = message; $('notice').hidden = !message; }
function formatMs(value) { return Number.isFinite(value) ? `${Math.round(value)} ms` : '—'; }
function dateLabel(value) { return new Date(value).toLocaleString('zh-CN',{month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit'}); }
function errText(error) { return error?.name === 'TimeoutError' ? '请求超时' : error?.message || '请求未完成'; }

async function timed(signal, ms, task) {
  const controller = new AbortController();
  const stop = () => controller.abort(signal.reason);
  if (signal?.aborted) throw signal.reason;
  signal?.addEventListener('abort',stop,{once:true});
  const timer = setTimeout(()=>controller.abort(new DOMException('请求超时','TimeoutError')),ms);
  try { return await task(controller.signal); }
  finally { clearTimeout(timer); signal?.removeEventListener('abort',stop); }
}

async function requestJson(url, options = {}, signal, ms = 16000) {
  return timed(signal,ms,async ownSignal => {
    const response = await fetch(url,{cache:'no-store',credentials:'omit',...options,signal:ownSignal});
    let data;
    try { data = await response.json(); } catch { throw new Error('响应格式无效，请重试'); }
    if (!response.ok) throw new Error(data.error || `请求失败 (${response.status})`);
    return data;
  });
}

async function pool(items, concurrency, signal, task) {
  let index = 0;
  await Promise.all(Array.from({length:Math.min(concurrency,items.length)},async()=>{
    while (index < items.length && !signal.aborted) {
      const item = items[index++];
      await task(item);
    }
  }));
}

function resetSources() { state.sources = exitSources.map(source=>({ id:source.id,status:'idle' })); }
function resetServices() { state.services = services.map(service=>({ id:service.id,status:'idle' })); }

function renderSources() {
  $('source-grid').replaceChildren(...exitSources.map(source=>{
    const result = state.sources.find(x=>x.id===source.id) || {status:'idle'};
    const card = element('article','source-card');
    const top = element('div','source-top');
    top.append(element('span','source-name',source.name),element('span',`source-state ${result.status}`));
    const ip = result.ip || ({idle:'等待检测',running:'检测中…',failed:'未能获取',stopped:'已停止'}[result.status] || '—');
    const address = element(result.ip ? 'button' : 'div',`source-ip${result.ip ? ' text-button' : ''}`,ip);
    if (result.ip) { address.type='button'; address.title='查询此 IP 的风险'; address.disabled=state.busy; address.addEventListener('click',()=>{ $('lookup-ip').value=result.ip; start('risk',signal=>lookupRisk(result.ip,signal)); }); }
    card.append(top,element('div','source-host',source.host),address,element('div','source-location',result.location || result.error || (source.id==='ipv6' ? '观察 IPv6 是否有可用出口' : '等待第三方返回实际 IP')));
    const bottom = element('div','source-bottom');
    bottom.append(element('span','',source.family),element('span','',result.status==='done' ? formatMs(result.ms) : result.status==='running' ? '请求中' : '—'));
    card.append(bottom);
    return card;
  }));
  const verdict = compareExits(state.sources);
  $('routing-title').textContent=verdict.title;
  $('routing-detail').textContent=verdict.detail;
}

function updateHero() {
  const primary = ['cloudflare','ipv4','domestic','ipv6'].map(id=>state.sources.find(x=>x.id===id&&validIp(x.ip))).find(Boolean);
  state.primary=primary || null;
  $('copy-ip').disabled=!primary;
  if (!primary) {
    $('primary-ip').textContent='等待发现你的出口';
    $('primary-ip').classList.remove('ipv6');
    $('primary-location').textContent=state.busy ? '正在向不同检测点发起请求…' : '点击「开始全面检测」，从不同站点观察当前网络。';
    $('primary-source').textContent='—'; $('primary-isp').textContent='—'; $('exit-protocol').textContent='等待检测';
    return;
  }
  $('primary-ip').textContent=primary.ip;
  $('primary-ip').classList.toggle('ipv6',primary.ip.includes(':'));
  $('exit-protocol').textContent=primary.ip.includes(':') ? 'IPv6 出口' : 'IPv4 出口';
  $('primary-source').textContent=exitSources.find(x=>x.id===primary.id).name;
  const sameInfo=state.info && canonicalIp(state.info.ip)===canonicalIp(primary.ip);
  $('primary-location').textContent=sameInfo ? [state.info.country,state.info.region,state.info.city].filter(Boolean).join(' · ') || '归属地数据未知' : primary.location || '点击该 IP 可进一步查询归属地与风险';
  $('primary-isp').textContent=sameInfo ? [state.info.isp,state.info.asn && `AS${state.info.asn}`].filter(Boolean).join(' / ') || '未知' : '尚未查询';
}

function renderRisk(info = state.info) {
  const summary=riskSummary(info?.flags);
  $('risk-title').textContent=info ? summary.title : '等待风险数据';
  $('risk-title').className=`status-${summary.kind}`;
  $('risk-badge').textContent=info ? `${summary.known}/5 字段可用` : '未查询';
  $('risk-symbol').textContent=summary.kind==='flagged' ? '△' : summary.kind==='clear' ? '◇' : '◌';
  $('risk-symbol').className=`risk-symbol status-${summary.kind}`;
  $('risk-subtitle').textContent=info ? `查询目标 ${info.ip}` : '按数据源实际字段显示，不使用虚构分数。';
  $('risk-list').replaceChildren(...riskFields.map(([key,label])=>{
    const value=info?.flags?.[key];
    const row=element('div','risk-row');
    row.append(element('span','',label),element('span',typeof value!=='boolean' ? 'status-unknown' : value ? 'status-flagged' : 'status-clear',typeof value!=='boolean' ? '未知' : value ? '已标记' : '未标记'));
    return row;
  }));
  const source=$('risk-source');
  source.replaceChildren();
  if (info) {
    const link=element('a','',info.source);
    link.href=info.source==='IPQuery' ? 'https://ipquery.io/' : 'https://ipwhois.io/';
    link.target='_blank';link.rel='noopener noreferrer';
    source.append('来源：',link,` · ${dateLabel(info.checkedAt)}${info.cached ? ' · 缓存' : ''}`);
    if(Number.isFinite(info.riskScore)) source.append(element('div','',`IPQuery 风险分：${info.riskScore} / 100（越低表示其评估风险越少）`));
    if(info.notice) source.append(element('div','',info.notice));
  } else source.textContent='数据覆盖与结果受第三方数据库更新影响。';
}

function renderServices() {
  const filtered=services.filter(service=>state.filter==='all'||service.group===state.filter);
  $('service-grid').replaceChildren(...filtered.map(service=>{
    const result=state.services.find(x=>x.id===service.id) || {status:'idle'};
    const card=element('article','service-card');
    const mark=element('div','service-mark',service.mark);mark.style.color=service.color;mark.setAttribute('aria-hidden','true');
    const info=element('div','service-info');
    const link=element('a','service-name',service.name);link.href=`https://${service.domain}`;link.target='_blank';link.rel='noopener noreferrer';
    info.append(link,element('div','service-domain',service.domain));
    const status=element('div',`service-status ${result.status==='done' ? 'status-clear' : result.status==='failed' ? 'status-flagged' : ''}`);
    const label={idle:'等待检测',running:'请求中…',done:'已响应',failed:'未确认',stopped:'已停止'}[result.status];
    status.append(element('span',result.status==='running' ? 'loading' : '',label),element('small','',result.status==='done' ? `${Math.round(result.ms)} ms · 状态不可见` : result.status==='failed' ? '网络 / 浏览器策略' : 'HTTPS'));
    if(result.error) card.title=result.error;
    card.append(mark,info,status);
    return card;
  }));
  const responded=state.services.filter(x=>x.status==='done').length;
  const finished=state.services.filter(x=>['done','failed','stopped'].includes(x.status)).length;
  $('service-count').textContent=`${filtered.length} 个目标`;
  $('service-summary').textContent=finished||state.services.some(x=>x.status==='running') ? `${responded} 已响应 / ${finished} 已检测 / ${services.length} 总目标` : '尚未检测';
}

function renderHistory() {
  const container=$('history-list');
  if(!history.length) {
    const empty=element('div','empty-history');empty.append(element('span','','◷'),element('div','','还没有检测记录。完成一次全面检测，开始对照你的节点。'));container.replaceChildren(empty);
    $('clear-history').disabled=true;return;
  }
  $('clear-history').disabled=false;
  const head=element('div','history-row history-heading');['检测时间','节点备注','出口 IP','网站响应'].forEach(label=>head.append(element('span','',label)));
  container.replaceChildren(head,...history.map(item=>{
    const row=element('div','history-row');
    const address=element('span','');
    item.exits.slice(0,2).forEach(ip=>{address.append(element('small','',`${ip.name} · ${ip.ip}`));});
    if(!item.exits.length) address.textContent='未获得出口';
    row.append(element('span','',dateLabel(item.time)),element('span','',item.label||'未备注'),address,element('span','',`${item.responded} / ${item.total} 已响应`));return row;
  }));
}

const runButtons=['run-all','run-exits','run-services','lookup-submit','run-webrtc','run-speed'];
function setBusy(busy) {
  state.busy=busy;document.body.classList.toggle('running',busy);
  runButtons.forEach(id=>$(id).disabled=busy);
  $('stop-button').hidden=!busy;
  $('export-report').disabled=busy||!state.report;
  renderSources();
}

async function start(kind,task) {
  if(state.busy) return;
  const controller=new AbortController();state.controller=controller;notice('');setBusy(true);
  try { await task(controller.signal); }
  catch(error) {
    if(controller.signal.aborted) toast('已停止检测；未完成的全面检测不会写入历史。');
    else notice(errText(error));
  } finally {
    if(controller.signal.aborted) {
      for(const item of [...state.sources,...state.services]) if(item.status==='running') item.status='stopped';
    }
    state.controller=null;setBusy(false);renderServices();
    updateHero();
  }
}

async function detectExits(signal) {
  resetSources();state.info=null;renderRisk();renderSources();updateHero();
  await pool(exitSources,3,signal,async source=>{
    const result=state.sources.find(x=>x.id===source.id);result.status='running';renderSources();
    const started=performance.now();
    try {
      const data=await timed(signal,8000,async ownSignal=>{
        const url=new URL(source.url);url.searchParams.set('_sl',`${Date.now()}-${Math.random().toString(16).slice(2)}`);
        const response=await fetch(url,{signal:ownSignal,credentials:'omit',cache:'no-store',referrerPolicy:'no-referrer'});
        if(!response.ok) throw new Error(`检测点返回 ${response.status}`);
        return source.parse(source.text ? await response.text() : await response.json());
      });
      if(!validIp(data.ip)) throw new Error('检测点未返回有效 IP');
      Object.assign(result,{...data,ip:canonicalIp(data.ip),status:'done',ms:performance.now()-started});
    } catch(error) {Object.assign(result,{status:signal.aborted ? 'stopped' : 'failed',error:signal.aborted ? '已停止' : source.id==='ipv6' ? '无可用响应；不直接判定泄漏' : errText(error)});}
    renderSources();updateHero();
  });
  signal.throwIfAborted();
}

async function lookupRisk(ip,signal) {
  if(!validIp(ip)) throw new Error('请输入有效的公网 IPv4 或 IPv6 地址');
  state.info=null;renderRisk();updateHero();
  $('risk-title').textContent='正在查询风险数据…';$('risk-subtitle').textContent=`查询目标 ${ip}`;
  $('lookup-result').textContent=`正在查询 ${ip}…`;
  try {
    state.info=await requestJson(`/api/lookup?ip=${encodeURIComponent(ip)}`,{},signal);
    $('lookup-result').textContent=`${ip} · ${state.info.source} · 结果已更新至风险画像`;
    renderRisk();updateHero();
  } catch(error) {
    renderRisk();$('risk-title').textContent=signal.aborted ? '查询已停止' : '风险数据暂不可用';
    $('risk-subtitle').textContent=`查询目标 ${ip}`;
    $('lookup-result').textContent=signal.aborted ? '查询已停止' : errText(error);
    if(!signal.aborted) $('risk-source').textContent='没有查询到的数据保持未知，不作纯净判断。';
    throw error;
  }
}

async function detectServices(signal) {
  resetServices();renderServices();
  await pool(services,3,signal,async service=>{
    const result=state.services.find(x=>x.id===service.id);result.status='running';renderServices();
    const started=performance.now();
    try {
      await timed(signal,7000,async ownSignal=>{
        const url=new URL(`https://${service.domain}${service.path}`);url.searchParams.set('_sl',`${Date.now()}-${Math.random().toString(16).slice(2)}`);
        const response=await fetch(url,{signal:ownSignal,mode:'no-cors',credentials:'omit',cache:'no-store',referrerPolicy:'no-referrer'});
        if(response.type==='opaqueredirect'||response.type==='error') throw new Error('未获得可确认的网络响应');
        // Opaque responses conceal HTTP status. Never equate this with service unlock.
        if(response.body) await response.body.cancel();
      });
      Object.assign(result,{status:'done',ms:performance.now()-started});
    } catch(error) {Object.assign(result,{status:signal.aborted ? 'stopped' : 'failed',error:signal.aborted ? '已停止' : errText(error)});}
    renderServices();
  });
  signal.throwIfAborted();
}

async function runAll(signal) {
  state.report=null;resetServices();renderServices();state.lastStarted=new Date().toISOString();
  $('last-run').textContent='正在观察出口…';
  await detectExits(signal);
  $('last-run').textContent='正在检查服务与风险标记…';
  const riskTask=state.primary ? lookupRisk(state.primary.ip,signal).catch(error=>{if(signal.aborted)throw error;}) : Promise.resolve();
  await Promise.all([detectServices(signal),riskTask]);
  signal.throwIfAborted();
  const time=new Date().toISOString();
  const label=$('node-label').value.trim();
  state.report={ app:'SpeedLens',version:'1.0.0',time,startedAt:state.lastStarted,label, exits:structuredClone(state.sources),routing:compareExits(state.sources),risk:state.info,services:structuredClone(state.services),notes:['所有出口与网站连通性请求从浏览器发起。','网站已响应不代表账户可用、地区解锁或 HTTP 200。','风险字段来自第三方，未标记不代表保证纯净。','这是检测点采样，不能推断全部域名的实际出口。'] };
  const entry={time,label,exits:state.sources.filter(x=>validIp(x.ip)).map(x=>({name:exitSources.find(s=>s.id===x.id).name,ip:x.ip})),responded:state.services.filter(x=>x.status==='done').length,total:services.length};
  history=safeHistory([entry,...history]);
  try {localStorage.setItem(HISTORY_KEY,JSON.stringify(history));} catch {notice('检测已完成，但此浏览器不允许保存本地历史。仍可导出本次报告。');}
  renderHistory();$('last-run').textContent=`最近检测 ${dateLabel(time)}`;
  toast('全面检测完成，可备注节点后切换 VPN 进行对照。');
}

async function detectWebrtc(signal) {
  const output=$('webrtc-result');output.textContent='正在收集候选地址（最多 6 秒）…';
  if(!window.RTCPeerConnection) throw new Error('当前浏览器不支持 WebRTC 检测');
  const addresses=[];
  const pc=new RTCPeerConnection({iceServers:[{urls:'stun:stun.l.google.com:19302'}],iceCandidatePoolSize:0});
  try {
    await timed(signal,6500,async ownSignal=>new Promise((resolve,reject)=>{
      let done=false;
      const finish=()=>{if(done)return;done=true;clearTimeout(deadline);ownSignal.removeEventListener('abort',abort);resolve();};
      const abort=()=>{if(done)return;done=true;clearTimeout(deadline);ownSignal.removeEventListener('abort',abort);reject(ownSignal.reason);};
      const deadline=setTimeout(finish,5500);
      ownSignal.addEventListener('abort',abort,{once:true});
      pc.onicecandidate=event=>{
        if(!event.candidate) return finish();
        const fields=event.candidate.candidate.split(' ');
        const ip=fields[4],type=fields[7];
        if(ip&&!addresses.some(x=>x.ip===ip)) addresses.push({ip,type});
      };
      pc.createDataChannel('diagnostic');
      pc.createOffer().then(offer=>pc.setLocalDescription(offer)).catch(error=>{if(done)return;done=true;clearTimeout(deadline);ownSignal.removeEventListener('abort',abort);reject(error);});
    }));
    signal.throwIfAborted();
    output.replaceChildren();
    if(!addresses.length) {output.textContent='未收集到候选地址；可能被浏览器保护、VPN 或网络阻止，不等于无泄漏。';return;}
    const list=element('ul','');
    addresses.forEach(item=>list.append(element('li','',`${item.ip} · ${item.type==='srflx' ? 'STUN 观察地址' : item.ip.endsWith('.local') ? 'mDNS 本地别名' : '本地候选'}`)));
    output.append(list,element('p','','请与上方 HTTPS 出口对照；地址不同也可能来自双栈或路由差异。'));
  } catch(error) {output.textContent=signal.aborted ? '检测已停止' : errText(error);throw error;}
  finally {pc.close();}
}

async function detectSpeed(signal) {
  const output=$('speed-result');output.textContent='正在唤醒本站节点并测量延迟…';
  try {
    // The warm-up request is excluded from latency samples (Render free cold start).
    await timed(signal,60000,ownSignal=>fetch('/api/ping',{cache:'no-store',signal:ownSignal}));
    const samples=[];
    for(let i=0;i<5;i++) {
      const started=performance.now();
      await timed(signal,10000,ownSignal=>fetch(`/api/ping?t=${Math.random()}`,{cache:'no-store',signal:ownSignal}));
      samples.push(performance.now()-started);
    }
    const session=await requestJson('/api/speed/session',{method:'POST'},signal);
    const headers={'X-Probe-Token':session.token};
    output.textContent='正在下载 4 MiB 采样数据…';
    const downStart=performance.now();
    const bytes=await timed(signal,20000,async ownSignal=>{
      const response=await fetch('/api/speed/download',{headers,cache:'no-store',signal:ownSignal});
      if(!response.ok) throw new Error(`下载请求失败 (${response.status})`);
      return (await response.arrayBuffer()).byteLength;
    });
    const downMs=performance.now()-downStart;
    if(bytes!==session.downloadBytes) throw new Error('下载数据不完整');
    output.textContent='正在上传 1 MiB 采样数据…';
    const payload=new Uint8Array(session.uploadBytes);
    for(let i=0;i<payload.length;i+=65536) crypto.getRandomValues(payload.subarray(i,i+65536));
    const upStart=performance.now();
    const uploaded=await requestJson('/api/speed/upload',{method:'POST',headers:{...headers,'Content-Type':'application/octet-stream'},body:payload},signal,20000);
    const upMs=performance.now()-upStart;
    if(uploaded.bytes!==payload.length) throw new Error('服务器确认的上传大小不一致');
    output.textContent=`↓ ${(bytes*8/downMs/1000).toFixed(1)} Mbps　↑ ${(uploaded.bytes*8/upMs/1000).toFixed(1)} Mbps　HTTP ${formatMs(median(samples))}`;
    output.append(element('div','',`${downMs<1000||upMs<1000 ? '采样较短，仅供对照。' : ''}目标为本站节点；应用层吞吐，含请求开销。`));
  } catch(error) {output.textContent=signal.aborted ? '测速已停止' : errText(error);throw error;}
}

function exportReport() {
  if(!state.report)return;
  const blob=new Blob([JSON.stringify(state.report,null,2)],{type:'application/json;charset=utf-8'});
  const url=URL.createObjectURL(blob);const link=element('a','');
  link.href=url;link.download=`speedlens-${state.report.time.replace(/[:.]/g,'-')}.json`;link.click();setTimeout(()=>URL.revokeObjectURL(url),3000);
}

function updateOnline() {
  $('online-status').textContent=navigator.onLine ? '浏览器在线' : '浏览器离线';
  $('online-status').classList.toggle('offline',!navigator.onLine);
  const connection=navigator.connection?.effectiveType;
  $('browser-network').textContent=navigator.onLine ? connection ? `在线 / ${connection.toUpperCase()} 估计` : '在线' : '离线';
}
function updateThemeLabel() {
  const dark=document.documentElement.dataset.theme==='dark';
  $('theme-button').textContent=dark ? '☼' : '☾';
  $('theme-button').setAttribute('aria-label',dark ? '切换浅色主题' : '切换深色主题');
}

$('run-all').addEventListener('click',()=>start('all',runAll));
$('run-exits').addEventListener('click',()=>start('exits',async signal=>{await detectExits(signal);if(state.primary)await lookupRisk(state.primary.ip,signal);}));
$('run-services').addEventListener('click',()=>start('services',detectServices));
$('run-speed').addEventListener('click',()=>start('speed',detectSpeed));
$('run-webrtc').addEventListener('click',()=>start('webrtc',detectWebrtc));
$('stop-button').addEventListener('click',()=>{state.controller?.abort(new DOMException('用户停止检测','AbortError'));$('last-run').textContent='检测已停止';});
$('lookup-form').addEventListener('submit',event=>{event.preventDefault();start('risk',signal=>lookupRisk($('lookup-ip').value.trim(),signal));});
$('copy-ip').addEventListener('click',async()=>{if(!state.primary)return;try {await navigator.clipboard.writeText(state.primary.ip);toast('IP 已复制');}catch {toast('当前浏览器不允许复制，请选择 IP 文字手动复制。');}});
$('theme-button').addEventListener('click',()=>{document.documentElement.dataset.theme=document.documentElement.dataset.theme==='dark' ? 'light' : 'dark';updateThemeLabel();try {localStorage.setItem('speedlens.theme',document.documentElement.dataset.theme);}catch {}});
$('clear-history').addEventListener('click',()=>{history=[];try {localStorage.removeItem(HISTORY_KEY);renderHistory();toast('本机检测记录已清除。');}catch {renderHistory();notice('此浏览器不允许修改存储，记录可能在刷新后重新出现。');}});
$('export-report').addEventListener('click',exportReport);
$('node-label').addEventListener('input',()=>{
  if(state.busy||!state.report)return;
  const label=$('node-label').value.trim();
  state.report.label=label;
  const entry=history.find(item=>item.time===state.report.time);
  if(entry) {
    entry.label=label;
    try{localStorage.setItem(HISTORY_KEY,JSON.stringify(history));}catch{notice('备注已更新到本次报告，但浏览器不允许保存到历史。');}
    renderHistory();
  }
});
$('service-filters').replaceChildren(...Object.entries(groups).map(([key,label])=>{
  const button=element('button',`filter${key==='all' ? ' active' : ''}`,label);button.type='button';button.setAttribute('aria-pressed',String(key==='all'));
  button.addEventListener('click',()=>{state.filter=key;for(const item of $('service-filters').children){item.classList.toggle('active',item===button);item.setAttribute('aria-pressed',String(item===button));}renderServices();});
  return button;
}));
for(const link of document.querySelectorAll('.nav-link')) link.addEventListener('click',()=>{for(const item of document.querySelectorAll('.nav-link'))item.classList.toggle('active',item===link);});
if('IntersectionObserver' in window) {
  const observer=new IntersectionObserver(entries=>{for(const entry of entries)if(entry.isIntersecting)for(const link of document.querySelectorAll('.nav-link'))link.classList.toggle('active',link.hash===`#${entry.target.id}`);},{rootMargin:'-10% 0px -70% 0px'});
  document.querySelectorAll('main>section').forEach(section=>observer.observe(section));
}
window.addEventListener('online',updateOnline);window.addEventListener('offline',updateOnline);
window.addEventListener('pagehide',()=>state.controller?.abort());
updateOnline();updateThemeLabel();resetSources();resetServices();renderSources();renderServices();renderRisk();renderHistory();
// No third-party request is sent before the visitor starts a diagnostic.
requestJson('/api/context').then(context=>{state.context=context;$('node-description').textContent=`浏览器视角 · 辅助测速节点：${context.node}`;}).catch(()=>{});
