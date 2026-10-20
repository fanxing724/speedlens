# 第三方服务说明

SpeedLens 的生产与测试代码无第三方 npm 依赖。v1.2 的网络状态卡片、点击 IP 弹窗及分流表交互参考 https://cf.090227.xyz/；界面、SVG 标志与 CSS 图形独立编写，未复制参考站的脚本、样式、品牌 SVG 或统计服务；未打包原始 ZIP 中的源代码、依赖或素材。网站名称、文字标识属于各自权利人，仅用于标明诊断目标，不表示合作关系。

以下公共服务在用户发起对应检测时被访问，其可用性、条款、数据准确性与限额由提供者决定：

| 提供者 | 用途 | 访问位置 |
| --- | --- | --- |
| [IPIP](https://myip.ipip.net/) | 国内检测点观察到的 IP | 浏览器 |
| [Cloudflare](https://www.cloudflare.com/) | trace 接口观察到的 IP、站点连通性 | 浏览器 |
| [ipify](https://www.ipify.org/) | IPv4 / IPv6 出口 | 浏览器 |
| [IPQuery](https://ipquery.io/) / [接口文档](https://ipquery.gitbook.io/ipquery-docs) | IP 归属、ASN、风险字段和源站风险分 | 本站后端 |
| [ipwho.is](https://ipwhois.io/documentation) | IPQuery 失败后的归属地备用数据源 | 本站后端 |
| Cloudflare、Google、阿里 DNS 公共 DoH 接口 | 可选 DNS 解析对照 | 浏览器 |
| Google STUN `stun.l.google.com:19302` | 可选 WebRTC ICE 候选收集 | 浏览器 |
| public/catalog.mjs 中列出的分流探针和目标网站 | 无凭据 HTTPS 连通性、trace 或响应头出口读取请求 | 浏览器 |
| [Render](https://render.com/docs/free) | 可选网站托管 | 云平台 |

IPQuery 风险分是源站返回字段，不是 SpeedLens 自行推算的“纯度分”。字段缺失保持未知。网站跨域响应通常无法读取 HTTP 状态，结果不能用来声称服务解锁或账号可用。

首页备用检测点包括高通中国、Cloudflare 中国探针、icanhazip 与 ipify 双栈接口；界面展示实际成功检测点。浏览器和云平台会向请求目标暴露相应的连接 IP。风险查询会把查询的目标 IP 发送给上述数据源；第三方可能保留日志。请结合各提供者最新条款和隐私政策使用。
