<!-- fanxing-style:start -->
<picture>
  <source media="(prefers-color-scheme: light)" srcset="https://fanxing724.github.io/new-make/fanxing724/projects/speedlens/cover.light.svg">
  <img alt="SpeedLens · 网络透镜" src="https://fanxing724.github.io/new-make/fanxing724/projects/speedlens/cover.svg" width="100%">
</picture>

**换了节点，也想看清网络走向。**

节点连上之后，出口在哪里、网站走哪条路、一次失败意味着什么，仍然需要逐项确认。网络透镜把这些线索放进浏览器，让每次切换都有据可看。

<sub>番星 / 星轨手记 · <a href="https://fanxing724.github.io/new-make/fanxing724/projects/style.html">风格样板</a> · <a href="https://fanxing724.github.io/">个人小站</a></sub>
<!-- fanxing-style:end -->

# SpeedLens · 网络透镜

面向 VPN 与分流环境的浏览器网络检测工具。v1.2 保留 [参考站的网络状态与分流交互](https://cf.090227.xyz/) 的顶部导航、出口卡片与分流表，采用米白、墨色和暖橙的视觉设计，界面与逻辑独立编写。不包含 CF 优选域名或优选 IP 聚合。

[![Deploy to Render](https://render.com/images/deploy-to-render-button.svg)](https://render.com/deploy?repo=https://github.com/fanxing724/speedlens)

## 功能

- **网络状态首页**：国内 IPIP、国际 ipify、Cloudflare、X 帮助站四类出口；八个常用站点的 HTTPS 请求延迟。显示实际探针域名。
- **点击 IP 查看详情**：弹窗展示国家、城市、网络、ASN、VPN / 代理 / Tor / 机房标记和 IPQuery 返回的风险分。缺失字段显示未知；失败时使用 ipwho.is，仅提供归属地。
- **22 个分流探针**：网易、字节跳动、Cloudflare、Discord、Visa、X、ChatGPT、Claude、Grok、OpenAI、Anthropic、Perplexity、npm 等。读取目标返回的 trace 或可读响应头中的实际源 IP，再查询国家、归属地与 ASN；不使用后端出口冒充。
- **30 个网站服务探针**：AI、影音、国际网站、国内网站和开发工具分类。显示实际请求的资源地址，提供“打开验证”入口；探针响应与实际出口证据分别显示。
- **显示隐私控制**：IP 默认脱敏，可切换显示；同时覆盖首页、分流表、详情弹窗、双栈工具和历史。复制和导出包含真实 IP，界面会明确标明。
- **自动检测与停止**：进入相关页面自动检测一次，可关闭；无持续刷新或常驻任务。停止会关闭自动检测，避免立即重启。
- **辅助工具**：IP 查询、IPv4 / IPv6、WebRTC、DNS 三源解析对照、HTTPS 连接质量与抖动采样、两档流量测速。
- **自定义目标与重试**：检测任意公网 HTTPS 网站；服务卡片与分流行可单独重试，完整报告可导出 JSON / CSV。
- **检测点备用与慢速网络**：首页首选源失败后自动尝试备用，并明确显示实际成功域名；标准超时 12 秒，慢速模式 20 秒。分流表不会用其他站点替换目标。
- **本机记录**：全面检测完成后保存最近 20 条，可补充节点备注、清除历史、导出包含分流结果的 JSON / CSV 报告。
- 浅色默认、深色切换、手机适配、横向可滚动的分流表、键盘可操作的原生详情弹窗。

## 在 Render 部署

1. 点击 **Deploy to Render**，登录 Render 并连接有权限访问此仓库的 GitHub 账号。
2. 确认 **Free** 计划与 **Singapore** 区域，创建 Blueprint。
3. 等状态变为 **Live**，打开分配的 `https://…onrender.com`。
4. 访问 `/healthz` 应返回 `{"status":"ok","app":"speedlens","version":"1.2.1"}`，然后在你实际使用 VPN 的浏览器中检查。

不需要数据库、API Key 或付费依赖。后续推送 `main` 自动部署。

手动创建 **Web Service** 时使用：

| 项目 | 值 |
| --- | --- |
| Runtime / Region / Plan | Node / Singapore / Free |
| Build Command | `npm ci --ignore-scripts && npm run check && npm test` |
| Start Command | `npm start` |
| Health Check Path | `/healthz` |
| Environment | `NODE_ENV=production`，`TRUST_RENDER_PROXY=1` |

Node 版本由 `.node-version` 固定，服务监听 `0.0.0.0:$PORT`。Render 免费服务可能休眠，首次打开需等待；采样下载消耗出站流量。限额和休眠行为以 [Render 文档](https://render.com/docs/free) 为准。仓库推送、本地测试或蓝图校验不等于线上验收，仍需确认控制台 Live、公开健康接口和实际浏览器结果。

## 使用方式与边界

首页直接查看各检测点出口与请求延迟。点击任意有效 IP 查看风险详情；进入“分流测试”比较每个实际探针的 IP、国家和 ASN。切换节点后重新检测，或在“全面检测”完成后填写备注并导出报告。

- **分流证据**：只把浏览器成功读取的真实 IP 作为证据。表格明确显示请求的实际域名；帮助站、CDN 子域名与主站可能命中不同规则。出口不同是分流线索，出口相同不能证明 VPN 关闭。
- **不可读的探针**：CORS、CORP / ORB、挑战页、超时、扩展或站点策略可能导致未确认。如果收到了网络响应却读不到出口，显示“已响应，出口不可读”。分流表失败时不会换成后端或另一网站的 IP；首页按检测类别启用备用源，会显示实际来源。
- **网站已响应**：`no-cors` 隐藏跨域 HTTP 状态；403 或验证页也可能收到响应。不能据此声称账号可用、地区支持、流媒体解锁或播放成功。
- **网站探针未确认**：失败仅表示本次资源请求未确认，不能判定网页打不开。ChatGPT、Claude、npm 使用各自同域名的 `/cdn-cgi/trace`，避免 `/favicon.ico` 被限制时漏报；trace 成功也不代表聊天等业务功能可用。卡片提供实际地址与“打开验证”，以你浏览器中的真实访问为准。
- **备用与跳转**：国内检测点改用备用站后不再参与国内／国际分流判断。可读的跨域跳转会显示最终响应域名，并保留原请求域名；不会把新域名的出口标成原检测点的证据。
- **纯净度参考**：IPQuery 风险分按源站字段显示，不自行制造“纯度百分比”。无标记不保证原生住宅或不触发风控；源站未提供的滥用字段保持未知。数据中心不等于恶意。
- **数据刷新**：页面 IP 详情缓存最多 15 分钟，沿用源数据查询时间；长时间打开页面后再次查询会刷新，第三方归属与风险仍可能存在误差。
- **延迟曲线**：首页小曲线只在同一页面已有至少两次真实采样时显示，最多保留六次，不生成模拟趋势。
- **测速**：默认 1.25 MiB、可选 5 MiB。异常会显示错误并恢复按钮；普通模式收发超时 45 秒、慢速模式 90 秒。只反映浏览器到本站节点的应用层小样本吞吐，含请求开销，不是宽带峰值或 ICMP Ping。
- **泄漏**：IPv6 失败或 WebRTC 无候选不能证明泄漏与否。mDNS 别名、双栈和路由会影响观察，本版本没有完整 DNS 泄漏测试。

## 隐私与资源

开启自动检测会向页面列出的第三方站点请求出口和连通性。IP 详情及分流归属查询将目标公网 IP 发往本站后端与 IPQuery；备用数据源是 ipwho.is。DNS 工具从浏览器访问 Cloudflare、Google、阿里 DNS；这是公共解析器对照，不是完整 DNS 泄漏测试。连接质量的失败率是 HTTPS 请求失败率，不是 ICMP 丢包率。自定义目标只接受公网 HTTPS，不接受内网地址、账号密码或特殊端口。网站服务请求不携带凭据，不读取登录账号和聊天内容。第三方和托管平台仍可能保留各自的访问日志。

历史只保存在浏览器 `localStorage`，服务器不保存检测历史，不接入统计或广告。应用不把访问 IP 或第三方响应写入日志。关闭自动检测后，进入页面不再主动发起第三方检测；已有请求可用停止按钮取消。

Cloudflare Worker 可以增加“访问该 Worker 时的出口”观测点、查询 IP 数据，或单独展示 Worker 到目标的连通性。Worker 的出站请求不经过用户本机 VPN；它不能代替浏览器判断用户到 ChatGPT 等网站的分流或实际访问，也不能让浏览器自动读取不允许跨域访问的目标响应。

- 无第三方 npm 依赖、无数据库或后台采集进程；Node 堆上限 192 MiB。
- 分流探针并发 3、单探针标准 12 秒 / 慢速 20 秒。IP 归属按地址合并请求，服务端最多缓存 256 条、15 分钟过期。
- 只允许查询公网 IP；固定 HTTPS 上游，不提供任意 URL 代理或端口扫描。
- 默认测速下载 1 MiB、上传 256 KiB；标准模式下载 4 MiB、上传 1 MiB；每 IP 每分钟最多 3 次、全站每分钟 10 次、每进程每 24 小时 20 次。流控下载、流式丢弃上传，最多 3 个并发传输。
- 限流与缓存是进程内数据，重启重置，不是云平台账单硬上限。数据源可能限额或变更策略，界面会保留未知状态。
- 反向代理头只在 `TRUST_RENDER_PROXY=1` 时读取，用于观察和尽力而为的限流，不用于身份认证。

## 本地开发

```bash
# Node.js 24
npm ci --ignore-scripts
npm run check
npm test
npm start
# http://localhost:3000
```

开发热重载：`npm run dev`。其他端口：`PORT=3100 npm start`。默认不信任外部传入的代理头。

`public/` 包含独立编写的浏览器界面、探针目录与解析器；`server.mjs` 提供 IP 查询与有界测速；`test/` 使用 Node 内置测试；`render.yaml` 提供免费部署配置。

MIT 许可证。第三方服务与探针来源见 [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md)。
