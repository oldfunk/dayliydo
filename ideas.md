# dayliydo — 灵感日志

## 2026 年 10 月主题：TRPG 桌面工具
计划 3 件作品：
1. oracle-deck（神谕卡牌）—— 三级递进神谕 + 命运权重 + 自定义牌组
2. initiative-tracker（战斗回合追踪器）—— 圆形时间环 + 效果衰减
3. encounter-table（随机遭遇表）—— 加权随机 + 命运种子

不再预填待办清单。每晚任务开始时强制联网调研（GitHub Trending / Hacker News / Reddit / Product Hunt / 独立开发者社区），现场寻找「工作轻量 + 简单 + 填补空白」的方向。

## 定题标准
- 必须有一个别人没想到的**核心机制**（行为设计 / 视角转换 / 巧妙约束），不是功能堆砌
- 单个 HTML 文件可承载，无构建、无后端
- 能用一句话说清「它巧在哪」，说不清就换题

## 禁做题（永久跳过）
番茄钟、待办清单、各类计算器、时钟/天气、密码生成器、二维码、打字测试、单位换算等一切「前端练手作业」级选题。

## 已完成项目（勿重复机制）
|| 日期 | 项目 | 核心机制 |
| --- | --- | --- | --- |
| 2026-08-21 | pomodoro（已弃） | — 平庸示范品 |
| 2026-08-21 | decision-wheel | 自定义选项转盘，一键旋转定夺 |
| 2026-08-22 | local-notes | Markdown笔记，自动本地保存、实时预览 |
| 2026-08-29 | invisible-cipher | 零宽 Unicode 隐写（普通文本载体） |
| 2026-08-31 | titlerun-game | 零宽 Unicode 隐写（文档标题栏载体） |
| 2026-09-02 | url-stego-link | 零宽 Unicode 隐写（URL fragment 载体） |
| 2026-09-04 | broadcast-constellation | Broadcast Channel API 跨标签页同步星座 |
| 2026-09-08 | broadcast-particle-fountain | 确定性事件溯源：仅同步发射事件，各标签自运行物理引擎 |
| 2026-09-10 | glyph-cipher | 同形字替换隐写（西里尔/希腊字母替换拉丁字母） |
| 2026-10-01 | oracle-deck | 三级递进神谕 + 命运权重 + 自定义牌组 |

--- 
## 灵感日志
<!-- 格式：日期 | 来源链接 | 一句话灵感 | 定题理由 -->
2026-09-10 | 接替开发 | https://github.com/abatsakidis/GhostText-Unicode-Homoglyph-Steganography | 同形字替换隐写：用西里尔字母替换拉丁字母隐藏消息 | 补完 README 索引中已存在但未实现的 glyph-cipher，完成隐写家族第四作：同形字替换机制（区别于零宽插入），文本长度不变，肉眼不可辨
2026-09-05 | https://github.com/abatsakidis/GhostText-Unicode-Homoglyph-Steganography | 同形字隐写：用西里尔字母替换拉丁字母隐藏消息 | 定题「同形字密写」的灵感补充，确认了替换式隐写的可行性和展示价值
2026-09-08 | https://developer.mozilla.org/en-US/blog/exploring-the-broadcast-channel-api-for-cross-tab-communication/ | Broadcast Channel API 跨标签通信实战指南：状态同步、协作编辑、通知广播 | 系列开发「跨标签粒子喷泉」：broadcast-constellation 用「状态广播」模式，本作展示「事件溯源+确定性重放」模式——同 API 两种根本范式，零位置流量同步动态粒子系统，鬼影光标可视化远端交互
2026-09-04 | https://github.com/bernardogv/petri | 繁殖型反应扩散图案生成（基因组 + 杂交 + 突变） | 虽然未采用其算法，但启发方向：「利用浏览器原生 API 创造跨标签页实时协作体验」。Broadcast Channel 是标准但冷门的 API，用它实现共享星座是巧妙利用——`file://` 下多标签同源即可通信，零服务器
2026-09-04 | https://news.ycombinator.com/item?id=46036908 | Show HN: 互动 HN 模拟器 | 启发「用浏览器机制做文章」：HN 模拟器用 LLM，我用 Broadcast Channel 做真实跨标签同步——不依赖 AI，依赖浏览器原生机制本身即是巧思
2026-09-02 | https://stegzero.com/ | 用零宽字符在 URL fragment 中隐藏消息，生成看起来完全正常的链接 | 定题「URL 隐写链接」：把 URL fragment 作为第三个浏览器原生 UI 隐写点（继 invisible-cipher 用普通文本、titlerun-game 用 document.title 之后），适合需要「可分享链接」的场景，刷新后仍保持隐写内容
2026-08-26 | https://news.ycombinator.com/item?id=23400911 | 地址栏贪吃蛇游戏 | 利用浏览器地址栏作为游戏画布，创造最小交互空间内的游戏体验
2026-08-29 | https://dawid.ai/stegano/ | 隐形 Unicode 隐写（零宽字符把密文藏进可见文本，AI 可读人眼不可见） | 定题「零宽密信」：用零宽 Unicode 当墨水把秘密编入任意载体文字，加 SHA-256 流密码密码层 + 长度前缀帧，纯离线单文件可展示
2026-08-30 | https://news.ycombinator.com/item?id=45408021, https://chromewebstore.google.com/detail/empty-new-tab-page/dpjamkmjmigaoobjbekmfgabipmfilij | 新标签页空白画布弹球游戏 | 利用浏览器新标签页的空白画布做游戏，游戏即页面本身，无额外 UI
2026-08-31 | https://news.ycombinator.com/item?id=23400911 | 标题栏隐写游戏 TitleRun | 将文字信息隐藏在网页标题栏中，通过滚动交互解码，创造「网页隐写术」体验
