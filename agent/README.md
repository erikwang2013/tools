# Postwoman Agent

Local WebSocket agent that gives the Postwoman Protocol Lab access to raw sockets and protocols a
browser cannot speak directly: TCP/UDP, raw sockets, Unix sockets, RTSP, RTMP, RTP/RTCP, ISO 8583,
HTTP/2-H3, gRPC, Dubbo, Thrift, Hessian, AMQP, Kafka, STOMP-TCP, CoAP/LwM2M, OPC UA, Modbus, DNP3,
IEC 104 and BACnet/IP. Its control plane binds to `127.0.0.1` only, so it cannot be reached from
other machines. A UDP session's data socket binds `127.0.0.1` for loopback targets and the wildcard
address (`0.0.0.0`) for LAN targets, because a loopback-bound UDP socket cannot receive replies from
a LAN device.

## Start

The agent requires Node 18 (`>=18 <19`). From the repository root:

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

The token is printed at startup and is required for every WebSocket connection. The Origin is
checked first, at the WebSocket upgrade; the token is checked on the first frame after the upgrade,
and a wrong token gets `auth:fail` and close code 4001. Without `--token` a new random token is
generated each start, so paste the printed token into the app's agent settings after every restart.
Keep the token private: anyone on this machine who has it can open sockets through the agent.

## Origins

Only browser pages served from an allowed Origin may connect. The default allowlist is
`https://postwoman.erik.xyz`, `http://localhost:3000` and `http://127.0.0.1:3000`, and it
always stays allowed. `--origin` adds to it (repeat the flag for several); a dev server on
another port needs `--origin http://localhost:<port>`. Matching is exact (scheme, host and
port), and duplicates are ignored.

## Browser support

When the page is served from a non-loopback origin (for example the deployed HTTPS site), Chrome and
Edge gate the connection to the loopback agent with a **Local network access** permission prompt
the first time. Choose **Allow**; if the prompt was dismissed or denied, re-enable the permission in
the site settings (Chrome 145+ files it under **Apps on device → Local Network**) and reload the
page. A page served from `localhost` or `127.0.0.1` is itself loopback and is normally exempt from
the prompt.

Firefox is best-effort and version-dependent. Safari is not a supported target for the agent
protocols: the TCP/UDP lab may be unavailable or blocked there, while the HTTP-based tabs are
unaffected. Use Chrome or Edge.

## Security boundary

- The control plane listens on `127.0.0.1` only; `--host` refuses anything else. The UDP data
  socket exception for LAN targets is described above.
- Every WebSocket upgrade must come from an exact-match Origin in the allowlist; after the upgrade,
  the first frame must carry the printed token, or the agent replies `auth:fail` and closes with
  code 4001.
- HTTP routes: `/health`, `/proxy/http` (token + Origin required), `/hook/<secret>` (random path
  allocated per Webhooks session). WebSocket routes: `/agent` (token + Origin) and
  `/bridge/<secret>` (Origin; one-time local bridge for STOMP/XMPP/SIP). Other paths are rejected.
- The page never sends file paths or commands to the agent. MCP stdio servers listed in
  `agent/config.json` can only be selected by name from the page; the page cannot add or modify
  commands, args or environment variables.
- OPC UA uses SecurityPolicy None and creates a debug client certificate under
  `~/.postwoman-agent/opcua` on first use (OpenSSL must be on `PATH`).

## MCP server config

`agent/config.json` is loaded automatically when it exists (it is git-ignored, so
machine-specific commands stay out of git). Copy `config.example.json` to `config.json`,
list your MCP stdio servers under `mcpServers`, and start with `npm run agent`. Use
`--config <file>` to load a different file instead; when neither exists, no MCP servers
are configured. A present but unreadable file is a startup error naming the file. The page's MCP
panel can start only the configured names (remote Streamable HTTP/SSE needs no agent config).

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
