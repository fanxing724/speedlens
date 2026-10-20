import {normalizeWebsite,normalizeDomain,resolvers,resolveDns,connectionSummary,csvText} from './diagnostics.mjs';
import {exitSources,services,groups,quickServices,splitTargets} from './catalog.mjs';
import {validIp,canonicalIp,riskFields,riskSummary,median,safeHistory,compareExits} from './core.mjs';
import {probeExit,probeConnection,maskIp,deadline,eachLimit} from './probes.mjs';
const $=id=>document.getElementById(id);
function readStorage(key,fallback){try{return JSON.parse(localStorage.getItem(key))??fallback;}catch{return fallback;}}
function store(key,value){try{localStorage.setItem(key,JSON.stringify(value));return true;}catch{return false;}}
const state={busy:false,controller:null,route:'network',hidden:readStorage('speedlens.privacy',true),auto:readStorage('speedlens.auto',true),slow:readStorage('speedlens.slow',false),sources:[],quick:[],sites:[],split:[],splitFilter:'all',serviceFilter:'all',networkDone:false,sitesDone:false,splitDone:false,modal:null,modalToken:0,report:null,dual:[],webrtc:[]};
let history=safeHistory(readStorage('speedlens.history.v1',[]));
const infoCache=new Map();
const quickSamples=new Map();
const element=(tag,cls,text)=>{const node=document.createElement(tag);if(cls)node.className=cls;if(text!=null)node.textContent=text;return node;};
const iconPaths={"lens":["M21 21l-4.3-4.3","M19 10.5a8.5 8.5 0 1 1-17 0 8.5 8.5 0 0 1 17 0Z","M14 10.5a3.5 3.5 0 1 1-7 0 3.5 3.5 0 0 1 7 0Z"],"globe":["M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z","M3 12h18","M12 3c5 5 5 13 0 18-5-5-5-13 0-18Z"],"route":["M6 3v12a4 4 0 0 0 4 4h8","M15 16l3 3-3 3","M6 7h8a4 4 0 0 0 4-4","M3 3h6"],"grid":["M3 3h7v7H3z","M14 3h7v7h-7z","M3 14h7v7H3z","M14 14h7v7h-7z"],"sliders":["M4 6h4m4 0h8M4 18h8m4 0h4","M8 3v6m4 6v6"],"clock":["M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z","M12 7v5l3 2"],"eye":["M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z","M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z"],"eye-off":["M3 3l18 18","M10.6 5.1 12 5c6.5 0 10 7 10 7a18 18 0 0 1-3.1 3.8M6.3 6.3A20 20 0 0 0 2 12s3.5 7 10 7a13 13 0 0 0 5.7-1.3","M9.9 9.9a3 3 0 0 0 4.2 4.2"],"moon":["M21 13a9 9 0 1 1-10-10 7 7 0 0 0 10 10Z"],"sun":["M16 12a4 4 0 1 1-8 0 4 4 0 0 1 8 0Z","M12 2v2m0 16v2M2 12h2m16 0h2M5 5l1.5 1.5m11 11L19 19M5 19l1.5-1.5m11-11L19 5"],"arrow":["M5 12h14m-6-6 6 6-6 6"],"arrow-up":["M6 18 18 6M6 6h12v12"],"refresh":["M20 7v5h-5","M4 17v-5h5","M19 7a8 8 0 0 0-13-2L4 7m16 10-2 2A8 8 0 0 1 5 17"],"cloud":["M7 18H6a4 4 0 0 1-.5-8A6.5 6.5 0 0 1 18 9a4.5 4.5 0 0 1 0 9H7Z"],"home":["M3 10 12 3l9 7v10H3V10Z","M9 20v-7h6v7"],"shield":["M12 3 4 6v6c0 5 8 9 8 9s8-4 8-9V6l-8-3Z","M9 12l2 2 4-4"],"check":["M5 12l4 4L19 6"],"close":["M6 6l12 12M6 18 18 6"],"copy":["M9 9h11v12H9z","M15 9V3H3v12h6"],"play":["M4 5h16v14H4z","m10 9 5 3-5 3V9Z"],"bolt":["m13 2-9 12h7l-1 8 10-12h-7l1-8Z"],"wave":["M2 12h4l3-8 6 16 3-8h4"],"search":["M16 10a6 6 0 1 1-12 0 6 6 0 0 1 12 0Z","m14.5 14.5 5 5"],"download":["M12 3v12m-5-5 5 5 5-5","M4 17v4h16v-4"]};
function icon(name){const svg=document.createElementNS('http://www.w3.org/2000/svg','svg');svg.setAttribute('class','icon');svg.setAttribute('viewBox','0 0 24 24');svg.setAttribute('fill','none');svg.setAttribute('stroke','currentColor');svg.setAttribute('stroke-width','1.65');svg.setAttribute('stroke-linecap','round');svg.setAttribute('stroke-linejoin','round');svg.setAttribute('aria-hidden','true');for(const d of iconPaths[name]||iconPaths.globe){const path=document.createElementNS(svg.namespaceURI,'path');path.setAttribute('d',d);svg.append(path);}return svg;}
function siteMark(target){const mark=element('div','site-mark');mark.style.color=target.color||'var(--muted)';const marks={github:'GH',bilibili:'哔',bytedance:'字',wechat:'微',taobao:'淘',jsdelivr:'JS',chatgpt:'AI',claude:'C',gemini:'G',npm:'npm',netflix:'N',spotify:'S',wikipedia:'W',google:'G',x:'X'};if(target.id==='youtube')mark.append(icon('play'));else if(target.id==='cloudflare')mark.append(icon('cloud'));else mark.textContent=marks[target.id]||target.name.slice(0,2);return mark;}
const formatMs=value=>Number.isFinite(value)?`${Math.round(value)} ms`:'—';
const dateLabel=value=>new Date(value).toLocaleString('zh-CN',{month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit'});
function errorText(error){if(error?.name==='TimeoutError')return error.message||'连接超时';if(error instanceof TypeError)return '跨域策略或网络未返回可读响应';return error?.message||'未获得可确认结果';}
function toast(text){$('toast').textContent=text;$('toast').hidden=false;clearTimeout(toast.timer);toast.timer=setTimeout(()=>$('toast').hidden=true,3800);}
function notice(text){$('notice').textContent=text;$('notice').hidden=!text;}
async function requestJson(url,options={},signal,ms=16000){return deadline(signal,ms,async ownSignal=>{const response=await fetch(url,{cache:'no-store',credentials:'omit',...options,signal:ownSignal});let data;try{data=await response.json();}catch{throw new Error('接口响应格式无效');}if(!response.ok)throw new Error(data.error||`HTTP ${response.status}`);return data;});}
const timed=deadline;
function waitFor(promise,signal){if(!signal)return promise;return new Promise((resolve,reject)=>{if(signal.aborted)return reject(signal.reason);const abort=()=>{signal.removeEventListener('abort',abort);reject(signal.reason);};signal.addEventListener('abort',abort,{once:true});Promise.resolve(promise).then(value=>{signal.removeEventListener('abort',abort);resolve(value);},error=>{signal.removeEventListener('abort',abort);reject(error);});});}
function infoFor(ip,signal){
 ip=canonicalIp(ip);if(!ip)return Promise.reject(new Error('请输入有效的公网 IP'));
 let entry=infoCache.get(ip);
 if(!entry||entry.until<=Date.now()){
  if(infoCache.size>=128)infoCache.delete(infoCache.keys().next().value);
  entry={until:Infinity};
  entry.promise=requestJson(`/api/lookup?ip=${encodeURIComponent(ip)}`).then(data=>{
   const checkedAt=Date.parse(data.checkedAt);
   entry.until=Math.min(Date.now()+15*60_000,Number.isFinite(checkedAt)?checkedAt+15*60_000:Infinity);
   return data;
  }).catch(error=>{if(infoCache.get(ip)===entry)infoCache.delete(ip);throw error;});
  infoCache.set(ip,entry);
 }
 return waitFor(entry.promise,signal);
}
function reset(targets){return targets.map(target=>({id:target.id,status:'idle'}));}
state.sources=reset(exitSources);state.quick=reset(quickServices);state.sites=reset(services);state.split=reset(splitTargets);
function country(code){return /^[A-Z]{2}$/.test(code||'')?`${String.fromCodePoint(...[...code].map(char=>127397+char.charCodeAt(0)))} ${code}`:'—';}
function ipButton(ip){const button=element('button','ip-button',maskIp(ip,state.hidden));button.type='button';button.setAttribute('aria-label','查看此出口 IP 的归属与风险');button.addEventListener('click',()=>openIp(ip));return button;}
function place(info,fallback='归属地待查询'){if(!info)return fallback;if(state.hidden)return info.countryCode?country(info.countryCode):'归属地已隐藏';return [info.country,info.region,info.city].filter(Boolean).join(' · ')||'归属地未知';}
function renderSources(){
 $('source-grid').replaceChildren(...exitSources.map(target=>{
  const result=state.sources.find(item=>item.id===target.id);
  const card=element('article','source-card');card.dataset.state=result.status;
  const title=element('div','source-title'),mark=element('span','source-icon');
  mark.append(icon({domestic:'home',international:'globe',cloudflare:'cloud',x:'arrow-up'}[target.id]));
  const names=element('div','source-names');names.append(element('strong','',target.id==='domestic'&&result.viaFallback?'备用出口观测':target.name),element('small','',result.redirected?'请求已跳转':result.viaFallback?'备用检测点':target.subtitle));
  const status=element('span','source-state');status.append(element('span',`dot ${result.status}`),element('span','',{idle:'待检测',running:'检测中',done:'已获取',failed:'未确认',stopped:'已停止'}[result.status]));
  title.append(mark,names,status);
  const value=element('div','ip-value');if(result.ip)value.append(ipButton(result.ip));else value.append(element('span',result.status==='running'?'loading':'',result.status==='idle'?'等待检测':{running:'正在观察出口…',failed:'暂未获得出口',stopped:'本次检测已停止'}[result.status]));
  const details=element('div','source-place',result.ip?place(result.info,result.countryCode?country(result.countryCode):state.hidden?'归属信息已隐藏':result.location||'点击 IP 查询归属'):result.error||'开始后显示真实检测结果');
  const foot=element('div','source-foot');foot.append(element('div','source-host',result.host||new URL(target.url).host),element('span','source-family',result.ip?(result.ip.includes(':')?'IPv6':'IPv4'):target.id==='international'?'IPv4':target.id==='cloudflare'?'双栈':'HTTPS'));
  card.append(title,value,details,element('p','source-description',result.viaFallback?'访问所列备用站时的出口；不代表原检测点。':target.description),foot);return card;
 }));
 const domestic=state.sources.find(x=>x.id==='domestic'),overseas=state.sources.find(x=>x.id==='cloudflare');
 const verdict=compareExits([{...domestic,id:'domestic'},{...overseas,id:'cloudflare'}]);
 $('network-verdict').replaceChildren(icon('route'),element('span','',verdict.kind==='unknown'?verdict.detail:`${verdict.title}。${verdict.detail}`));
}

function sparkline(values=[]){const svg=document.createElementNS('http://www.w3.org/2000/svg','svg');svg.setAttribute('viewBox','0 0 75 42');svg.setAttribute('class','sparkline');svg.setAttribute('aria-hidden','true');if(values.length<2)return svg;const maximum=Math.max(...values),minimum=Math.min(...values),range=Math.max(1,maximum-minimum);const path=document.createElementNS(svg.namespaceURI,'path');path.setAttribute('d',values.map((value,index)=>`${index?'L':'M'}${index*74/(values.length-1)} ${35-(value-minimum)/range*28}`).join(' '));path.setAttribute('fill','none');path.setAttribute('stroke','currentColor');path.setAttribute('stroke-width','2');svg.append(path);return svg;}
function renderQuick(){
 $('quick-grid').replaceChildren(...quickServices.map(target=>{
  const result=state.quick.find(item=>item.id===target.id),card=element('article','quick-card');card.dataset.state=result.status;
  const top=element('div','quick-top');const name=element('div','quick-name',target.name);top.append(siteMark(target),name,element('small','service-region',target.group==='local'?'国内':'国际'));
  const metric=element('div','quick-metric');
  const speed=element('div',`latency ${result.status==='done'?(result.ms<400?'fast':'slow'):'waiting'}`,result.status==='done'?String(Math.round(result.ms)):{idle:'—',running:'…',failed:'—',stopped:'—'}[result.status]);
  if(result.status==='done')speed.append(element('small','','ms'));
  metric.append(speed,sparkline(quickSamples.get(target.id)));
  const caption=element('div','quick-caption');caption.append(element('span',result.status==='done'?'success':'',result.status==='done'?'已响应':{idle:'等待检测',running:'请求中…',failed:'未确认',stopped:'已停止'}[result.status]),element('span','',result.status==='done'?'HTTPS 请求':'浏览器直测'));
  card.append(top,metric,caption);if(result.error)card.title=result.error;return card;
 }));
}

function renderServices(){
 const filtered=services.filter(target=>state.serviceFilter==='all'||target.group===state.serviceFilter);
 $('service-grid').replaceChildren(...filtered.map(target=>{
  const result=state.sites.find(item=>item.id===target.id),card=element('article','service-card'),details=element('div','service-details');
  const link=element('a','service-name',target.name);link.href=`https://${target.domain}`;link.target='_blank';link.rel='noopener noreferrer';
  details.append(link,element('div','service-domain',`${target.domain}${target.path}`));
  if(result.status==='failed')details.append(element('small','probe-explanation','跨域策略、站点验证或网络限制；无法判断网页能否打开。'));
  const status=element('div',`service-status ${result.status==='done'?'success':''}`);
  status.append(element('span','',{idle:'待检测',running:'检测中…',done:'探针有响应',failed:'探针未确认',stopped:'已停止'}[result.status]),element('small','',result.status==='done'?`${formatMs(result.ms)} · ${result.httpStatus===null?'状态不可见':`HTTP ${result.httpStatus}`}`:'浏览器探针'));
  const actions=element('div','service-actions'),verify=element('a','retry-button','打开验证 ↗');verify.href=link.href;verify.target='_blank';verify.rel='noopener noreferrer';verify.setAttribute('aria-label',`打开验证 ${target.name}`);
  const retry=element('button','retry-button','重试');retry.type='button';retry.disabled=state.busy;retry.setAttribute('aria-label',`重试 ${target.name} 的连接`);retry.addEventListener('click',()=>start(`重试 ${target.name}`,signal=>runReachability([target],state.sites,signal,renderServices)));
  actions.append(retry,verify);status.append(actions);card.append(siteMark(target),details,status);if(result.error)card.title=result.error;return card;
 }));
 const done=state.sites.filter(x=>x.status==='done').length,finished=state.sites.filter(x=>['done','failed','stopped'].includes(x.status)).length;$('service-summary').textContent=`${done} 探针响应 / ${finished} 已检测 / ${services.length} 目标`;
}
function renderSplit(){
 const filtered=splitTargets.filter(target=>state.splitFilter==='all'||target.group===state.splitFilter);
 $('split-body').replaceChildren(...filtered.map(target=>{const result=state.split.find(item=>item.id===target.id);const row=element('tr','');const site=element('td','');const wrap=element('div','split-site');const mark=siteMark(target);const names=element('div','');const name=element('strong','',target.name);name.append(element('span','category',target.group==='local'?'国内':target.group==='ai'?'AI':target.group==='dev'?'开发':'国际'));names.append(name,element('small','',result.redirected?`${new URL(target.url).host} → ${result.host}`:result.host||new URL(target.url).host));wrap.append(mark,names);site.append(wrap);
 const nation=element('td','country',country(result.info?.countryCode||result.countryCode));const address=element('td','');if(result.ip){address.append(ipButton(result.ip),element('small','cell-note',formatMs(result.ms)));}else address.append(element('span',result.status==='running'?'pending':'unconfirmed',result.reachable?'已响应，出口不可读':{idle:'待检测',running:'检测中…',failed:'未确认',stopped:'已停止'}[result.status]));
 const geo=element('td','');geo.append(element('span','',result.ip?place(result.info,result.geoStatus==='loading'?'查询中…':'归属地未知'):'—'));if(result.info?.isp)geo.append(element('small','cell-note',state.hidden?'网络信息已隐藏':result.info.isp));if(result.error)geo.append(element('small','cell-note',result.error));if(result.geoError)geo.append(element('small','cell-note','归属查询暂不可用，出口 IP 仍有效'));
 const asn=element('td','',result.info?.asn?state.hidden?'AS****':`AS${result.info.asn}`:'—');const retry=element('button','retry-button','重试');retry.type='button';retry.disabled=state.busy;retry.setAttribute('aria-label',`重试 ${target.name} 的出口检测`);retry.addEventListener('click',()=>start(`重试 ${target.name}`,signal=>runSplit(signal,[target])));asn.append(retry);row.append(site,nation,address,geo,asn);return row;}));
 const valid=state.split.filter(x=>x.ip).length,finished=state.split.filter(x=>['done','failed','stopped'].includes(x.status)).length;$('split-summary').textContent=`${valid} 个可读出口 / ${finished} 已检测 / ${splitTargets.length} 目标`;
}
function renderHistory(){const host=$('history-list');$('clear-history').disabled=!history.length;if(!history.length){host.replaceChildren(element('div','empty','还没有完整检测记录。点击上方“全面检测”，保存本次节点对照。'));return;}const header=element('div','history-row history-head');['时间','节点备注','检测出口','服务响应'].forEach(text=>header.append(element('div','',text)));host.replaceChildren(header,...history.map(item=>{const row=element('div','history-row');const addresses=element('div','');item.exits.slice(0,3).forEach(exit=>addresses.append(element('small','',`${exit.name} · ${maskIp(exit.ip,state.hidden)}`)));if(!item.exits.length)addresses.textContent='无可读出口';row.append(element('div','',dateLabel(item.time)),element('div','',item.label||'未备注'),addresses,element('div','',`${item.responded} / ${item.total} 已响应`));return row;}));}
function renderDual(){const host=$('dual-result');if(!state.dual.length)return;host.replaceChildren(...state.dual.map(item=>{const row=element('div','');row.append(`${item.name}：`);if(item.ip)row.append(ipButton(item.ip));else row.append(item.error||'检测中…');return row;}));}
function renderAll(){if(state.webrtc.length)renderWebrtc();renderSources();renderQuick();renderServices();renderSplit();renderHistory();renderDual();if(state.modal)renderDialog();}
function updateControls(){for(const id of ['run-all','run-network','run-split','run-services','run-dual','run-webrtc','run-speed','dns-submit','run-quality','custom-site-submit'])$(id).disabled=state.busy;for(const button of document.querySelectorAll('button.retry-button'))button.disabled=state.busy;$('stop-button').hidden=!state.busy;$('export-report').disabled=state.busy||!state.report;$('export-csv').disabled=state.busy||!state.report;}
async function start(label,task){if(state.busy)return;state.busy=true;state.controller=new AbortController();const signal=state.controller.signal;notice('');$('activity').textContent=label;updateControls();try{await task(signal);signal.throwIfAborted();$('activity').textContent=`最近完成 ${new Date().toLocaleTimeString('zh-CN',{hour:'2-digit',minute:'2-digit'})} · ${label}`;}catch(error){if(signal.aborted){$('activity').textContent='检测已停止';toast('已停止检测，未保存不完整记录。');}else{notice(errorText(error));$('activity').textContent='检测未完成，可重试';}}finally{for(const item of [...state.sources,...state.quick,...state.sites,...state.split])if(item.status==='running')item.status='stopped';state.busy=false;state.controller=null;updateControls();renderAll();maybeAuto();}}
async function runSources(signal){state.sources=reset(exitSources);renderSources();await eachLimit(exitSources,2,signal,async target=>{const result=state.sources.find(item=>item.id===target.id);result.status='running';renderSources();try{Object.assign(result,await probeExit({...target,timeout:state.slow?20000:12000,onAttempt:attempt=>{result.host=attempt.host;result.viaFallback=attempt.index>0;renderSources();}},signal),{status:'done'});}catch(error){result.status=signal.aborted?'stopped':'failed';result.error=signal.aborted?'已停止':errorText(error);}renderSources();});signal.throwIfAborted();}
async function runReachability(targets,results,signal,render){
 await eachLimit(targets,3,signal,async target=>{const result=results.find(item=>item.id===target.id);delete result.error;result.status='running';render();
  try{Object.assign(result,await probeConnection(`https://${target.domain}${target.path}`,signal,state.slow?20000:12000),{status:'done'});if(targets===quickServices){const samples=quickSamples.get(target.id)||[];quickSamples.set(target.id,[...samples,result.ms].slice(-6));}}
  catch(error){result.status=signal.aborted?'stopped':'failed';result.error=errorText(error);}render();
 });signal.throwIfAborted();
}

async function runNetwork(signal){state.quick=reset(quickServices);renderQuick();await Promise.all([runSources(signal),runReachability(quickServices,state.quick,signal,renderQuick)]);state.networkDone=true;}
async function runServices(signal,targets=services){if(targets===services)state.sites=reset(services);else for(const target of targets){const index=state.sites.findIndex(item=>item.id===target.id);state.sites[index]={id:target.id,status:'idle'};}renderServices();await runReachability(targets,state.sites,signal,renderServices);state.sitesDone=true;}
async function runSplit(signal,targets=splitTargets){
 if(targets===splitTargets)state.split=reset(splitTargets);
 renderSplit();const geoJobs=[];
 await eachLimit(targets,3,signal,async target=>{const result=state.split.find(item=>item.id===target.id);Object.keys(result).forEach(key=>{if(key!=='id')delete result[key];});result.status='running';renderSplit();
  try{Object.assign(result,await probeExit({...target,timeout:state.slow?20000:12000},signal),{status:'done',geoStatus:'loading'});geoJobs.push(result);}
  catch(error){result.status=signal.aborted?'stopped':'failed';result.error=errorText(error);result.reachable=error.reachable===true;
   if(!signal.aborted&&error instanceof TypeError){try{await probeConnection(target.url,signal,6000);result.reachable=true;}catch{}}
  }renderSplit();
 });
 await eachLimit(geoJobs,3,signal,async result=>{try{result.info=await infoFor(result.ip,signal);result.geoStatus='done';}catch(error){if(signal.aborted)throw error;result.geoStatus='failed';result.geoError=errorText(error);}renderSplit();});
 signal.throwIfAborted();if(targets===splitTargets)state.splitDone=true;
}

async function runAll(signal){state.report=null;updateControls();await runNetwork(signal);$('activity').textContent='正在读取各网站实际出口…';$('activity').textContent='正在检测分流和网站服务…';await Promise.all([runSplit(signal),runServices(signal)]);signal.throwIfAborted();const time=new Date().toISOString(),label=$('node-label').value.trim();state.report={app:'SpeedLens',version:'1.2.1',time,label,exits:structuredClone(state.sources),split:structuredClone(state.split),services:structuredClone(state.sites),notes:['出口请求由浏览器发起；探针域名可能与主站规则不同。','可读出口不是账号可用或地区解锁证明。','导出包含真实 IP，隐私开关仅影响页面显示。']};history=safeHistory([{time,label,exits:state.sources.filter(x=>x.ip).map(x=>({name:exitSources.find(target=>target.id===x.id).name,ip:x.ip})),responded:state.sites.filter(x=>x.status==='done').length,total:services.length},...history]);if(!store('speedlens.history.v1',history))notice('检测完成，但浏览器不允许保存历史；仍可导出本次报告。');renderHistory();toast('全面检测完成，记录已保存到本机。');}
function renderDialog(){const modal=state.modal;if(!modal)return;const host=$('ip-dialog-body');host.replaceChildren(element('div','modal-ip',maskIp(modal.ip,state.hidden)));const copy=element('button','button secondary','复制真实 IP');copy.addEventListener('click',()=>copyText(modal.ip));const tail=element('div','modal-actions');tail.append(element('span','','IP 风险信息来自第三方，不保证服务解锁或原生住宅。'),copy);if(modal.status==='loading'){host.append(element('p','modal-source loading','正在查询 IPQuery…'),tail);return;}if(modal.error){host.append(element('p','notice',modal.error),element('p','footnote','没有数据的字段保持未知，不作纯净判断。'),tail);return;}const data=modal.data;host.append(element('p','modal-source',`来源 ${data.source} · ${dateLabel(data.checkedAt)}${data.cached?' · 缓存':''}`));const grid=element('div','detail-grid');for(const [label,value]of [['归属地',place(data)],['网络 / ISP',state.hidden?'已隐藏':data.isp||'未知'],['ASN',data.asn?(state.hidden?'AS****':`AS${data.asn}`):'未知'],['时区',state.hidden?'已隐藏':data.timezone||'未知']]){const item=element('div','');item.append(element('span','',label),element('strong','',value));grid.append(item);}host.append(grid);const summary=riskSummary(data.flags);host.append(element('h3',`risk-heading ${summary.kind==='flagged'?'flagged':summary.kind==='clear'?'success':''}`,summary.title));if(Number.isFinite(data.riskScore)){host.append(element('div','risk-score',`IPQuery 风险分：${data.riskScore} / 100 · 越低表示其评估风险越少`));const meter=element('div','risk-meter');const bar=element('div','');bar.style.width=`${data.riskScore}%`;meter.append(bar);host.append(meter);}const risks=element('div','risk-grid');for(const[key,label]of riskFields){const value=data.flags?.[key],row=element('div','risk-row');row.append(element('span','',label),element('span',typeof value!=='boolean'?'muted':value?'flagged':'success',typeof value!=='boolean'?'未知':value?'已标记':'未标记'));risks.append(row);}host.append(risks,element('p','footnote',data.notice||'数据库未标记，不代表没有风险。'),tail);}
async function openIp(ip){if(!validIp(ip)){notice('请输入有效的公网 IPv4 或 IPv6 地址');return;}const token=++state.modalToken;state.modal={ip,status:'loading'};renderDialog();if(!$('ip-dialog').open)$('ip-dialog').showModal();try{const data=await infoFor(ip);if(token!==state.modalToken)return;state.modal={ip,status:'done',data};for(const result of [...state.sources,...state.split])if(canonicalIp(result.ip)===canonicalIp(ip))result.info=data;renderAll();}catch(error){if(token!==state.modalToken)return;state.modal={ip,status:'failed',error:errorText(error)};renderDialog();}}
function closeDialog(){$('ip-dialog').close();state.modal=null;state.modalToken++;}
async function copyText(text){try{await navigator.clipboard.writeText(text);toast('真实 IP 已复制');}catch{toast('浏览器不允许自动复制，请关闭脱敏后手动选择。');}}
async function runDual(signal){const targets=[{id:'v4',name:'IPv4',url:'https://api.ipify.org?format=json',probe:'json'},{id:'v6',name:'IPv6',url:'https://api6.ipify.org?format=json',probe:'json'}];state.dual=targets.map(x=>({id:x.id,name:x.name}));renderDual();await eachLimit(targets,2,signal,async target=>{const item=state.dual.find(x=>x.id===target.id);try{Object.assign(item,await probeExit({...target,timeout:state.slow?20000:12000},signal));}catch(error){item.error=signal.aborted?'已停止':'未确认：未启用、网络或检测点限制均有可能';}renderDual();});signal.throwIfAborted();}

async function detectWebrtc(signal) {
  const output=$('webrtc-result');output.textContent='正在收集候选地址（最多 6 秒）…';
  const addresses=[];state.webrtc=[];
  let pc;
  try {
    if(!window.RTCPeerConnection) throw new Error('当前浏览器不支持 WebRTC 检测');
    pc=new RTCPeerConnection({iceServers:[{urls:'stun:stun.l.google.com:19302'}],iceCandidatePoolSize:0});
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
    state.webrtc=addresses;
    if(!addresses.length){output.textContent='未收集到候选地址；可能被浏览器保护、VPN 或网络阻止，不等于无泄漏。';return;}
    renderWebrtc();
  } catch(error) {output.textContent=signal.aborted ? '检测已停止' : errorText(error);throw error;}
  finally {pc?.close();}
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
    const session=await requestJson(`/api/speed/session?mode=${$('speed-mode').value}`,{method:'POST'},signal);
    const headers={'X-Probe-Token':session.token};
    output.textContent=`正在下载 ${(session.downloadBytes/1048576).toFixed(2)} MiB 采样数据…`;
    const downStart=performance.now();
    const bytes=await timed(signal,state.slow?90000:45000,async ownSignal=>{
      const response=await fetch('/api/speed/download',{headers,cache:'no-store',signal:ownSignal});
      if(!response.ok) throw new Error(`下载请求失败 (${response.status})`);
      return (await response.arrayBuffer()).byteLength;
    });
    const downMs=performance.now()-downStart;
    if(bytes!==session.downloadBytes) throw new Error('下载数据不完整');
    output.textContent=`正在上传 ${(session.uploadBytes/1048576).toFixed(2)} MiB 采样数据…`;
    const payload=new Uint8Array(session.uploadBytes);
    for(let i=0;i<payload.length;i+=65536) crypto.getRandomValues(payload.subarray(i,i+65536));
    const upStart=performance.now();
    const uploaded=await requestJson('/api/speed/upload',{method:'POST',headers:{...headers,'Content-Type':'application/octet-stream'},body:payload},signal,state.slow?90000:45000);
    const upMs=performance.now()-upStart;
    if(uploaded.bytes!==payload.length) throw new Error('服务器确认的上传大小不一致');
    output.textContent=`↓ ${(bytes*8/downMs/1000).toFixed(1)} Mbps　↑ ${(uploaded.bytes*8/upMs/1000).toFixed(1)} Mbps　HTTP ${formatMs(median(samples))}`;
    output.append(element('div','',`${downMs<1000||upMs<1000 ? '采样较短，仅供对照。' : ''}目标为本站节点；应用层吞吐，含请求开销。`));
  } catch(error) {output.textContent=signal.aborted ? '测速已停止' : errorText(error);throw error;}
}

function renderWebrtc(){
 const output=$('webrtc-result');const list=element('ul','');
 for(const item of state.webrtc){const address=validIp(item.ip)?maskIp(item.ip,state.hidden):item.ip.endsWith('.local')?'mDNS 本地别名':item.ip;list.append(element('li','',`${address} · ${item.type==='srflx'?'STUN 观察地址':item.ip.endsWith('.local')?'浏览器隐藏了本地 IP':'本地候选'}`));}
 output.replaceChildren(list,element('p','','与 HTTPS 出口对照；双栈或路由差异也会导致地址不同。'));
}
async function runDns(signal){
 const name=normalizeDomain($('dns-domain').value),type=$('dns-type').value,output=$('dns-result');
 const results=resolvers.map(resolver=>({resolver,status:'loading'}));
 const render=()=>output.replaceChildren(...results.map(item=>{const card=element('div','dns-card');card.append(element('h4','',item.resolver.name));
  if(item.status==='loading')card.append(element('span','loading','解析中…'));
  else if(item.error)card.append(element('span','flagged',item.error));
  else {card.append(element('span','',`${formatMs(item.data.ms)} · ${item.data.status===0?'已响应':item.data.status===3?'域名不存在':`DNS 状态 ${item.data.status}`}`));card.append(element('pre','',item.data.answers.length?item.data.answers.map(answer=>`${answer.data}  (TTL ${answer.ttl}s)`).join('\n'):'没有该类型记录'));card.append(element('span','cell-note',`${type} · ${name}${item.data.dnssec?' · DNSSEC 已验证':''}`));}return card;}));
 render();await eachLimit(results,3,signal,async item=>{try{item.data=await resolveDns(item.resolver,name,type,signal,state.slow?20000:12000);item.status='done';}catch(error){item.status='failed';item.error=signal.aborted?'已停止':errorText(error);}render();});signal.throwIfAborted();
 if(results.every(item=>item.error))throw new Error('解析服务均未成功，请检查代理规则或打开慢速网络模式');
}
async function runQuality(signal){
 const addresses={self:new URL('/api/ping',location.origin).href,cloudflare:'https://www.cloudflare.com/cdn-cgi/trace',google:'https://www.google.com/generate_204',github:'https://github.com/favicon.ico'};
 const target=$('quality-target').value,samples=[],output=$('quality-result');
 const render=()=>{const summary=connectionSummary(samples);output.replaceChildren(element('div','',`${samples.length} / 8 次采样 · ${target==='self'?'本站节点':target} · ${summary.success} 次响应`));const grid=element('div','quality-metrics');for(const[label,value]of [['中位延迟',formatMs(summary.median)],['最低延迟',formatMs(summary.min)],['最高延迟',formatMs(summary.max)],['相邻抖动',formatMs(summary.jitter)],['请求失败',`${summary.failed} / ${summary.count}`],['请求失败率',summary.failedPercent===null?'—':`${summary.failedPercent.toFixed(0)}%`]]){const item=element('div','quality-metric');item.append(element('strong','',value),element('small','',label));grid.append(item);}output.append(grid);
  if(samples.filter(item=>Number.isFinite(item.ms)).length>1){const svg=document.createElementNS('http://www.w3.org/2000/svg','svg');svg.setAttribute('class','quality-chart');svg.setAttribute('viewBox','0 0 280 55');svg.setAttribute('role','img');svg.setAttribute('aria-label','实际请求延迟采样曲线');const max=Math.max(...samples.filter(item=>Number.isFinite(item.ms)).map(item=>item.ms),1);for(let index=1;index<samples.length;index++){if(!Number.isFinite(samples[index-1].ms)||!Number.isFinite(samples[index].ms))continue;const line=document.createElementNS(svg.namespaceURI,'path');line.setAttribute('d',`M${(index-1)*38+7} ${50-samples[index-1].ms/max*43}L${index*38+7} ${50-samples[index].ms/max*43}`);line.setAttribute('stroke','currentColor');line.setAttribute('fill','none');line.setAttribute('stroke-width','1.8');svg.append(line);}output.append(svg);}
 };
 render();for(let index=0;index<8;index++){signal.throwIfAborted();try{samples.push(await probeConnection(addresses[target],signal,state.slow?20000:12000));}catch(error){if(signal.aborted)throw error;samples.push({error:errorText(error)});}render();if(samples.length>=3&&samples.slice(-3).every(item=>item.error)){output.append(element('p','','连续三次请求失败，已提前结束；可切换采样目标或检查网络。'));break;}if(index<7)await waitFor(new Promise(resolve=>setTimeout(resolve,200)),signal);}
 output.append(element('p','','统计 HTTPS 请求表现，不等于 ICMP 丢包率。'));
}
async function runCustomSite(signal){
 const address=normalizeWebsite($('custom-site-url').value.trim()),output=$('custom-site-result');output.hidden=false;output.textContent='正在连接目标网站…';
 try{const result=await probeConnection(address,signal,state.slow?20000:12000);output.replaceChildren(element('strong','success',`已收到响应 · ${formatMs(result.ms)}`),element('div','',new URL(address).host),element('div','',result.httpStatus===null?'跨域状态不可见，不能据此判断账号或地区可用性。':`HTTP ${result.httpStatus}`));}
 catch(error){output.textContent=signal.aborted?'检测已停止':`未确认：${errorText(error)}`;throw error;}
}
function exportCsv(){
 if(!state.report)return;const rows=[['探针名称','实际域名','出口IP','国家','城市','ISP','ASN','请求耗时ms','状态','备注']];
 for(const item of state.report.split){const target=splitTargets.find(target=>target.id===item.id);rows.push([target.name,item.host||new URL(target.url).host,item.ip||'',item.info?.country||item.countryCode||'',item.info?.city||'',item.info?.isp||'',item.info?.asn||'',Number.isFinite(item.ms)?Math.round(item.ms):'',item.ip?'可读出口':item.reachable?'已响应但出口不可读':'未确认',item.error||item.geoError||'']);}
 const blob=new Blob([csvText(rows)],{type:'text/csv;charset=utf-8'}),url=URL.createObjectURL(blob),link=element('a','');link.href=url;link.download=`speedlens-split-${state.report.time.replace(/[:.]/g,'-')}.csv`;link.click();setTimeout(()=>URL.revokeObjectURL(url),3000);
}

function exportReport(){if(!state.report)return;const blob=new Blob([JSON.stringify(state.report,null,2)],{type:'application/json;charset=utf-8'});const url=URL.createObjectURL(blob),link=element('a','');link.href=url;link.download=`speedlens-${state.report.time.replace(/[:.]/g,'-')}.json`;link.click();setTimeout(()=>URL.revokeObjectURL(url),3000);}
function setFilters(id,values,getValue,setValue,render){$(id).replaceChildren(...Object.entries(values).map(([key,label])=>{const button=element('button',`filter ${getValue()===key?'active':''}`,label);button.setAttribute('aria-pressed',String(getValue()===key));button.addEventListener('click',()=>{setValue(key);setFilters(id,values,getValue,setValue,render);render();});return button;}));}
function updatePreferences(){document.documentElement.dataset.theme=readStorage('speedlens.theme','light')==='dark'?'dark':'light';const dark=document.documentElement.dataset.theme==='dark';$('theme-button').replaceChildren(icon(dark?'sun':'moon'));$('theme-button').setAttribute('aria-label',dark?'切换浅色主题':'切换深色主题');$('privacy-button').replaceChildren(icon(state.hidden?'eye-off':'eye'));$('privacy-button').setAttribute('aria-label',state.hidden?'显示完整 IP':'隐藏完整 IP');$('privacy-button').setAttribute('aria-pressed',String(!state.hidden));$('auto-check').checked=state.auto;$('slow-check').checked=state.slow;}
function maybeAuto(){if(!state.auto||state.busy||document.hidden)return;if(state.route==='network'&&!state.networkDone)start('首页网络检测',runNetwork);if(state.route==='split'&&!state.splitDone&&state.split.every(item=>item.status==='idle'))start('网站分流检测',runSplit);if(state.route==='services'&&!state.sitesDone)start('网站服务检测',runServices);}
function route(){const requested=location.hash.replace(/^#\//,'');state.route=['network','split','services','tools','history'].includes(requested)?requested:'network';for(const id of ['network','split','services','tools','history'])$(`page-${id}`).hidden=id!==state.route;for(const link of document.querySelectorAll('[data-route]')){const active=link.dataset.route===state.route;link.classList.toggle('active',active);if(active)link.setAttribute('aria-current','page');else link.removeAttribute('aria-current');}document.title=`${{network:'网络状态',split:'分流测试',services:'网站服务',tools:'检测工具',history:'检测记录'}[state.route]} · SpeedLens`;maybeAuto();}
$('slow-check').addEventListener('change',()=>{state.slow=$('slow-check').checked;store('speedlens.slow',state.slow);toast(state.slow?'慢速网络模式：超时延长至 20 秒':'标准模式：超时为 12 秒');});
$('dns-form').addEventListener('submit',event=>{event.preventDefault();start('DNS 解析对照',runDns);});$('custom-site-form').addEventListener('submit',event=>{event.preventDefault();start('自定义网站检测',runCustomSite);});$('run-quality').addEventListener('click',()=>start('连接质量采样',runQuality));
$('run-all').addEventListener('click',()=>start('全面检测',runAll));$('run-network').addEventListener('click',()=>start('首页网络检测',runNetwork));$('run-split').addEventListener('click',()=>start('网站分流检测',signal=>runSplit(signal,state.splitFilter==='all'?splitTargets:splitTargets.filter(target=>target.group===state.splitFilter))));$('run-services').addEventListener('click',()=>start('网站服务检测',signal=>runServices(signal,state.serviceFilter==='all'?services:services.filter(target=>target.group===state.serviceFilter))));$('run-dual').addEventListener('click',()=>start('双栈出口检测',runDual));$('run-webrtc').addEventListener('click',()=>start('WebRTC 检测',detectWebrtc));$('run-speed').addEventListener('click',()=>start('轻量测速',detectSpeed));
$('stop-button').addEventListener('click',()=>{state.auto=false;store('speedlens.auto',false);$('auto-check').checked=false;state.controller?.abort(new DOMException('用户停止检测','AbortError'));});
$('lookup-form').addEventListener('submit',event=>{event.preventDefault();openIp($('lookup-ip').value.trim());});$('close-dialog').addEventListener('click',closeDialog);$('ip-dialog').addEventListener('cancel',()=>{state.modal=null;state.modalToken++;});$('ip-dialog').addEventListener('click',event=>{if(event.target===$('ip-dialog')){const rect=$('ip-dialog').getBoundingClientRect();if(event.clientX<rect.left||event.clientX>rect.right||event.clientY<rect.top||event.clientY>rect.bottom)closeDialog();}});
$('privacy-button').addEventListener('click',()=>{state.hidden=!state.hidden;store('speedlens.privacy',state.hidden);updatePreferences();renderAll();});$('theme-button').addEventListener('click',()=>{store('speedlens.theme',document.documentElement.dataset.theme==='dark'?'light':'dark');updatePreferences();});$('auto-check').addEventListener('change',()=>{state.auto=$('auto-check').checked;store('speedlens.auto',state.auto);maybeAuto();});
$('clear-history').addEventListener('click',()=>{history=[];if(!store('speedlens.history.v1',[]))notice('浏览器不允许修改存储，刷新后可能重新出现旧记录。');renderHistory();});$('export-report').addEventListener('click',exportReport);$('export-csv').addEventListener('click',exportCsv);$('node-label').addEventListener('input',()=>{if(state.busy||!state.report)return;state.report.label=$('node-label').value.trim();const item=history.find(x=>x.time===state.report.time);if(item){item.label=state.report.label;store('speedlens.history.v1',history);renderHistory();}});
setFilters('split-filters',{all:'全部',local:'国内',global:'国际',ai:'AI 服务',dev:'开发与 CDN'},()=>state.splitFilter,value=>state.splitFilter=value,renderSplit);setFilters('service-filters',groups,()=>state.serviceFilter,value=>state.serviceFilter=value,renderServices);
window.addEventListener('hashchange',route);window.addEventListener('pagehide',()=>state.controller?.abort());document.addEventListener('visibilitychange',()=>{if(!document.hidden)maybeAuto();});window.addEventListener('offline',()=>notice('浏览器已离线，检测结果可能无法更新。'));window.addEventListener('online',()=>notice(''));
updatePreferences();renderAll();updateControls();$('activity').textContent=state.auto?'进入页面自动检测 · 无持续轮询':'自动检测已关闭 · 可手动开始';route();
