# The Birthday MCP

A locally runnable prototype of an MCP-controlled birthday website. Prime opens the site, connects an MCP-compatible agent, and says:

> Use the Birthday MCP and follow its instructions.

The browser is the visual stage. The MCP client is the controller. The server owns all game state.

This is a **simulated** Linux desktop. It never executes real commands, never reads real files, and never calls a language model.

## Stack

- React + Vite
- Node.js + Express
- Official MCP TypeScript SDK v2 (`@modelcontextprotocol/server`, Streamable HTTP)
- WebSockets for browser sync
- Vitest

## Setup

Requires Node.js 20+.

```bash
npm install
```

## Run locally

```bash
npm run dev
```

Open [http://127.0.0.1:8787](http://127.0.0.1:8787).

The dev server serves the React app, the JSON API, WebSockets, and a stable MCP endpoint on **one port** (default `8787`).

Optional environment variables:

| Variable | Default | Purpose |
| --- | --- | --- |
| `HOST` | `127.0.0.1` | Bind address |
| `PORT` | `8787` | Listen port |
| `PUBLIC_URL` | `http://$HOST:$PORT` | Origin used in generated MCP URLs |
| `SESSION_TTL_MS` | `7200000` (2 hours) | Inactive session expiry |
| `NODE_ENV` | unset in `npm run dev` | `production` hides `/api/dev` routes |

## Play the experience

1. Click **Create Session**.
2. Copy the MCP config once (`http://127.0.0.1:8787/mcp`). Resetting the site does not change this URL.
3. Keep the website open.
4. Start a new conversation with an MCP-compatible agent and say: **Use the Birthday MCP and follow its instructions.**
5. The agent must call `start_game` first. After that, every valid tool call updates the open browser.

Connection state is shown in the top bar: Waiting for agent → Agent connected → Experience running → Complete.

Refreshing the page restores the public session from `localStorage` plus a server snapshot.

## Connect an MCP client

There is no universal one-click setup. Clients differ.

### MCP Inspector (verified)

This prototype is verified against Inspector v2:

```bash
npx @modelcontextprotocol/inspector@latest
```

Paste the MCP URL from the website:

```text
http://127.0.0.1:8787/mcp
```

Transport: Streamable HTTP.

Then call `start_game`. The open website should boot the simulated desktop.

CLI check without the UI:

```bash
npx @modelcontextprotocol/inspector@latest --cli --transport http --server-url http://127.0.0.1:8787/mcp --method tools/list

npx @modelcontextprotocol/inspector@latest --cli --transport http --server-url http://127.0.0.1:8787/mcp --method tools/call --tool-name start_game
```

`npx @modelcontextprotocol/inspector` without `@latest` may still resolve to the deprecated v1 Inspector. Use `@latest` (v2) with this server.

### Generic JSON config

The website shows a copyable example of the form:

```json
{
  "mcpServers": {
    "birthday-mcp": {
      "url": "http://127.0.0.1:8787/mcp",
      "transport": "http"
    }
  }
}
```

Cursor, Claude Desktop, Codex, and others historically prefer stdio servers. Remote Streamable HTTP support is client-specific and still uneven. If a client cannot attach to an HTTP MCP URL, use MCP Inspector against `http://127.0.0.1:8787/mcp`. That path is what this prototype verifies.

The session code (`PRIME-XXXX`) is a human label. MCP always targets the live website session, so you can reset or create a new session without changing client config.

## Development panel

Open:

```text
http://127.0.0.1:8787/?dev=1
```

The panel calls the **same server tool handlers** as MCP. It can simulate every tool, inspect state, reset, and copy the event log. It is not mounted when `NODE_ENV=production`.

## Verification commands

```bash
npm test
npm run typecheck
npm run lint
npm run build
```

Production run after a build:

```bash
npm start
```

`npm start` expects `npm run build` first and listens on `PORT` (default 8787).

## Architecture

- `src/content/index.ts` — all authored copy, files, commands, and insults
- `src/game/` — deterministic state machine (no HTTP, no LLM)
- `src/server/` — Express, Streamable HTTP MCP, in-memory sessions, WebSockets
- `src/web/` — React desktop that only renders authoritative server state

MCP tool calls mutate session state, then broadcast a versioned event to that session’s browser. Invalid or repeated calls return structured errors and do not skip stages.

## Safety

The fake filesystem and shell are in-memory lookup tables. Unknown commands return a simulated `birthdaysh` error. User text is rendered as React text nodes, not HTML.
