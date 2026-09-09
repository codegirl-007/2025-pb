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

Open [http://127.0.0.1:8790](http://127.0.0.1:8790).

The dev server serves the React app, the JSON API, WebSockets, and MCP on **one port** (default `8790`).

Optional environment variables:

| Variable | Default | Purpose |
| --- | --- | --- |
| `HOST` | `127.0.0.1` | Bind address |
| `PORT` | `8790` | Listen port |
| `PUBLIC_URL` | `http://$HOST:$PORT` | Origin used in generated MCP URLs |
| `SESSION_TTL_MS` | `7200000` (2 hours) | Inactive session expiry |
| `NODE_ENV` | unset in `npm run dev` | `production` hides `/api/dev` routes |

## Play the experience

1. Open the birthday website.
2. Click **Create Session**. The website creates a game session and a session-specific MCP URL.
3. Copy the generated MCP config (or URL) and add that MCP server to Cursor.
4. Keep the website open.
5. Tell Cursor: **Use the Birthday MCP and follow its instructions.**
6. Cursor calls `start_game`. MCP actions control only that browser game.

Example Cursor config (the token is unique per session):

```json
{
  "mcpServers": {
    "birthday-mcp": {
      "url": "http://127.0.0.1:8790/mcp/<secretToken>"
    }
  }
}
```

In production the origin is `https://www.theprimeagenbirthday.com` and the path is still `/mcp/<secretToken>`.

Connection state is shown in the top bar: Waiting for agent → Agent connected → Experience running → Complete.

Refreshing the page restores the public session from `localStorage` plus a server snapshot. The secret token is not part of public game state or WebSocket payloads.

### Reset Game vs Disconnect

**Reset Game**

- Starts the birthday game over
- Keeps the same MCP connection and URL
- Does not require reconnecting Cursor
- Call `start_game` again to replay

**Disconnect**

- Destroys the session
- Invalidates the MCP URL
- Create a new session to play again

## Connect an MCP client

There is no universal one-click setup. Clients differ.

### Cursor

Paste the session-specific config from the website into Cursor MCP settings. Then start a conversation with: **Use the Birthday MCP and follow its instructions.**

This server does not use OAuth. Cursor should connect and call tools without an Authorization header.

### MCP Inspector (verified)

This prototype is verified against Inspector v2:

```bash
npx @modelcontextprotocol/inspector@latest
```

Paste the **session-specific** MCP URL from the website:

```text
http://127.0.0.1:8790/mcp/<secretToken>
```

Transport: Streamable HTTP.

Then call `start_game`. The open website should boot the simulated desktop.

CLI check without the UI (use the URL shown on the website):

```bash
npx @modelcontextprotocol/inspector@latest --cli --transport http --server-url http://127.0.0.1:8790/mcp/<secretToken> --method tools/list

npx @modelcontextprotocol/inspector@latest --cli --transport http --server-url http://127.0.0.1:8790/mcp/<secretToken> --method tools/call --tool-name start_game
```

`npx @modelcontextprotocol/inspector` without `@latest` may still resolve to the deprecated v1 Inspector. Use `@latest` (v2) with this server.

A shared `/mcp` route still exists for local inspector experiments against the most recently created or claimed session. Generated website config always uses `/mcp/<secretToken>` so concurrent players stay isolated.

## Development panel

Open:

```text
http://127.0.0.1:8790/?dev=1
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

`npm start` expects `npm run build` first and listens on `PORT` (default 8790).

## Architecture

- `src/content/index.ts` — all authored copy, files, commands, and insults
- `src/game/` — deterministic state machine (no HTTP, no LLM)
- `src/server/` — Express, Streamable HTTP MCP, in-memory sessions, WebSockets
- `src/web/` — React desktop that only renders authoritative server state

MCP tool calls mutate session state, then broadcast a versioned event to that session’s browser. Invalid or repeated calls return structured errors and do not skip stages.

Each website session has a secret MCP token used only for routing (`/mcp/<token>`). Reset increments a generation counter so in-flight work from before the reset cannot mutate the new game.

## Safety

The fake filesystem and shell are in-memory lookup tables. Unknown commands return a simulated `birthdaysh` error. User text is rendered as React text nodes, not HTML.
