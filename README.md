# dayliydo — 每日一个小成品

每晚 21:00–07:00，Hermes 在此目录自主开发一个「可下线、可展示」的单功能小工具。

## 约定
- 每个项目一个独立文件夹（kebab-case 命名），内含自包含 `index.html`，双击即可离线打开运行。
- 纯 HTML/CSS/JS，零外部依赖、零 CDN、零网络请求——保证离线可用、便于展示。
- 只解决一件小事；UI 干净现代、深色友好、响应式、可展示级。
- 可附 `README.md` 说明玩法。
- 不引入构建步骤（无 npm / 打包），打开即用。

## 目录索引
|||| 项目 | 文件夹 | 说明 ||
|||---|---|---|---|
||| 番茄钟 · 专注计时 | [pomodoro](pomodoro/) | 圆形进度专注计时，自动切换休息 ||
||| 随机决策转盘 | [decision-wheel](decision-wheel/) | 自定义选项转盘，一键旋转定夺 ||
||| 本地便签 | [local-notes](local-notes/) | Markdown笔记，自动本地保存、实时预览 ||
||| 零宽密信 | [invisible-cipher](invisible-cipher/) | 零宽 Unicode 隐写，把密文藏进普通文字，可选密码 ||
||| 新标签页弹球 | [newtab-brick-breaker](newtab-brick-breaker/) | 新标签页空白画布弹球，游戏即页面本身 ||
||| 标题栏隐写游戏 | [titlerun-game](titlerun-game/) | 将文字注入标题栏，滚动解码，零宽字符隐写 ||
||| URL 隐写链接 | [url-stego-link](url-stego-link/) | 把秘密藏在 URL hash 中，生成可分享的隐写链接 ||
||| 同形字密写 | [glyph-cipher](glyph-cipher/) | 同形字替换隐写（西里尔/希腊字母替换拉丁字母，文本长度不变） ||
||| 星图共振 | [broadcast-constellation](broadcast-constellation/) | Broadcast Channel API 跨标签页实时同步星座，零服务器 ||
||| 跨标签粒子喷泉 | [broadcast-particle-fountain](broadcast-particle-fountain/) | 确定性事件溯源模拟：仅同步发射事件，各标签自运行物理引擎，零位置流量 |
| 神谕卡牌 | [oracle-deck](oracle-deck/) | TRPG 三级递进神谕判定，命运权重系统，自定义牌组 |
| 战斗回合追踪器 | [initiative-tracker](initiative-tracker/) | 圆形时间环 + 效果衰减 + 自动轮转 ||

---
生成与维护：Hermes 夜间定时任务（每天 21:00 / 00:00 / 04:00 各开发一件）。