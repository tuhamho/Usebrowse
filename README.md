# Usebrowse · tuhamho-brow

Usebrowse is a personal build of [Browsentic](https://github.com/imshaikot/browsentic), an agentic browser harness that runs an AI agent you are already signed in to inside your real browser. Its browser extension is named **tuhamho-brow**. The extension, local Bridge, desktop app sources, and MCP server are included.

## Quick start from this source tree (Windows)

Requirements: Node.js 20+, Windows, and a supported agent CLI such as Codex or Claude Code already installed and signed in.

```powershell
node scripts/setup.mjs
node src/daemon/scripts/stage-extension.mjs
corepack yarn daemon:link
browsentic setup --no-self-update --unpacked --browser chrome
```

The setup command prints where it wrote the unpacked extension and a pairing code. In Chrome, open `chrome://extensions`, enable **Developer mode**, choose **Load unpacked**, and select the printed folder. Open the tuhamho-brow side panel, enter the pairing code if prompted, then ask it to work on the current page. For Edge, replace `chrome` with `edge` and use `edge://extensions`.

Keep the Bridge running in the background. Its CLI commands are `browsentic status`, `browsentic stop`, `browsentic start`, and `browsentic pair`.

## What it includes

The complete upstream feature set is present: browser side panel and Home composer, local Bridge and agent CLI integration, page and tab actions, approvals and guardrails, saved tools and skills, recordings, scheduled tasks, downloads, voice and point-at-page interactions, MCP server, and desktop app projects. See [`docs/`](docs/) for the guides and architecture.

## Upstream and license

This repository is derived from Browsentic and keeps its Apache 2.0 license and original project notices. See [UPSTREAM.md](UPSTREAM.md) for source and attribution. Usebrowse is not affiliated with the original maintainers.
