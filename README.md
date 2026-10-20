# SpeedLens · 网络透镜

给经常使用 VPN、代理和分流规则的人，一个从**自己浏览器**观察网络的诊断台。

[![Deploy to Render](https://render.com/images/deploy-to-render-button.svg)](https://render.com/deploy?repo=https://github.com/fanxing724/speedlens)

## 功能

- **出口对照**：国内 `myip.ipip.net`、Cloudflare、IPv4 ipify、IPv6 ipify 分别返回它们看到的 IP。
- **分流线索**：仅对成功返回的国内与 Cloudflare 同协议 IP 进行对照；不会把普通网站连通性当成该网站出口证据。
- **IP 纯净度与风险**：IPQuery 归属地、ASN、VPN / 代理 / Tor / 数据中心字段，以及源站返回的风险分。未提供的滥用记录显示未知；失败时退到 ipwho.is，仅展示归属地。
- **18 个服务**：ChatGPT、Claude、Gemini、Google、YouTube、Telegram、GitHub、X、Netflix、Spotify、Disney+、Wikipedia、百度、哔哩哔哩、腾讯、淘宝、Cloudflare、npm。
- **WebRTC 观察**：用户主动启动后通过 STUN 收集可见候选地址，不请求摄像头或麦克风。
- **轻量测速**：到本站节点的 HTTP 延迟、下载 4 MiB、上传 1 MiB。独立启动，不包含在全面检测中。
- **本机记录**：最近 20 次完整检测，可填写节点备注、清除历史、导出最近完整检测的 JSON 报告。
- 深浅主题、窄屏适配、停止检测、超时和数据源故障处理。

## 在 Render 部署

1. 点击上方 **Deploy to Render**，登录你的 Render 账号。
2. 授权访问 `fanxing724/speedlens`，确认创建 Blueprint。若当前账号界面需要，先连接 GitHub。
3. 确认服务使用 **Free** 计划和 **Singapore** 区域，点击部署。
4. 等待状态变为 **Live**，打开 Render 分配的 `https://…onrender.com`。
5. 访问 `/healthz` 应返回 `{"status":"ok","app":"speedlens","version":"1.0.0"}`。随后在你实际使用 VPN 的浏览器中执行全面检测。

默认不需要数据库、API Key、付费依赖或额外环境变量。蓝图显式指定 Free 计划。

如果使用 **New → Web Service** 手动导入仓库：

| 配置 | 值 |
| --- | --- |
| Runtime | Node |
| Region | Singapore |
| Plan | Free |
| Build Command | `npm ci --ignore-scripts && npm run check && npm test` |
| Start Command | `npm start` |
| Health Check Path | `/healthz` |
| Environment | `NODE_ENV=production`，`TRUST_RENDER_PROXY=1` |

Node 版本由 `.node-version` 固定。服务监听 `0.0.0.0:$PORT`，无需手工设置 Render 的端口。后续推送 `main` 会自动部署。

Render 免费服务可能因闲置而休眠，首次打开需要等待；测试下载也占用托管平台的出站流量。代码限制每次采样最多 5 MiB、单 IP 每分钟 3 次、全站每分钟 10 次、每个进程每 24 小时最多 20 次。计数与缓存是进程内数据，重启后重置，不能当成平台账单硬上限。具体限额和休眠行为以 [Render 免费服务文档](https://render.com/docs/free) 为准。

本仓库提供可部署配置；**推送代码、通过本地测试或蓝图校验不代表 Render 已上线**。部署成功需要控制台 Live、公开健康接口和实际浏览器检测一起确认。

## 如何用来检查 VPN

1. 填写“香港 01 · 规则模式”等节点备注，然后启动全面检测。
2. 对照国内与 Cloudflare 返回的出口 IP，再检查 IPv4 与 IPv6。两种协议使用不同出口未必是泄漏，需要结合你期望的规则。
3. 查看当前观察出口的风险画像；也可点击检测点的 IP，或手动输入另一个公网 IP 查询。
4. 检查常用服务，必要时点击服务名称打开真实网站，验证登录、地区和播放。
5. 切换节点或分流模式，重新全面检测，在本机历史中比较，并按需导出报告。

### 结果边界

- **已响应 ≠ 服务可用或解锁**：网站测试使用无凭据的 `no-cors` HTTPS 请求。浏览器隐藏跨域 HTTP 状态，403、挑战页等也可能显示“已响应”。这不能证明 AI 账号可用、地区支持、流媒体解锁或播放成功。
- **未确认 ≠ 一定被封**：CORS、CORP / ORB、扩展、跟踪保护、DNS、超时和站点策略均可能影响测试。
- **响应时间 ≠ ICMP Ping**：这里是浏览器请求耗时，包含连接等开销。测速是应用层小样本吞吐，容易受节点地区、代理、冷启动、样本量影响。
- **分流只是采样**：仅有可读取 IP 的站点能提供出口证据。不能从 Google favicon、ChatGPT 或其他普通站点的响应推导该站看到的 IP。相同 IP 不能证明 VPN 关闭。
- **风险字段是第三方数据库判断**：不自行生成“纯度百分比”，不把缺失字段当作 false，也不把无标记说成原生住宅或保证不触发风控。IPQuery 当前提供的风险分按原样显示；这是其风险评估，不是本站的测量准确率。
- **WebRTC 不完整证明泄漏与否**：浏览器 mDNS、双栈和路由会影响候选；没有候选不等于安全。此版本没有完整 DNS 泄漏测试。

## 本地运行

需要 Node.js 24；生产和测试都只使用 Node 内置模块，没有 npm 第三方依赖。

```bash
npm ci --ignore-scripts
npm run check
npm test
npm start
# http://localhost:3000
```

开发时可以 `npm run dev`。使用其他端口：`PORT=3100 npm start`。默认不信任客户端传入的代理头。只有部署在已知反向代理后时才设置 `TRUST_RENDER_PROXY=1`；Render 配置已设置该项。代理头仅用于本站观察信息和尽力而为的限流，不用于认证。

## 隐私、资源与实现

- 用户点击检测前，只向本站请求静态资源和节点说明，不预先联系第三方检测点。
- 出口、网站和 STUN 请求从浏览器发出，经过用户当前 VPN 路径；Render 后端不代替浏览器做网站连通性测试。
- IP 风险查询由后端访问固定 HTTPS 数据源。目标只能是公网 IPv4 / IPv6；不接受任意 URL、不提供端口扫描或通用代理。
- 后端仅缓存最多 256 条风险查询，15 分钟过期；同 IP 并发合并、外部查询并发上限 4、请求超时、查询限流。数据源仍可能限额或更新策略，界面会保留未知状态。
- 单次网站检测并发 3、每目标最多 7 秒。测速最多 3 个并发传输，随机数据块复用并尊重流控，上传流式丢弃。Node 堆上限 192 MiB，无常驻任务或数据库。
- 服务器不保存检测历史、Cookie、账号或聊天内容；应用不记录请求 IP 或第三方响应到控制台。不接入广告或分析服务。Render 与第三方站点仍可能有各自的访问日志。
- 历史记录只在浏览器 `localStorage`。清除历史不会删除已经导出的文件或托管平台的访问日志。
- 报告包含检测到的 IP、风险字段和节点备注；分享前请检查内容。

## 项目结构

```text
public/           原生浏览器前端、样式、检测目标和结果逻辑
server.mjs        Node HTTP 服务、风险查询和有界测速
test/             Node 内置测试：风险未知、分流、限流与上传下载约束
render.yaml       免费 Render Web Service 配置
```

界面与实现独立编写。MIT 许可证；第三方接口归属和结果含义见 [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md)。
