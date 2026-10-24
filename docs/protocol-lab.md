# Protocol Lab

The Protocol Lab (`/protocols`) is a generic workbench for non-HTTP protocols. Every protocol is
described by a registry entry (`protocols/registry.mjs`) that declares its config fields, payload
mode, transport and actions; the UI (`components/protocols/lab.vue`) renders that descriptor without
protocol-specific code.

**Phase 0 scope: TCP and UDP over the Local Agent.** Other groups in the registry (HTTP, Browser
Realtime, RPC & Messaging, IoT / Industrial) are added in later phases. Each protocol runs through
the local, loopback-only agent described in [agent/README.md](../agent/README.md); nothing is proxied
by the website.

## Protocols

| Protocol | id | Group | Transport | Config fields | Payload modes | Actions |
| --- | --- | --- | --- | --- | --- | --- |
| TCP | `tcp` | Raw & Streaming | Agent | `host`, `port`, `encoding` | hex, base64, file | Connect, Send, Close |
| UDP | `udp` | Raw & Streaming | Agent | `host`, `port`, `bindPort`, `encoding` | hex, base64, file | Connect, Send, Close |

Both are raw-socket workbenches:

- TCP is a byte stream: one Send writes one chunk, and the peer's bytes may arrive as one `data`
  entry or several depending on how the network and peer segment them. No framing, newline handling
  or protocol parsing is applied.
- UDP is datagram-based: one Send is one datagram, and each received datagram is one `data` entry.
  The agent's reply payload also carries the sender as `remote: "<ip>:<port>"`; the Phase 0 log view
  displays the payload bytes only.

## Fields

| Field | Protocols | Type | Default | Description |
| --- | --- | --- | --- | --- |
| `host` | TCP, UDP | text | `127.0.0.1` | Target host name or IP. Required; resolved and connected from the agent's machine, not the browser. |
| `port` | TCP, UDP | number | `9000` | Target port, integer 1–65535. Required. |
| `bindPort` | UDP | number | `0` | Local UDP port the agent binds before sending, integer 0–65535. `0` lets the OS choose an ephemeral port, which is what request/response tests need. Set a fixed port only when the peer must send to a known local port. |
| `encoding` | TCP, UDP | select | `base64` | How received bytes are decoded for display: `base64` or `utf8`. See below. |

Invalid field values are rejected by the agent when the session opens: the lab log shows the error
message and the session is closed. The buttons reflect that state (Connect is available when the
agent is connected, Send only while a session is open, Close only while a session is open).

## Receive encodings

The receive encoding applies to inbound data only; sends always use the payload editor's mode.

- **`base64` (default)** — inbound bytes are transferred byte-for-byte as base64. This is the only
  lossless choice for arbitrary binary protocols. In the log's **Text** view a base64 payload is
  decoded as UTF-8 for display; if it contains unprintable bytes it is shown as a hexdump with a
  **Binary** label. The **Hex** toggle always shows the received bytes as a hexdump.
- **`utf8`** — the agent decodes inbound bytes as UTF-8 before sending them to the page, which is
  convenient for text protocols but lossy for invalid byte sequences and can split a multibyte
  character across TCP chunks. Use it only when the peer speaks text; keep `base64` for binary.

## Payload modes

TCP and UDP descriptors use the `binary` payload mode, so the editor offers:

| Mode | Input | Wire encoding | Notes |
| --- | --- | --- | --- |
| Hex | Two hex digits per byte (for example `68656c6c6f` for `hello`) | `base64` | Must have an even number of valid hex digits. |
| Base64 | Base64 text | `base64` | Validated before sending. |
| File | A file chosen with the file picker | `base64` | Read into memory and sent as one payload; the page sends file contents, never a path. |

Two separate 16 MiB caps apply:

- **Editor payload cap** — the editor refuses a decoded payload larger than 16 MiB
  (`MAX_PAYLOAD_BYTES`).
- **Agent message/frame cap** — the agent caps each WebSocket frame and the whole JSON message at
  16 MiB (`MAX_MESSAGE_BYTES`, also passed to `ws` as `maxPayload`).

Binary payloads travel base64-encoded inside JSON, which adds about 4/3 inflation plus the JSON
envelope. A full 16 MiB binary payload therefore becomes ~21.3 MiB on the wire and is rejected by
the agent's frame cap (`ws` closes the connection because the frame exceeds `maxPayload`). The
effective maximum binary payload through the agent is about 12 MiB (16 MiB × 3/4, less envelope
overhead). The same frame cap applies to received `data` frames: an inbound base64 chunk over
roughly 12 MiB cannot be delivered and is replaced by an error entry. Switching between Hex and
Base64 converts the current payload when it is valid. Text/JSON/XML payload modes exist for text
protocols in later phases; they are not used by TCP or UDP.

## Agent lifecycle

1. **Start.** `npm --prefix agent install` once, then `npm run agent`. The agent binds
   `127.0.0.1:3567` by default and prints the WebSocket URL, a random token and the allowed origins.
   Use `--port`, `--token`, `--origin`, `--config` or `--host` to override (the host must stay
   `127.0.0.1`).
2. **Connect from Settings.** Open Settings → Local Agent, keep `ws://127.0.0.1:3567/agent`, paste
   the token and click Connect. The browser opens the WebSocket; the agent checks the `Origin`
   header against its allowlist before upgrading, then compares the first frame's token
   (`{v: 1, type: "auth", token}`) in constant time. Success replies `auth:ok`; a wrong token replies
   `auth:fail` and closes with code 4001. The page stores the URL in `localStorage` and the token in
   `sessionStorage` only.
3. **Open a session.** On the Protocol Lab, choose TCP or UDP, fill the fields and click Connect. The
   page sends `open` with the protocol id and the field values; the agent creates the socket and
   replies `ready`. Open failures arrive as `error` followed by `closed`, and the log shows the
   message.
4. **Send and receive.** Send converts the editor payload to `{ encoding, data }` and sends it; the
   agent decodes it to bytes and writes/datagrams them to the target. Inbound bytes arrive as `data`
   frames with the receive encoding. Each connection is limited to 32 concurrent sessions.
5. **Close.** Click Close, switch protocols, or leave the page: the page sends `close` (or closes the
   WebSocket on unload) and the agent destroys the socket. A closed-but-unfinished session cannot
   leak: the agent closes any adapter that finishes opening after a close or timeout.
6. **Stop.** Ctrl+C / `SIGTERM` closes all sessions and exits. Every restart creates a new random
   token unless `--token` is passed, so reconnect in Settings after restarting.

## Manual verification checklist

Run every command with Node 18 (`nvm use 18`; the repo's `.nvmrc` pins 18). Nuxt 2.12 supports
Node 16–18, while the agent package requires Node 18 (`>=18 <19`). The dev server on port 3000 is
already in the agent's Origin allowlist. (On this development machine the toolchain also lives at
`/home/erik/.local/node18/bin`; that absolute path is local to this host.)

1. **Start the app.** From the repository root: `npm run dev`, then open
   `http://localhost:3000/protocols`.
2. **Start the agent.** In a second terminal: `npm --prefix agent install` (first time only), then
   `npm run agent`. Record the printed token and confirm it says
   `ws://127.0.0.1:3567/agent`. `curl http://127.0.0.1:3567/health` returns `{"ok":true}`.
3. **Connect from Settings.** Go to Settings → Local Agent, keep the default URL, paste the token and
   click Connect. The status changes to Connected. This page is served from `localhost` (loopback),
   so it is in the same address space as the agent and Chrome/Edge do not show a Local Network
   Access prompt for this run; LNA is exercised separately in step 8.
4. **Auth failure.** Disconnect, then connect with a wrong token: the status shows an error (toast
   `invalid token`) and the agent closes the connection with code 4001. Reconnect with the printed
   token.
5. **TCP echo.** In a third terminal:
   `node -e "require('net').createServer(s => s.pipe(s)).listen(9000)"`.
   If port 9000 is already in use, choose a free port and use it consistently below. In the lab
   choose TCP, leave host `127.0.0.1` and port `9000`, keep Receive as `base64`, click Connect,
   enter the hex payload `68656c6c6f`, click Send. The log shows the sent entry and a received
   `hello` (or a hexdump in Hex view).
6. **UDP echo.** In a fourth terminal:
   `node -e "const d=require('dgram').createSocket('udp4');d.on('message',(m,r)=>d.send(m,r.port,r.address));d.bind(9001)"`.
   If port 9001 is already in use, choose a free port and use it consistently below. Choose UDP,
   set port `9001` and bind port `0`, click Connect, send `68656c6c6f`; the datagram is echoed back
   and logged.
7. **Rejected Origin.** From a shell, an upgrade request with an unlisted Origin is refused before
   the WebSocket handshake:
   `curl -i -H "Connection: Upgrade" -H "Upgrade: websocket" -H "Sec-WebSocket-Version: 13" -H "Sec-WebSocket-Key: x3JJHMbDL1EzLkh9GBhXDw==" -H "Origin: http://evil.example" http://127.0.0.1:3567/agent`
   responds `HTTP/1.1 403 Forbidden`.
8. **Local Network Access (non-loopback page).** LNA prompts only when the page origin is not
   loopback. Use a non-loopback origin, for example the deployed `https://postwoman.erik.xyz`
   (already in the default allowlist), or serve the app from another origin and add it with
   `--origin <origin>`. On the first connect Chrome/Edge asks for Local Network Access (Chrome 145+
   files it in site settings under **Apps on device → Local Network**); choosing Allow connects. If
   the prompt is dismissed or denied, the WebSocket fails with a generic connection error; re-enable
   the permission in site settings, reload the page and connect again. A localhost-only run has no
   prompt to test.
9. **Close and confirm no leftovers.** Click Close in the lab, or close the page. With the agent
   still running, `ss -tanp | grep :9000` and `ss -uanp | grep :9001` (substitute your chosen ports)
   should list only the echo server processes, with no agent-owned sockets. The agent terminal keeps
   serving other sessions. Ctrl+C stops the agent (exit 0); restarting it requires pasting the new
   token in Settings.
10. **Existing features.** REST, GraphQL, WebSocket, SSE, Socket.IO and MQTT tabs behave as before;
    the Protocol Lab and Settings changes do not touch their code paths.

## Browser support caveat (LNA / Safari)

Browsers may gate a page's request to the loopback agent with **Local Network Access** (LNA). The
permission applies when the requesting page origin is not itself loopback: a page served from
`localhost` or `127.0.0.1` is in the same address space as the agent and is normally exempt, while a
non-loopback page origin (for example the deployed `https://postwoman.erik.xyz`) can trigger the
check.

- **Chrome / Edge** ask for Local Network Access on the first connection from a non-loopback origin.
  Choose Allow. Chrome 145+ files the setting under site settings as **Apps on device → Local
  Network** (older versions: Permissions → Local network access). If the prompt was dismissed or
  denied, the WebSocket fails with a generic connection error; re-enable the permission, reload the
  page and connect again.
- **Firefox** is best-effort: Firefox has been rolling out Local Network Access, and behaviour
  depends on the version. Use Chrome or Edge for the supported path.
- **Safari** is not a supported target for the agent protocols. The TCP/UDP lab may be unavailable
  or blocked there; the HTTP-based tabs are unaffected.

The agent only listens on `127.0.0.1`, requires the per-start token and an exact-match Origin, and
never accepts file paths or commands from the page. Phase 0 ships no MCP protocol or UI selector.
The agent already reads MCP stdio server definitions from `agent/config.json` (git-ignored; copy
`agent/config.example.json`); when MCP support lands, those servers will only be startable from that
file, and the page will not be able to add or modify entries.
