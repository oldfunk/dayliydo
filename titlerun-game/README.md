# TitleRun 游戏隐藏信息注入器

通过零宽字符将文字信息注入网页标题栏，滚动页面即可实时解码。支持空格、换行、制表符等常见空白字符的隐写，适合用于在标题栏中隐藏便签、密码、短密文等。

## 核心机制

- **零宽字符隐写**：将空格、换行、制表符等空白字符映射为不可见的零宽 Unicode 字符，嵌入到网页标题中。
- **滚动解码**：监听页面滚动事件，实时从 document.title 读取隐写内容并解码显示。
- **双按钮模式**：提供「生成密文」与「解码显示」两个入口，既可手动解码，也可依赖滚动自动解码。

## 玩法

1. 打开 `index.html`。
2. 在输入框中输入要隐藏的文字（可含空格、换行、制表符等）。
3. 点击「生成密文」，页面标题会自动更新为隐写后的文本。
4. 滚动页面，下方的结果区域会实时显示解码后的内容。
5. 点击「解码显示」可手动触发一次解码。
6. 点击「清空」可重置所有状态。

## 技术细节

- 使用 5 种零宽字符：ZERO_WIDTH_SPACE、ZERO_WIDTH_JOINER、ZERO_WIDTH_NON_JOINER、ZERO_WIDTH_NO_BREAK_SPACE、ZERO_WIDTH_OMITTED。
- 空格 → ZERO_WIDTH_SPACE；换行 → ZERO_WIDTH_JOINER；制表符 → 3×ZERO_WIDTH_JOINER；回车 → ZERO_WIDTH_JOINER；零宽字符 → ZERO_WIDTH_OMITTED。
- 纯 HTML/CSS/JS，零外部依赖，离线可用。
