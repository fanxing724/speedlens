export const exitSources = [
  { id:'domestic',name:'国内测试',subtitle:'IPIP 国内检测点',url:'https://myip.ipip.net/json',probe:'json',description:'访问此国内检测点时的出口 IP' },
  { id:'international',name:'国外测试',subtitle:'ipify · IPv4',url:'https://api.ipify.org?format=json',probe:'json',description:'访问此国际检测点时的出口 IP' },
  { id:'cloudflare',name:'Cloudflare',subtitle:'CF CDN · 双栈',url:'https://www.cloudflare.com/cdn-cgi/trace',description:'访问此 Cloudflare 站点时的出口 IP' },
  { id:'x',name:'X 服务测试',subtitle:'help.x.com',url:'https://help.x.com/cdn-cgi/trace',description:'访问 X 帮助站探针时的出口 IP' },
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


export const quickServices = [
  {id:'bytedance',name:'字节跳动',domain:'www.bytedance.com',path:'/favicon.ico',group:'local',mark:'▥',color:'#4187ff'},
  {id:'bilibili',name:'Bilibili',domain:'www.bilibili.com',path:'/favicon.ico',group:'local',mark:'哔',color:'#ef84a4'},
  {id:'wechat',name:'微信',domain:'weixin.qq.com',path:'/favicon.ico',group:'local',mark:'●',color:'#22b466'},
  {id:'taobao',name:'淘宝',domain:'www.taobao.com',path:'/favicon.ico',group:'local',mark:'淘',color:'#ff8b30'},
  {id:'github',name:'GitHub',domain:'github.com',path:'/favicon.ico',group:'dev',mark:'⌘',color:'#7a889c'},
  {id:'jsdelivr',name:'jsDelivr',domain:'cdn.jsdelivr.net',path:'/favicon.ico',group:'dev',mark:'⬡',color:'#d4a42d'},
  {id:'cloudflare',name:'Cloudflare',domain:'www.cloudflare.com',path:'/favicon.ico',group:'dev',mark:'☁',color:'#f58a2d'},
  {id:'youtube',name:'YouTube',domain:'www.youtube.com',path:'/favicon.ico',group:'stream',mark:'▶',color:'#ee4654'},
];

export const splitTargets = [
  {id:'domestic',name:'IPIP',group:'local',url:'https://myip.ipip.net/json',probe:'json'},
  {id:'netease',name:'网易',group:'local',url:'https://necaptcha.nosdn.127.net/ab7f4275c1744aa28e0a8f3a1c58c532.png',probe:'header',method:'HEAD'},
  {id:'bytedance-cn',name:'字节跳动',group:'local',url:'https://perfops.byte-test.com/500b-bench.jpg',probe:'header'},
  {id:'cf-cn',name:'Cloudflare 中国探针',group:'local',url:'https://perfops.cloudflareperf.com/cdn-cgi/trace'},
  {id:'qualcomm',name:'高通中国',group:'local',url:'https://www.qualcomm.cn/cdn-cgi/trace'},
  {id:'bytedance-global',name:'ByteDance',group:'global',url:'https://perfops1.byteperf.com/500b-bench.jpg',probe:'header'},
  {id:'cloudflare',name:'Cloudflare',group:'global',url:'https://www.cloudflare.com/cdn-cgi/trace'},
  {id:'discord',name:'Discord',group:'global',url:'https://gateway.discord.gg/cdn-cgi/trace'},
  {id:'visa',name:'Visa',group:'global',url:'https://www.visa.com/cdn-cgi/trace'},
  {id:'x',name:'X (Twitter)',group:'global',url:'https://x.com/cdn-cgi/trace'},
  {id:'medium',name:'Medium',group:'global',url:'https://medium.com/cdn-cgi/trace'},
  {id:'chatgpt',name:'ChatGPT',group:'ai',url:'https://chatgpt.com/cdn-cgi/trace'},
  {id:'claude',name:'Claude',group:'ai',url:'https://claude.ai/cdn-cgi/trace'},
  {id:'grok',name:'Grok',group:'ai',url:'https://grok.com/cdn-cgi/trace'},
  {id:'openai',name:'OpenAI',group:'ai',url:'https://openai.com/cdn-cgi/trace'},
  {id:'anthropic',name:'Anthropic',group:'ai',url:'https://anthropic.com/cdn-cgi/trace'},
  {id:'perplexity',name:'Perplexity',group:'ai',url:'https://www.perplexity.ai/cdn-cgi/trace'},
  {id:'jsdelivr',name:'jsDelivr',group:'dev',url:'https://testingcf.jsdelivr.net/cdn-cgi/trace'},
  {id:'npm',name:'npm Registry',group:'dev',url:'https://registry.npmjs.org/cdn-cgi/trace'},
  {id:'unpkg',name:'UNPKG',group:'dev',url:'https://app.unpkg.com/cdn-cgi/trace'},
  {id:'nodejs',name:'Node.js',group:'dev',url:'https://nodejs.org/cdn-cgi/trace'},
  {id:'gitlab',name:'GitLab',group:'dev',url:'https://gitlab.com/cdn-cgi/trace'},
];
