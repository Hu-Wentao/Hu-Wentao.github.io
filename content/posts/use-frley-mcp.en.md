---
title: "Let Web ChatGPT Read and Write Local Files"
date: 2026-09-17T23:31:59+08:00
draft: false
publish:
  autoSyndication: false
---

Web ChatGPT can use the full GPT-6-Astra, but it cannot read or write local files, nor can it write code. So I built FrelyMCP for remote access, turning web ChatGPT into a Codex that gets straight to work.

Everyday tasks consume no quota at all. High-frequency coding tasks can go through GPT Work with no rate limits — instant takeoff.

## Set Up in 3 Steps: Turn Web ChatGPT into "Web Codex"

### 1. Install the CLI and Get the MCP URL

```bash
npm install --global --ignore-scripts frely-cli@latest
```

After installing, run login — it opens a browser for you to sign in. No account? Register with your email.

```bash
frely login
```

![install-and-login](/posts/use-frely-mcp/PixPin_2026-09-17_22-49-37.png)

Make sure you are logged in with the intended Frely account, then click "Approve" on the authorization page.
> If you were not redirected back to the authorization page after registering, re-run `frely login` and use the new link.

![approve](/posts/use-frely-mcp/PixPin_2026-09-17_22-49-55.png)

Once approved, get the MCP URL and copy it for later:

```bash
frely mcp url
```

![get-frely-mcp-url](/posts/use-frely-mcp/PixPin_2026-09-17_22-52-00.png)

### 2. Enable Developer Mode

Click your avatar to open "Settings".

![go-chatgpt-settings](/posts/use-frely-mcp/PixPin_2026-09-17_22-41-47.png)

Go to "Security and login" and turn on "Developer Mode". The screenshots show the current UI as an example; the exact location may vary by version.

![enable-developer-mode](/posts/use-frely-mcp/PixPin_2026-09-17_22-46-21.png)

### 3. Add a Custom Plugin

Open "Plugins", then click the "+" to the right of the search box to add a custom plugin (it appears after Developer Mode is enabled).

![add-custom-plugin](/posts/use-frely-mcp/PixPin_2026-09-17_22-47-40.png)

Fill in the plugin name and the full URL returned by `frely mcp url`, and choose OAuth as the authentication method.

Review the permission notice, check the confirmation box, then click "Create".

![create-custom-plugin](/posts/use-frely-mcp/PixPin_2026-09-17_22-53-23.png)

Click "Sign in with ..." to be redirected to the Frely site, complete the OAuth authorization there, and come back.

![sign-in-with-plugin](/posts/use-frely-mcp/PixPin_2026-09-17_22-54-41.png)

Select FrelyMCP in a new conversation.

![connection-ready](/posts/use-frely-mcp/PixPin_2026-09-17_22-56-12.png)

## In Action

Go try Web Codex.

![preview](/posts/use-frely-mcp/PixPin_2026-09-17_22-36-37.png)

If the connection fails, run `frely doctor --mcp`;
if the authorization expires (one approval every 90 days by default, up to 180 days), run `frely mcp renew` and approve again.
