import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { isIP } from 'node:net';
import { randomBytes, randomUUID } from 'node:crypto';

const MiB = 1024 * 1024;
const bool = value => typeof value === 'boolean' ? value : null;
const normalizeIp = ip => ip?.startsWith('::ffff:') && isIP(ip.slice(7)) === 4 ? ip.slice(7) : ip;
export function publicIp(ip) {
  ip = normalizeIp(ip);
  const version = isIP(ip);
  if (version === 4) {
    const [a,b,c] = ip.split('.').map(Number);
    return !(a === 0 || a === 10 || a === 127 || a >= 224 || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) || (a === 192 && (b === 168 || b === 0 || (b === 0 && c === 2))) || (a === 100 && b >= 64 && b <= 127) || (a === 198 && (b === 18 || b === 19 || b === 51)) || (a === 203 && b === 0 && c === 113));
  }
  if (version === 6) {
    const canonical = new URL(`http://[${ip}]/`).hostname.toLowerCase();
    return /^\[[23][0-9a-f]{3}:/.test(canonical) && !canonical.startsWith('[2001:db8:') && !canonical.startsWith('[2002:') && !canonical.startsWith('[2001:0:');
  }
  return false;
}

export function normalizeRisk(data) {
  if (!data || data.error || !isIP(data.ip)) throw new Error('风险数据源没有返回有效 IP');
  return {
    ip: data.ip, source: 'IPQuery', checkedAt: new Date().toISOString(),
    country: data.location?.country || null, countryCode: data.location?.country_code || null,
    city: data.location?.city || null, region: data.location?.state || null,
    timezone: data.location?.timezone || null,
    isp: data.isp?.isp || data.isp?.org || null, asn: data.isp?.asn?.toString().replace(/^AS/i,'') || null,
    networkType: null,
    riskScore: typeof data.risk?.risk_score === 'number' && data.risk.risk_score >= 0 && data.risk.risk_score <= 100 ? data.risk.risk_score : null,
    flags: Object.fromEntries(['is_vpn','is_proxy','is_tor','is_datacenter','is_abuser'].map(k => [k,bool(data.risk?.[k])])),
    notice: '风险分由 IPQuery 提供，越低表示其评估风险越少；未提供的滥用字段保持未知。',
  };
}

export function clientIp(req, trustProxy = false) {
  if (trustProxy) {
    const cf = req.headers['cf-connecting-ip'];
    if (typeof cf === 'string' && isIP(cf.trim())) return normalizeIp(cf.trim());
    const forwarded = req.headers['x-forwarded-for'];
    if (typeof forwarded === 'string') {
      const ip = forwarded.split(',')[0].trim();
      if (isIP(ip)) return normalizeIp(ip);
    }
  }
  return normalizeIp(req.socket.remoteAddress || '');
}

async function upstreamJson(url, headers = {}) {
  const response = await fetch(url, { headers: { accept: 'application/json', ...headers }, signal: AbortSignal.timeout(7000), redirect: 'error' });
  if (!response.ok) throw new Error('数据源暂时不可用或额度已用完');
  const body = await response.text();
  if (body.length > 128 * 1024) throw new Error('数据源返回内容过大');
  return JSON.parse(body);
}

const MIME = { '/': 'text/html; charset=utf-8', '/styles.css': 'text/css; charset=utf-8', '/app.mjs': 'text/javascript; charset=utf-8', '/core.mjs': 'text/javascript; charset=utf-8', '/catalog.mjs': 'text/javascript; charset=utf-8', '/probes.mjs': 'text/javascript; charset=utf-8', '/favicon.svg': 'image/svg+xml' };
const assets = new Map(await Promise.all(Object.entries(MIME).map(async ([path,type]) => [path,{ type, body: await readFile(new URL(`public/${path === '/' ? 'index.html' : path.slice(1)}`, import.meta.url)) }])));

export function createApp(options = {}) {
  const lookupFetch = options.upstreamJson || upstreamJson;
  const trustProxy = options.trustProxy ?? process.env.TRUST_RENDER_PROXY === '1';
  const cache = new Map(), inflight = new Map(), limits = new Map(), sessions = new Map();
  const randomBlock = randomBytes(64 * 1024);
  let activeLookup = 0, activeTransfer = 0;
  function permit(key, max, windowMs = 60_000) {
    const now = Date.now();
    for (const [k,v] of limits) if (v.until <= now) limits.delete(k);
    let entry = limits.get(key);
    if (!entry) { if (limits.size >= 2048) return false; entry = { n:0, until:now + windowMs }; limits.set(key,entry); }
    return ++entry.n <= max;
  }
  function json(res, code, data) {
    res.writeHead(code, { 'Content-Type':'application/json; charset=utf-8', 'Cache-Control':'no-store', ...(code === 429 ? {'Retry-After':'60'} : {}) });
    res.end(JSON.stringify(data));
  }
  async function lookup(ip) {
    const entry = cache.get(ip);
    if (entry?.until > Date.now()) return { ...entry.value, cached:true };
    if (inflight.has(ip)) return inflight.get(ip);
    if (activeLookup >= 4 || !permit('provider', 30) || !permit('provider-day', 850, 86_400_000)) throw new Error('查询繁忙，请稍后重试');
    activeLookup++;
    const task = (async () => {
      let value;
      try {
        const raw = await lookupFetch(`https://api.ipquery.io/${encodeURIComponent(ip)}`);
        value = normalizeRisk(raw);
        if (new URL(`http://${isIP(ip) === 6 ? `[${ip}]` : ip}`).hostname !== new URL(`http://${isIP(value.ip) === 6 ? `[${value.ip}]` : value.ip}`).hostname) throw new Error('数据源返回了不同 IP');
      } catch {
        const raw = await lookupFetch(`https://ipwho.is/${encodeURIComponent(ip)}`);
        if (!raw.success || raw.ip !== ip) throw new Error('IP 数据源暂时不可用，请稍后重试');
        value = { ip, source:'ipwho.is', checkedAt:new Date().toISOString(), country:raw.country, countryCode:raw.country_code, city:raw.city, region:raw.region, timezone:raw.timezone?.id, isp:raw.connection?.isp, asn:raw.connection?.asn, networkType:null, flags:{}, notice:'备用数据源仅提供归属地，风险信息未知。' };
      }
      if (cache.size >= 256) cache.delete(cache.keys().next().value);
      cache.set(ip,{ value,until:Date.now()+15*60_000 });
      return value;
    })().finally(() => { activeLookup--; inflight.delete(ip); });
    inflight.set(ip,task);
    return task;
  }
  const server = createServer(async (req,res) => {
    res.setHeader('X-Content-Type-Options','nosniff');
    res.setHeader('Referrer-Policy','no-referrer');
    res.setHeader('X-Frame-Options','DENY');
    res.setHeader('Permissions-Policy','camera=(), microphone=(), geolocation=()');
    res.setHeader('Content-Security-Policy',"default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; connect-src 'self' https:; frame-ancestors 'none'; base-uri 'none'; form-action 'self'");
    req.on('error',()=>{});
    try {
      const url = new URL(req.url,'http://localhost');
      const ip = clientIp(req,trustProxy);
      if (req.method === 'GET' && url.pathname === '/healthz') return json(res,200,{ status:'ok', app:'speedlens', version:'1.1.0' });
      if (req.method === 'GET' && url.pathname === '/api/context') return json(res,200,{ ip, public:publicIp(ip), node:process.env.RENDER_REGION || (process.env.RENDER ? 'Render' : '本地测试节点'), version:'1.1.0' });
      if (req.method === 'GET' && url.pathname === '/api/ping') { res.writeHead(204,{'Cache-Control':'no-store'}); return res.end(); }
      if (req.method === 'GET' && url.pathname === '/api/lookup') {
        if (!permit(`lookup:${ip}`,60)) return json(res,429,{ error:'查询过于频繁，一分钟后再试' });
        const target = url.searchParams.get('ip')?.trim();
        if (!publicIp(target)) return json(res,400,{ error:'请输入有效的公网 IPv4 或 IPv6 地址' });
        try { return json(res,200,await lookup(target)); } catch (e) { return json(res,503,{ error:e.message }); }
      }
      if (req.method === 'POST' && url.pathname === '/api/speed/session') {
        if (req.headers['sec-fetch-site'] === 'cross-site') return json(res,403,{ error:'请从本站发起测速' });
        if (!permit('speed-global',10) || !permit(`speed:${ip}`,3)) return json(res,429,{ error:'测速请求较多，请一分钟后再试' });
        if (!permit('speed-day',20,86_400_000)) return json(res,429,{ error:'本站今日轻量测速额度已用完（20 次），其他检测可正常使用' });
        for (const [key,value] of sessions) if (value.until < Date.now()) sessions.delete(key);
        const token = randomUUID();
        sessions.set(token,{ ip, until:Date.now()+60_000, download:false, upload:false });
        return json(res,200,{ token, downloadBytes:4*MiB, uploadBytes:MiB });
      }
      if (url.pathname.startsWith('/api/speed/')) {
        const session = sessions.get(req.headers['x-probe-token']);
        if (!session || session.ip !== ip || session.until < Date.now()) return json(res,403,{ error:'测速会话已失效' });
        if (activeTransfer >= 3) return json(res,429,{ error:'测速节点繁忙，请稍后再试' });
        if (req.method === 'GET' && url.pathname === '/api/speed/download') {
          if (session.download) return json(res,409,{ error:'本次下载测试已完成' });
          session.download = true;
          activeTransfer++;
          res.once('close',()=>activeTransfer--);
          res.writeHead(200,{'Content-Type':'application/octet-stream','Content-Length':4*MiB,'Cache-Control':'no-store, no-transform','Content-Encoding':'identity'});
          let sent = 0;
          const write = () => { while (!res.destroyed && sent < 4*MiB) { sent += randomBlock.length; if (!res.write(randomBlock)) { res.once('drain',write); return; } } if (!res.destroyed) res.end(); };
          return write();
        }
        if (req.method === 'POST' && url.pathname === '/api/speed/upload') {
          if (session.upload) return json(res,409,{ error:'本次上传测试已完成' });
          session.upload = true;
          const length = Number(req.headers['content-length']);
          if (req.headers['content-encoding'] || (Number.isFinite(length) && length > MiB)) return json(res,413,{error:'上传大小上限为 1 MiB'});
          activeTransfer++;
          res.once('close',()=>activeTransfer--);
          let bytes = 0;
          const deadline = setTimeout(()=>{ json(res,408,{error:'上传超时'}); req.destroy(); },15_000);
          res.once('close',()=>clearTimeout(deadline));
          req.on('data',chunk=>{ bytes += chunk.length; if (bytes > MiB) { clearTimeout(deadline); json(res,413,{error:'上传大小上限为 1 MiB'}); req.destroy(); } });
          req.on('end',()=>{ clearTimeout(deadline); if (!res.writableEnded) json(res,200,{ bytes }); });
          return;
        }
      }
      const asset = assets.get(url.pathname);
      if ((req.method === 'GET' || req.method === 'HEAD') && asset) {
        res.writeHead(200,{'Content-Type':asset.type,'Content-Length':asset.body.length,'Cache-Control':'no-cache'});
        return res.end(req.method === 'HEAD' ? undefined : asset.body);
      }
      return json(res,404,{ error:'接口不存在' });
    } catch { if (!res.headersSent) json(res,500,{error:'请求处理失败，请重试'}); else res.destroy(); }
  });
  server.requestTimeout = 20_000;
  server.headersTimeout = 10_000;
  server.maxConnections = 80;
  return server;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const server = createApp();
  server.listen(Number(process.env.PORT || 3000),process.env.HOST || '0.0.0.0',()=>console.log(`SpeedLens listening on port ${server.address().port}`));
  for (const signal of ['SIGTERM','SIGINT']) process.once(signal,()=>{
    server.close(()=>process.exit(0));
    setTimeout(()=>{server.closeAllConnections(); process.exit(0);},5000).unref();
  });
}
