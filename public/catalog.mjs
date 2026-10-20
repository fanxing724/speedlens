export const exitSources = [
  { id:'domestic', name:'国内检测点', host:'myip.ipip.net', family:'IPv4 / IPv6', url:'https://myip.ipip.net/json', parse:d=>({ip:d.data?.ip, location:d.data?.location?.join(' · ')}) },
  { id:'cloudflare', name:'Cloudflare', host:'www.cloudflare.com', family:'IPv4 / IPv6', url:'https://www.cloudflare.com/cdn-cgi/trace', text:true, parse:s=>{const d=Object.fromEntries(s.trim().split('\n').map(x=>x.split('=')));return {ip:d.ip,location:d.loc,colo:d.colo};} },
  { id:'ipv4', name:'IPv4 出口', host:'api.ipify.org', family:'仅 IPv4', url:'https://api.ipify.org?format=json', parse:d=>({ip:d.ip}) },
  { id:'ipv6', name:'IPv6 出口', host:'api6.ipify.org', family:'仅 IPv6', url:'https://api6.ipify.org?format=json', parse:d=>({ip:d.ip}) },
];

export const services = [
  { id:'google', name:'Google', domain:'www.google.com', group:'global', mark:'G', color:'#4285f4', path:'/generate_204' },
  { id:'youtube', name:'YouTube', domain:'www.youtube.com', group:'stream', mark:'▶', color:'#ed4444', path:'/favicon.ico' },
  { id:'chatgpt', name:'ChatGPT', domain:'chatgpt.com', group:'ai', mark:'◎', color:'#58bca0', path:'/favicon.ico' },
  { id:'claude', name:'Claude', domain:'claude.ai', group:'ai', mark:'✳', color:'#c99473', path:'/favicon.ico' },
  { id:'gemini', name:'Gemini', domain:'gemini.google.com', group:'ai', mark:'✦', color:'#7a97e8', path:'/favicon.ico' },
  { id:'github', name:'GitHub', domain:'github.com', group:'dev', mark:'⌘', color:'#abb3c8', path:'/favicon.ico' },
  { id:'telegram', name:'Telegram', domain:'web.telegram.org', group:'global', mark:'➤', color:'#4ca7d1', path:'/favicon.ico' },
  { id:'x', name:'X', domain:'x.com', group:'global', mark:'𝕏', color:'#b7c1d4', path:'/favicon.ico' },
  { id:'netflix', name:'Netflix', domain:'www.netflix.com', group:'stream', mark:'N', color:'#df3947', path:'/favicon.ico' },
  { id:'spotify', name:'Spotify', domain:'open.spotify.com', group:'stream', mark:'≋', color:'#55c780', path:'/favicon.ico' },
  { id:'disney', name:'Disney+', domain:'www.disneyplus.com', group:'stream', mark:'D+', color:'#7a9fdf', path:'/favicon.ico' },
  { id:'wikipedia', name:'Wikipedia', domain:'www.wikipedia.org', group:'global', mark:'W', color:'#b2bdd0', path:'/static/favicon/wikipedia.ico' },
  { id:'baidu', name:'百度', domain:'www.baidu.com', group:'local', mark:'百', color:'#6b8cef', path:'/favicon.ico' },
  { id:'bilibili', name:'哔哩哔哩', domain:'www.bilibili.com', group:'local', mark:'哔', color:'#e18eac', path:'/favicon.ico' },
  { id:'qq', name:'腾讯', domain:'www.qq.com', group:'local', mark:'Q', color:'#65adcf', path:'/favicon.ico' },
  { id:'taobao', name:'淘宝', domain:'www.taobao.com', group:'local', mark:'淘', color:'#e19c62', path:'/favicon.ico' },
  { id:'cloudflare', name:'Cloudflare', domain:'www.cloudflare.com', group:'dev', mark:'☁', color:'#e0a05f', path:'/cdn-cgi/trace' },
  { id:'npm', name:'npm', domain:'www.npmjs.com', group:'dev', mark:'npm', color:'#d87878', path:'/favicon.ico' },
];

export const groups = { all:'全部', ai:'AI 服务', global:'国际网站', local:'国内网站', stream:'影音娱乐', dev:'开发工具' };
