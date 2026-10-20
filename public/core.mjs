export function validIp(value) {
  if (typeof value !== 'string' || value.length > 45 || /[^a-fA-F\d.:]/.test(value)) return false;
  if (!value.includes(':')) return value.split('.').length === 4 && value.split('.').every(x => /^(0|[1-9]\d{0,2})$/.test(x) && +x <= 255);
  try { return new URL(`http://[${value}]/`).hostname.startsWith('['); } catch { return false; }
}

export function canonicalIp(value) {
  if (!validIp(value)) return null;
  return value.includes(':') ? new URL(`http://[${value}]/`).hostname.slice(1, -1) : value;
}

export function compareExits(rows) {
  const domestic = rows.find(x => x.id === 'domestic' && canonicalIp(x.ip));
  const overseas = rows.find(x => x.id === 'cloudflare' && canonicalIp(x.ip));
  if (!domestic || !overseas) return { kind: 'unknown', title: '等待出口对照', detail: '至少需要国内检测点和 Cloudflare 都返回有效 IP。' };
  if (domestic.ip.includes(':') !== overseas.ip.includes(':')) return { kind: 'unknown', title: 'IP 协议不同，暂不比较', detail: '两处分别返回 IPv4 与 IPv6，不能据此判断分流。' };
  if (canonicalIp(domestic.ip) === canonicalIp(overseas.ip)) return { kind: 'same', title: '两个检测点出口一致', detail: '当前国内与 Cloudflare 检测点看到相同 IP；可能经过同一出口，也可能是直连。' };
  return { kind: 'different', title: '观察到不同出口', detail: '国内与 Cloudflare 检测点的 IP 不同，符合分流特征；仍需结合你的规则与 VPN 日志确认。' };
}

export const riskFields = [
  ['is_vpn', 'VPN 出口'], ['is_proxy', '公开代理'], ['is_tor', 'Tor 出口'],
  ['is_datacenter', '数据中心'], ['is_abuser', '滥用记录'],
];

export function riskSummary(flags = {}) {
  const known = riskFields.filter(([key]) => typeof flags[key] === 'boolean');
  const positive = known.filter(([key]) => flags[key]);
  if (positive.length) return { kind: 'flagged', title: '检测到风险标记', known: known.length, positive: positive.length };
  if (known.length < riskFields.length) return { kind: 'unknown', title: known.length ? '已查字段未见风险标记' : '风险数据不完整', known: known.length, positive: 0 };
  return { kind: 'clear', title: '未见已知风险标记', known: known.length, positive: 0 };
}

export function median(values) {
  if (!values.length) return null;
  const sorted = [...values].sort((a,b) => a-b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid-1] + sorted[mid]) / 2;
}

export function safeHistory(value) {
  if (!Array.isArray(value)) return [];
  return value.filter(x => x && typeof x.time === 'string' && Number.isFinite(Date.parse(x.time)) && typeof x.label === 'string' && x.label.length <= 80 && Array.isArray(x.exits) && x.exits.every(r => typeof r.name === 'string' && r.name.length <= 80 && validIp(r.ip)) && Number.isInteger(x.responded) && Number.isInteger(x.total) && x.responded >= 0 && x.responded <= x.total && x.total <= 100).slice(0,20);
}
