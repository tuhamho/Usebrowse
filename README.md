# Usebrowse

Usebrowse is a local-first browser agent built as an independent implementation. It pairs a Chrome/Edge side panel with a small local bridge and an OpenAI-compatible model endpoint. Page actions that can change state ask for approval in the side panel.

## Current features

- Reads the active page, its links, fields, and buttons; lists tabs.
- Navigates across tabs, opens/closes/switches tabs, clicks, fills forms, scrolls, waits for text, reloads, and moves through tab history.
- Remembers the recent chat locally in the extension.
- Human approval before navigation, clicking, filling, reload, and history actions.
- Local bridge bound to `127.0.0.1`, pairing code, and an MCP stdio server.
- Works with Ollama or an OpenAI-compatible endpoint. No app account or telemetry is built in.

This is an initial implementation. It does not yet include the desktop installer, voice input, scheduled tasks, downloads/uploads, multi-browser support beyond Chromium, or every feature of mature browser agents.

## Requirements

- Node.js 20 or newer.
- Chrome or Edge with developer mode enabled.
- Ollama with a model that supports tool calling, or another OpenAI-compatible chat-completions endpoint that supports tools.

## Run

```powershell
cd usebrowse
npm install
Copy-Item .env.example .env
npm start
```

The bridge prints a pairing code. Load the `extension/` folder as an unpacked extension from `chrome://extensions` or `edge://extensions`, open Usebrowse's side panel, expand **Pair this browser**, and enter the code.

The default model endpoint is Ollama at `http://127.0.0.1:11434/v1`, model `qwen2.5:7b`. Pull that model in Ollama first. To use another compatible service, edit `.env`:

```dotenv
USEBROWSE_BASE_URL=https://your-endpoint.example/v1
USEBROWSE_MODEL=your-tool-capable-model
USEBROWSE_API_KEY=your-key
USEBROWSE_PORT=18791
```

## MCP client

Start the bridge first, then point an MCP client at the stdio command:

```json
{
  "mcpServers": {
    "usebrowse": {
      "command": "node",
      "args": ["C:/path/to/usebrowse/bridge/mcp.js"]
    }
  }
}
```

The MCP server reads the pairing code from `~/.usebrowse/pairing-code`. Keep the bridge running and the browser paired. Mutating MCP calls also require approval in the browser side panel.

## Security notes

The bridge only listens on loopback. The pairing code is stored in `~/.usebrowse/pairing-code` with owner-only permissions on systems that support them. Treat page contents as untrusted. Approve only actions you intend to run; a model can make mistakes. API keys are read from `.env` and should never be committed.
