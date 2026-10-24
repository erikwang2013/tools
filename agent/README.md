# Postwoman Agent

Local WebSocket agent that gives the Postwoman web app access to raw TCP and UDP sockets.
It binds to `127.0.0.1` only; it cannot be reached from other machines.

## Start

From the repository root:

```bash
npm --prefix agent install
npm run agent
```

The agent prints the listening URL, the token and the allowed origins:

```
Postwoman Agent listening on ws://127.0.0.1:3567/agent
Token: 1f0c...<random hex>
Allowed origins: https://postwoman.erik.xyz, http://localhost:3000, http://127.0.0.1:3000
Press Ctrl+C to stop.
```

Every start with `Ctrl+C` or `SIGTERM` closes open sessions and exits cleanly.

### Options

| Flag | Meaning | Default |
| --- | --- | --- |
| `--port <n>` | WebSocket/HTTP port; `0` picks a free port | `3567` |
| `--token <value>` | Use a fixed token instead of a random one | random per start |
| `--origin <url>` | Adds an allowed CORS Origin; repeat for several | default list |
| `--config <file>` | MCP server config file instead of `agent/config.json` | `agent/config.json` when present |
| `--host <host>` | Only `127.0.0.1` is accepted | `127.0.0.1` |

If the port is taken (for example, an earlier agent is still running), the agent prints
`Port <port> is already in use. Start with --port <other>.` and exits with status 1.

## Token

The token is printed at startup and is required for every WebSocket connection; connections
with a wrong token are closed immediately. Without `--token` a new random token is generated
each start, so paste the printed token into the app's agent settings after every restart.
Keep the token private: anyone on this machine who has it can open sockets through the agent.

## Origins

Only browser pages served from an allowed Origin may connect. The default allowlist is
`https://postwoman.erik.xyz`, `http://localhost:3000` and `http://127.0.0.1:3000`, and it
always stays allowed. `--origin` adds to it (repeat the flag for several); a dev server on
another port needs `--origin http://localhost:<port>`. Matching is exact (scheme, host and
port), and duplicates are ignored.

## Browser support

The page runs on HTTPS and connects to the loopback agent, so Chrome and Edge show a
**Local network access** permission prompt the first time. Choose **Allow**; if the prompt
was dismissed or denied, re-enable the permission in the site settings (Permissions →
Local network access) and reload the page.

Safari does not support Local Network Access, so the TCP/UDP lab is unavailable there.
Use Chrome or Edge.

## Security boundary

- Listens on `127.0.0.1` only; `--host` refuses anything else.
- Token authentication plus an exact-match Origin allowlist on every WebSocket upgrade.
- Only `/agent` (WebSocket) and `/health` (HTTP) are served; missing or bad Origins are
  rejected before the upgrade.
- The page never sends file paths or commands to the agent. MCP stdio servers can only be
  started when they are listed in `agent/config.json`, which the page can select from but
  not modify.

## MCP server config

`agent/config.json` is loaded automatically when it exists (it is git-ignored, so
machine-specific commands stay out of git). Copy `config.example.json` to `config.json`,
list your MCP stdio servers under `mcpServers`, and start with `npm run agent`. Use
`--config <file>` to load a different file instead; when neither exists, no MCP servers
are configured. A present but unreadable file is a startup error naming the file.

```json
{
  "mcpServers": {
    "example": {
      "command": "node",
      "args": ["path/to/server.js"],
      "env": {}
    }
  }
}
```
