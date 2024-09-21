# 多端带壳网站预览工具

[示例网站](https://prtsc.liushen.fun) | [个人主页](https://www.liushen.fun)

## 项目简介
本项目基于 [himkiong 的 multiterminal-preview](https://github.com/himkiong/multiterminal-preview) 进行开发，旨在生成多端设备（手机、平板、笔记本、电脑）预览图，通过 `iframe` 实现实时网站预览，并展示不同设备外壳的截图效果。用户可以在不同设备之间切换预览，支持自定义网址输入。

## 功能特点
- 支持手机、平板、笔记本和电脑的预览。
- 实时显示目标网站内容，便于多设备兼容性测试。
- 可选择是否显示滚动条，模拟真实的浏览体验。
- 自定义输入不同设备的预览网址，灵活性强。

## 使用方法
1. 克隆项目到本地：
   ```bash
   git clone https://github.com/willow/multi-terminal-screenshot.git
   ```
2. 安装依赖：
   ```bash
   npm install
   ```
3. 启动项目：
   ```bash
   npm run serve
   ```
4. 在浏览器中打开 `localhost:5173`，即可访问多端预览工具。

## 文件结构
- `src/`: 项目主要代码。
- `public/`: 静态资源存放文件夹（如 favicon）。
- `index.html`: 项目的 HTML 入口文件。

## 贡献指南
本项目欢迎任何形式的改进和建议！如果你有好的想法，欢迎提交 PR。