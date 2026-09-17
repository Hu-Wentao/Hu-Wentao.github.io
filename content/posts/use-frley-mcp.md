---
title: "如何拯救被降智的ChatGPT账号?"
date: 2026-09-17T23:31:59+08:00
draft: false
---

网页版ChatGPT可以使用满血GPT-6-Astra, 但是无法读写本地文件, 编写代码.
于是我写了一个用于远程访问的FrelyMCP, 直接让网页ChatGPT化身Codex, 直接干活.

日常任务都不用消耗额度. 而高频编程任务可以通过GPT Work来使用, 没有限流, 原地起飞.

## 操作步骤

### 1.安装本地cli, 登录后获取mcp链接

一行命令安装

```bash
npm install --global --ignore-scripts frely-cli@latest
```

安装完成后就登录, 此时会打开浏览器. 没有账号的直接邮箱注册一个

```bash
frely login
```

![install-and-login](/posts/use-frely-mcp/PixPin_2026-09-17_22-49-37.png)

如果没有账号就用邮箱注册一个, 已登录状态下在授权页面点击‘approve’, 即可完成本地登录.

![approve](/posts/use-frely-mcp/PixPin_2026-09-17_22-49-55.png)

此时再输入frely mcp url, 就能获得本机的mcp地址, 复制备用.

```bash
frely mcp url
```

![get-frely-mcp-url](/posts/use-frely-mcp/PixPin_2026-09-17_22-52-00.png)

### 2.打开ChatGPT-web的开发者模式(Developer Mode)

点击头像,打开设置 'Settings'

![go-chatgpt-settings](/posts/use-frely-mcp/PixPin_2026-09-17_22-41-47.png)

选择安全与登录 'Security and login', 打开 'Developer Mode'

![enable-developer-mode](/posts/use-frely-mcp/PixPin_2026-09-17_22-46-21.png)

### 3.在ChatGPT-web添加自定义插件(需要已经开启 Developer Mode)

点击插件’Plugins', 如果已经开启开发者模式,则搜索框右侧会出现‘+’, 点击即可添加自定义插件.

![add-custom-plugin](/posts/use-frely-mcp/PixPin_2026-09-17_22-47-40.png)

在对话框配置插件的名称, 连接地址(就是通过`frely mcp url`获取到的url).
勾选复选框后点击创建‘create'

![create-custom-plugin](/posts/use-frely-mcp/PixPin_2026-09-17_22-53-23.png)

此时弹出登录到插件的对话框, 点击‘sign in with ...‘会短暂跳转到frely网站然后再返回.

![sign-in-with-plugin](/posts/use-frely-mcp/PixPin_2026-09-17_22-54-41.png)

此时就添加成功了, 快去体验一下网页版Codex吧!

![alt text](/posts/use-frely-mcp/PixPin_2026-09-17_22-56-12.png)

## 效果展示

直接访问到本地代码仓库,并执行命令

![preview](/posts/use-frely-mcp/PixPin_2026-09-17_22-36-37.png)
