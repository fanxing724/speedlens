import {exitSources,services,groups,quickServices,splitTargets} from './catalog.mjs';
import {validIp,canonicalIp,riskFields,riskSummary,median,safeHistory,compareExits} from './core.mjs';
import {probeExit,maskIp,deadline,eachLimit} from './probes.mjs';
const $=id=>document.getElementById(id);
function readStorage(key,fallback){try{return JSON.parse(localStorage.getItem(key))??fallback;}catch{return fallback;}}
function store(key,value){try{localStorage.setItem(key,JSON.stringify(value));return true;}catch{return false;}}
const state={busy:false,controller:null,route:'network',hidden:readStorage('speedlens.privacy',true),auto:readStorage('speedlens.auto',true),sources:[],quick:[],sites:[],split:[],splitFilter:'all',serviceFilter:'all',networkDone:false,sitesDone:false,splitDone:false,modal:null,modalToken:0,report:null,dual:[]};
let history=safeHistory(readStorage('speedlens.history.v1',[]));
const infoCache=new Map();
const quickSamples=new Map();
const element=(tag,cls,text)=>{const node=document.createElement(tag);if(cls)node.className=cls;if(text!=null)node.textContent=text;return node;};
const formatMs=value=>Number.isFinite(value)?`${Math.round(value)} ms`:'—';
const dateLabel=value=>new Date(value).toLocaleString('zh-CN',{month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit'});
function errorText(error){if(error?.name==='TimeoutError')return '探针超时';if(error instanceof TypeError)return '跨域策略或网络未返回可读响应';return error?.message||'未获得可确认结果';}
function toast(text){$('toast').textContent=text;$('toast').hidden=false;clearTimeout(toast.timer);toast.timer=setTimeout(()=>$('toast').hidden=true,3800);}
function notice(text){$('notice').textContent=text;$('notice').hidden=!text;}
async function requestJson(url,options={},signal,ms=16000){return deadline(signal,ms,async ownSignal=>{const response=await fetch(url,{cache:'no-store',credentials:'omit',...options,signal:ownSignal});let data;try{data=await response.json();}catch{throw new Error('接口响应格式无效');}if(!response.ok)throw new Error(data.error||`HTTP ${response.status}`);return data;});}
const timed=deadline;
function waitFor(promise,signal){if(!signal)return promise;return new Promise((resolve,reject)=>{if(signal.aborted)return reject(signal.reason);const abort=()=>{signal.removeEventListener('abort',abort);reject(signal.reason);};signal.addEventListener('abort',abort,{once:true});Promise.resolve(promise).then(value=>{signal.removeEventListener('abort',abort);resolve(value);},error=>{signal.removeEventListener('abort',abort);reject(error);});});}
function infoFor(ip,signal){ip=canonicalIp(ip);if(!ip)return Promise.reject(new Error('请输入有效的公网 IP'));if(!infoCache.has(ip)){if(infoCache.size>=128)infoCache.delete(infoCache.keys().next().value);const promise=requestJson(`/api/lookup?ip=${encodeURIComponent(ip)}`).catch(error=>{infoCache.delete(ip);throw error;});infoCache.set(ip,promise);}return waitFor(infoCache.get(ip),signal);}
function reset(targets){return targets.map(target=>({id:target.id,status:'idle'}));}
state.sources=reset(exitSources);state.quick=reset(quickServices);state.sites=reset(services);state.split=reset(splitTargets);
function country(code){return /^[A-Z]{2}$/.test(code||'')?`${String.fromCodePoint(...[...code].map(char=>127397+char.charCodeAt(0)))} ${code}`:'—';}
function ipButton(ip){const button=element('button','ip-button',maskIp(ip,state.hidden));button.type='button';button.setAttribute('aria-label','查看此出口 IP 的归属与风险');button.addEventListener('click',()=>openIp(ip));return button;}
function place(info,fallback='归属地待查询'){if(!info)return fallback;if(state.hidden)return info.countryCode?country(info.countryCode):'归属地已隐藏';return [info.country,info.region,info.city].filter(Boolean).join(' · ')||'归属地未知';}
function renderSources(){
 $('source-grid').replaceChildren(...exitSources.map(target=>{const result=state.sources.find(item=>item.id===target.id);const card=element('article','source-card');const title=element('div','source-title');title.append(element('span',`dot ${result.status}`),element('strong','',target.name),element('small','',target.subtitle));const value=element('div','ip-value');if(result.ip)value.append(ipButton(result.ip));else value.textContent={idle:'等待检测',running:'检测中…',failed:'未确认',stopped:'已停止'}[result.status];card.append(title,value,element('div','source-place',result.ip?place(result.info,result.countryCode?country(result.countryCode):state.hidden?'归属信息已隐藏':result.location||'点击 IP 查询归属'):result.error||'—'),element('p','source-description',`· ${target.description}`),element('div','source-host',new URL(target.url).host));return card;}));
 const domestic=state.sources.find(x=>x.id==='domestic'),overseas=state.sources.find(x=>x.id==='cloudflare');
 const verdict=compareExits([{...domestic,id:'domestic'},{...overseas,id:'cloudflare'}]);
 $('network-verdict').textContent=verdict.kind==='unknown'?verdict.detail:`${verdict.title}。${verdict.detail}`;
}
function sparkline(values=[]){const svg=document.createElementNS('http://www.w3.org/2000/svg','svg');svg.setAttribute('viewBox','0 0 75 42');svg.setAttribute('class','sparkline');svg.setAttribute('aria-hidden','true');if(values.length<2)return svg;const maximum=Math.max(...values),minimum=Math.min(...values),range=Math.max(1,maximum-minimum);const path=document.createElementNS(svg.namespaceURI,'path');path.setAttribute('d',values.map((value,index)=>`${index?'L':'M'}${index*74/(values.length-1)} ${35-(value-minimum)/range*28}`).join(' '));path.setAttribute('fill','none');path.setAttribute('stroke','currentColor');path.setAttribute('stroke-width','2');svg.append(path);return svg;}
function renderQuick(){
 $('quick-grid').replaceChildren(...quickServices.map(target=>{const result=state.quick.find(item=>item.id===target.id);const card=element('article','quick-card');card.append(sparkline(quickSamples.get(target.id)));const mark=element('div','site-mark',target.mark);mark.style.color=target.color;const name=element('div','quick-name',target.name);name.append(element('small','',target.group==='local'?'国内':'国际'));const speed=element('div',`latency ${result.status==='done'?(result.ms<400?'fast':'slow'):'waiting'}`,result.status==='done'?String(Math.round(result.ms)):{idle:'待检测',running:'检测中',failed:'未确认',stopped:'已停止'}[result.status]);if(result.status==='done')speed.append(element('small','','ms'));card.append(mark,name,speed);if(result.error)card.title=result.error;return card;}));
}
function renderServices(){
 const filtered=services.filter(target=>state.serviceFilter==='all'||target.group===state.serviceFilter);
 $('service-grid').replaceChildren(...filtered.map(target=>{const result=state.sites.find(item=>item.id===target.id);const card=element('article','service-card');const mark=element('div','site-mark',target.mark);mark.style.color=target.color;const details=element('div','');const link=element('a','service-name',target.name);link.href=`https://${target.domain}`;link.target='_blank';link.rel='noopener noreferrer';details.append(link,element('div','service-domain',target.domain));const status=element('div',`service-status ${result.status==='done'?'success':''}`);status.append(element('span','',{idle:'待检测',running:'检测中…',done:'已响应',failed:'未确认',stopped:'已停止'}[result.status]),element('small','',result.status==='done'?`${formatMs(result.ms)} · 状态不可见`:'HTTPS'));card.append(mark,details,status);if(result.error)card.title=result.error;return card;}));
 const done=state.sites.filter(x=>x.status==='done').length,finished=state.sites.filter(x=>['done','failed','stopped'].includes(x.status)).length;$('service-summary').textContent=`${done} 已响应 / ${finished} 已检测 / ${services.length} 目标`;
}
function renderSplit(){
 const filtered=splitTargets.filter(target=>state.splitFilter==='all'||target.group===state.splitFilter);
 $('split-body').replaceChildren(...filtered.map(target=>{const result=state.split.find(item=>item.id===target.id);const row=element('tr','');const site=element('td','');const wrap=element('div','split-site');const mark=element('div','site-mark',target.name[0]);const names=element('div','');const name=element('strong','',target.name);name.append(element('span','category',target.group==='local'?'国内':target.group==='ai'?'AI':target.group==='dev'?'开发':'国际'));names.append(name,element('small','',new URL(target.url).host));wrap.append(mark,names);site.append(wrap);
 const nation=element('td','country',country(result.info?.countryCode||result.countryCode));const address=element('td','');if(result.ip){address.append(ipButton(result.ip),element('small','cell-note',formatMs(result.ms)));}else address.append(element('span',result.status==='running'?'pending':'unconfirmed',{idle:'待检测',running:'检测中…',failed:'未确认',stopped:'已停止'}[result.status]));
 const geo=element('td','');geo.append(element('span','',result.ip?place(result.info,result.geoStatus==='loading'?'查询中…':'归属地未知'):'—'));if(result.info?.isp)geo.append(element('small','cell-note',state.hidden?'网络信息已隐藏':result.info.isp));if(result.error)geo.append(element('small','cell-note',result.error));if(result.geoError)geo.append(element('small','cell-note','归属查询暂不可用，出口 IP 仍有效'));
 const asn=element('td','',result.info?.asn?state.hidden?'AS****':`AS${result.info.asn}`:'—');row.append(site,nation,address,geo,asn);return row;}));
 const valid=state.split.filter(x=>x.ip).length,finished=state.split.filter(x=>['done','failed','stopped'].includes(x.status)).length;$('split-summary').textContent=`${valid} 个可读出口 / ${finished} 已检测 / ${splitTargets.length} 目标`;
}
function renderHistory(){const host=$('history-list');$('clear-history').disabled=!history.length;if(!history.length){host.replaceChildren(element('div','empty','还没有完整检测记录。点击上方“全面检测”，保存本次节点对照。'));return;}const header=element('div','history-row history-head');['时间','节点备注','检测出口','服务响应'].forEach(text=>header.append(element('div','',text)));host.replaceChildren(header,...history.map(item=>{const row=element('div','history-row');const addresses=element('div','');item.exits.slice(0,3).forEach(exit=>addresses.append(element('small','',`${exit.name} · ${maskIp(exit.ip,state.hidden)}`)));if(!item.exits.length)addresses.textContent='无可读出口';row.append(element('div','',dateLabel(item.time)),element('div','',item.label||'未备注'),addresses,element('div','',`${item.responded} / ${item.total} 已响应`));return row;}));}
function renderDual(){const host=$('dual-result');if(!state.dual.length)return;host.replaceChildren(...state.dual.map(item=>{const row=element('div','');row.append(`${item.name}：`);if(item.ip)row.append(ipButton(item.ip));else row.append(item.error||'检测中…');return row;}));}
function renderAll(){renderSources();renderQuick();renderServices();renderSplit();renderHistory();renderDual();if(state.modal)renderDialog();}
function updateControls(){for(const id of ['run-all','run-network','run-split','run-services','run-dual','run-webrtc','run-speed'])$(id).disabled=state.busy;$('stop-button').hidden=!state.busy;$('export-report').disabled=state.busy||!state.report;}
async function start(label,task){if(state.busy)return;state.busy=true;state.controller=new AbortController();const signal=state.controller.signal;notice('');$('activity').textContent=label;updateControls();try{await task(signal);signal.throwIfAborted();$('activity').textContent=`最近完成 ${new Date().toLocaleTimeString('zh-CN',{hour:'2-digit',minute:'2-digit'})} · ${label}`;}catch(error){if(signal.aborted){$('activity').textContent='检测已停止';toast('已停止检测，未保存不完整记录。');}else{notice(errorText(error));$('activity').textContent='检测未完成，可重试';}}finally{for(const item of [...state.sources,...state.quick,...state.sites,...state.split])if(item.status==='running')item.status='stopped';state.busy=false;state.controller=null;updateControls();renderAll();maybeAuto();}}
async function runSources(signal){state.sources=reset(exitSources);renderSources();await eachLimit(exitSources,3,signal,async target=>{const result=state.sources.find(item=>item.id===target.id);result.status='running';renderSources();try{Object.assign(result,await probeExit(target,signal),{status:'done'});}catch(error){result.status=signal.aborted?'stopped':'failed';result.error=signal.aborted?'已停止':errorText(error);}renderSources();});signal.throwIfAborted();}
async function runReachability(targets,results,signal,render){await eachLimit(targets,3,signal,async target=>{const result=results.find(item=>item.id===target.id);result.status='running';render();const started=performance.now();try{await deadline(signal,7000,async ownSignal=>{const url=new URL(`https://${target.domain}${target.path}`);url.searchParams.set('_sl',`${Date.now()}-${Math.random().toString(16).slice(2)}`);const response=await fetch(url,{mode:'no-cors',cache:'no-store',credentials:'omit',referrerPolicy:'no-referrer',signal:ownSignal});if(response.type==='error'||response.type==='opaqueredirect')throw new Error('没有可确认的网络响应');if(response.body)await response.body.cancel();});result.status='done';result.ms=performance.now()-started;if(targets===quickServices){const samples=quickSamples.get(target.id)||[];quickSamples.set(target.id,[...samples,result.ms].slice(-6));}}catch(error){result.status=signal.aborted?'stopped':'failed';result.error=errorText(error);}render();});signal.throwIfAborted();}
async function runNetwork(signal){state.quick=reset(quickServices);renderQuick();await Promise.all([runSources(signal),runReachability(quickServices,state.quick,signal,renderQuick)]);state.networkDone=true;}
async function runServices(signal){state.sites=reset(services);renderServices();await runReachability(services,state.sites,signal,renderServices);state.sitesDone=true;}
async function runSplit(signal){state.split=reset(splitTargets);renderSplit();await eachLimit(splitTargets,3,signal,async target=>{const result=state.split.find(item=>item.id===target.id);result.status='running';renderSplit();try{Object.assign(result,await probeExit(target,signal),{status:'done',geoStatus:'loading'});renderSplit();try{result.info=await infoFor(result.ip,signal);result.geoStatus='done';}catch(error){if(signal.aborted)throw error;result.geoStatus='failed';result.geoError=errorText(error);}}catch(error){result.status=signal.aborted?'stopped':'failed';result.error=errorText(error);}renderSplit();});signal.throwIfAborted();state.splitDone=true;}
async function runAll(signal){state.report=null;updateControls();await runNetwork(signal);$('activity').textContent='正在读取各网站实际出口…';await runSplit(signal);$('activity').textContent='正在检查网站服务…';await runServices(signal);signal.throwIfAborted();const time=new Date().toISOString(),label=$('node-label').value.trim();state.report={app:'SpeedLens',version:'1.1.0',time,label,exits:structuredClone(state.sources),split:structuredClone(state.split),services:structuredClone(state.sites),notes:['出口请求由浏览器发起；探针域名可能与主站规则不同。','可读出口不是账号可用或地区解锁证明。','导出包含真实 IP，隐私开关仅影响页面显示。']};history=safeHistory([{time,label,exits:state.sources.filter(x=>x.ip).map(x=>({name:exitSources.find(target=>target.id===x.id).name,ip:x.ip})),responded:state.sites.filter(x=>x.status==='done').length,total:services.length},...history]);if(!store('speedlens.history.v1',history))notice('检测完成，但浏览器不允许保存历史；仍可导出本次报告。');renderHistory();toast('全面检测完成，记录已保存到本机。');}
function renderDialog(){const modal=state.modal;if(!modal)return;const host=$('ip-dialog-body');host.replaceChildren(element('div','modal-ip',maskIp(modal.ip,state.hidden)));const copy=element('button','button secondary','复制真实 IP');copy.addEventListener('click',()=>copyText(modal.ip));const tail=element('div','modal-actions');tail.append(element('span','','IP 风险信息来自第三方，不保证服务解锁或原生住宅。'),copy);if(modal.status==='loading'){host.append(element('p','modal-source loading','正在查询 IPQuery…'),tail);return;}if(modal.error){host.append(element('p','notice',modal.error),element('p','footnote','没有数据的字段保持未知，不作纯净判断。'),tail);return;}const data=modal.data;host.append(element('p','modal-source',`来源 ${data.source} · ${dateLabel(data.checkedAt)}${data.cached?' · 缓存':''}`));const grid=element('div','detail-grid');for(const [label,value]of [['归属地',place(data)],['网络 / ISP',state.hidden?'已隐藏':data.isp||'未知'],['ASN',data.asn?(state.hidden?'AS****':`AS${data.asn}`):'未知'],['时区',state.hidden?'已隐藏':data.timezone||'未知']]){const item=element('div','');item.append(element('span','',label),element('strong','',value));grid.append(item);}host.append(grid);const summary=riskSummary(data.flags);host.append(element('h3',`risk-heading ${summary.kind==='flagged'?'flagged':summary.kind==='clear'?'success':''}`,summary.title));if(Number.isFinite(data.riskScore)){host.append(element('div','risk-score',`IPQuery 风险分：${data.riskScore} / 100 · 越低表示其评估风险越少`));const meter=element('div','risk-meter');const bar=element('div','');bar.style.width=`${data.riskScore}%`;meter.append(bar);host.append(meter);}const risks=element('div','risk-grid');for(const[key,label]of riskFields){const value=data.flags?.[key],row=element('div','risk-row');row.append(element('span','',label),element('span',typeof value!=='boolean'?'muted':value?'flagged':'success',typeof value!=='boolean'?'未知':value?'已标记':'未标记'));risks.append(row);}host.append(risks,element('p','footnote',data.notice||'数据库未标记，不代表没有风险。'),tail);}
async function openIp(ip){if(!validIp(ip)){notice('请输入有效的公网 IPv4 或 IPv6 地址');return;}const token=++state.modalToken;state.modal={ip,status:'loading'};renderDialog();if(!$('ip-dialog').open)$('ip-dialog').showModal();try{const data=await infoFor(ip);if(token!==state.modalToken)return;state.modal={ip,status:'done',data};for(const result of [...state.sources,...state.split])if(canonicalIp(result.ip)===canonicalIp(ip))result.info=data;renderAll();}catch(error){if(token!==state.modalToken)return;state.modal={ip,status:'failed',error:errorText(error)};renderDialog();}}
function closeDialog(){$('ip-dialog').close();state.modal=null;state.modalToken++;}
async function copyText(text){try{await navigator.clipboard.writeText(text);toast('真实 IP 已复制');}catch{toast('浏览器不允许自动复制，请关闭脱敏后手动选择。');}}
async function runDual(signal){const targets=[{id:'v4',name:'IPv4',url:'https://api.ipify.org?format=json',probe:'json'},{id:'v6',name:'IPv6',url:'https://api6.ipify.org?format=json',probe:'json'}];state.dual=targets.map(x=>({id:x.id,name:x.name}));renderDual();await eachLimit(targets,2,signal,async target=>{const item=state.dual.find(x=>x.id===target.id);try{Object.assign(item,await probeExit(target,signal));}catch(error){item.error=signal.aborted?'已停止':'未确认：未启用、网络或检测点限制均有可能';}renderDual();});signal.throwIfAborted();}

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

function exportReport(){if(!state.report)return;const blob=new Blob([JSON.stringify(state.report,null,2)],{type:'application/json;charset=utf-8'});const url=URL.createObjectURL(blob),link=element('a','');link.href=url;link.download=`speedlens-${state.report.time.replace(/[:.]/g,'-')}.json`;link.click();setTimeout(()=>URL.revokeObjectURL(url),3000);}
function setFilters(id,values,getValue,setValue,render){$(id).replaceChildren(...Object.entries(values).map(([key,label])=>{const button=element('button',`filter ${getValue()===key?'active':''}`,label);button.setAttribute('aria-pressed',String(getValue()===key));button.addEventListener('click',()=>{setValue(key);setFilters(id,values,getValue,setValue,render);render();});return button;}));}
function updatePreferences(){document.documentElement.dataset.theme=readStorage('speedlens.theme','light')==='dark'?'dark':'light';const dark=document.documentElement.dataset.theme==='dark';$('theme-button').textContent=dark?'☼':'☾';$('theme-button').setAttribute('aria-label',dark?'切换浅色主题':'切换深色主题');$('privacy-button').textContent=state.hidden?'◌':'◉';$('privacy-button').setAttribute('aria-label',state.hidden?'显示完整 IP':'隐藏完整 IP');$('privacy-button').setAttribute('aria-pressed',String(!state.hidden));$('auto-check').checked=state.auto;}
function maybeAuto(){if(!state.auto||state.busy||document.hidden)return;if(state.route==='network'&&!state.networkDone)start('首页网络检测',runNetwork);if(state.route==='split'&&!state.splitDone)start('网站分流检测',runSplit);if(state.route==='services'&&!state.sitesDone)start('网站服务检测',runServices);}
function route(){const requested=location.hash.replace(/^#\//,'');state.route=['network','split','services','tools','history'].includes(requested)?requested:'network';for(const id of ['network','split','services','tools','history'])$(`page-${id}`).hidden=id!==state.route;for(const link of document.querySelectorAll('[data-route]')){const active=link.dataset.route===state.route;link.classList.toggle('active',active);if(active)link.setAttribute('aria-current','page');else link.removeAttribute('aria-current');}document.title=`${{network:'网络状态',split:'分流测试',services:'网站服务',tools:'检测工具',history:'检测记录'}[state.route]} · SpeedLens`;maybeAuto();}
$('run-all').addEventListener('click',()=>start('全面检测',runAll));$('run-network').addEventListener('click',()=>start('首页网络检测',runNetwork));$('run-split').addEventListener('click',()=>start('网站分流检测',runSplit));$('run-services').addEventListener('click',()=>start('网站服务检测',runServices));$('run-dual').addEventListener('click',()=>start('双栈出口检测',runDual));$('run-webrtc').addEventListener('click',()=>start('WebRTC 检测',detectWebrtc));$('run-speed').addEventListener('click',()=>start('轻量测速',detectSpeed));
$('stop-button').addEventListener('click',()=>{state.auto=false;store('speedlens.auto',false);$('auto-check').checked=false;state.controller?.abort(new DOMException('用户停止检测','AbortError'));});
$('lookup-form').addEventListener('submit',event=>{event.preventDefault();openIp($('lookup-ip').value.trim());});$('close-dialog').addEventListener('click',closeDialog);$('ip-dialog').addEventListener('cancel',()=>{state.modal=null;state.modalToken++;});$('ip-dialog').addEventListener('click',event=>{if(event.target===$('ip-dialog')){const rect=$('ip-dialog').getBoundingClientRect();if(event.clientX<rect.left||event.clientX>rect.right||event.clientY<rect.top||event.clientY>rect.bottom)closeDialog();}});
$('privacy-button').addEventListener('click',()=>{state.hidden=!state.hidden;store('speedlens.privacy',state.hidden);updatePreferences();renderAll();});$('theme-button').addEventListener('click',()=>{store('speedlens.theme',document.documentElement.dataset.theme==='dark'?'light':'dark');updatePreferences();});$('auto-check').addEventListener('change',()=>{state.auto=$('auto-check').checked;store('speedlens.auto',state.auto);maybeAuto();});
$('clear-history').addEventListener('click',()=>{history=[];if(!store('speedlens.history.v1',[]))notice('浏览器不允许修改存储，刷新后可能重新出现旧记录。');renderHistory();});$('export-report').addEventListener('click',exportReport);$('node-label').addEventListener('input',()=>{if(state.busy||!state.report)return;state.report.label=$('node-label').value.trim();const item=history.find(x=>x.time===state.report.time);if(item){item.label=state.report.label;store('speedlens.history.v1',history);renderHistory();}});
setFilters('split-filters',{all:'全部',local:'国内',global:'国际',ai:'AI 服务',dev:'开发与 CDN'},()=>state.splitFilter,value=>state.splitFilter=value,renderSplit);setFilters('service-filters',groups,()=>state.serviceFilter,value=>state.serviceFilter=value,renderServices);
window.addEventListener('hashchange',route);window.addEventListener('pagehide',()=>state.controller?.abort());document.addEventListener('visibilitychange',()=>{if(!document.hidden)maybeAuto();});window.addEventListener('offline',()=>notice('浏览器已离线，检测结果可能无法更新。'));window.addEventListener('online',()=>notice(''));
updatePreferences();renderAll();updateControls();$('activity').textContent=state.auto?'进入页面自动检测 · 无持续轮询':'自动检测已关闭 · 可手动开始';route();
