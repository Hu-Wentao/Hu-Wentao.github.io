---
title: "让网页版ChatGPT读写本地文件"
date: 2026-09-17T23:31:59+08:00
draft: false
---

网页版ChatGPT可以使用满血GPT-6-Astra, 但是无法读写本地文件, 编写代码.
于是我写了一个用于远程访问的FrelyMCP, 直接让网页ChatGPT化身Codex, 直接干活.

日常任务都不用消耗额度. 而高频编程任务可以通过GPT Work来使用, 没有限流, 原地起飞.

## 3步搞定, 让网页ChatGPT变成 ‘网页Codex’

### 1.安装CLI并获取MCP链接

```bash
npm install --global --ignore-scripts frely-cli@latest
```

安装后登录, 会打开浏览器登录. 没有账号就用邮箱注册.

```bash
frely login
```

![install-and-login](/posts/use-frely-mcp/PixPin_2026-09-17_22-49-37.png)

确认登录的是目标Frely账号, 在授权页点击‘Approve’.
> 若注册后没回到授权页, 重跑 `frely login`, 使用新链接.

![approve](/posts/use-frely-mcp/PixPin_2026-09-17_22-49-55.png)

完成后获取MCP地址, 复制备用:

```bash
frely mcp url
```

![get-frely-mcp-url](/posts/use-frely-mcp/PixPin_2026-09-17_22-52-00.png)

### 2.开启开发者模式

点击头像,打开设置 'Settings'

![go-chatgpt-settings](/posts/use-frely-mcp/PixPin_2026-09-17_22-41-47.png)

选择 'Security and login', 打开 'Developer Mode'. 界面以截图为例, 位置可能随版本变化.

![enable-developer-mode](/posts/use-frely-mcp/PixPin_2026-09-17_22-46-21.png)

### 3.添加自定义插件

点击插件 'Plugins', 再点击搜索框右侧的‘+’, 添加自定义插件.(开启 Developer Mode后出现)

![add-custom-plugin](/posts/use-frely-mcp/PixPin_2026-09-17_22-47-40.png)

填写插件名称、`frely mcp url` 返回的完整地址, 认证方式选择OAuth.
阅读权限提示, 勾选确认框后点击‘Create'.

![create-custom-plugin](/posts/use-frely-mcp/PixPin_2026-09-17_22-53-23.png)

点击‘Sign in with ...’, 跳转到Frely网站完成OAuth授权后返回.

![sign-in-with-plugin](/posts/use-frely-mcp/PixPin_2026-09-17_22-54-41.png)

在新对话中选中FrelyMCP.

![connection-ready](/posts/use-frely-mcp/PixPin_2026-09-17_22-56-12.png)

## 效果展示

快来体验网页Codex吧

![preview](/posts/use-frely-mcp/PixPin_2026-09-17_22-36-37.png)


连接失败运行 `frely doctor --mcp`; 
授权到期(默认90天授权一次, 最长180天)运行 `frely mcp renew` 并重新批准.
