# Protocol Lab

The Protocol Lab (`/protocols`) is a generic workbench for non-HTTP protocols. Every protocol is
described by a registry entry (`protocols/registry.mjs`) that declares its config fields, payload
mode, transport and actions; the UI (`components/protocols/lab.vue`) renders that descriptor without
protocol-specific code.

The registry ships 38 entries covering HTTP family, browser realtime, raw transports, RPC/messaging
and IoT/industrial protocols, plus the WebSocket binary-frame mode on the existing Realtime page
(39 capabilities in total). Protocols that need raw sockets run through the local agent described in
[agent/README.md](../agent/README.md), whose control plane is loopback-only; nothing is proxied by
the website. Browser-native entries (HLS, WebRTC, STOMP/XMPP/SIP, A2A, MCP remote) load their client
libraries on demand.

## Protocols

| Protocol | id | Group | Transport | Config fields | Payload modes | Actions |
| --- | --- | --- | --- | --- | --- | --- |
| TCP | `tcp` | Raw & Streaming | Agent | `host`, `port`, `encoding`, `framing` | hex, base64, file | Connect, Send, Close |
| UDP | `udp` | Raw & Streaming | Agent | `host`, `port`, `bindPort`, `encoding` | hex, base64, file | Connect, Send, Close |

Both are raw-socket workbenches:

- TCP is a byte stream: one Send writes one chunk, and the peer's bytes may arrive as one `data`
  entry or several depending on how the network and peer segment them. With `framing: none` (the
  default) no newline handling or protocol parsing is applied. With `framing: line` the agent buffers
  inbound chunks, strips a trailing `\r`, and emits one `data` entry per complete `\n`-terminated
  line; on close, a non-empty remainder is emitted as the final line.
- UDP is datagram-based: one Send is one datagram, and each received datagram is one `data` entry.
  The agent's reply payload also carries the sender as `remote: "<ip>:<port>"`, which the lab log
  shows after the direction (`from <ip>:<port>`).

The agent's control plane (HTTP/WebSocket) binds `127.0.0.1` only. A UDP session's data socket binds
`127.0.0.1` when the target is loopback (`localhost`, `::1` or an address in `127.0.0.0/8`); for any
other target it binds the wildcard address (`0.0.0.0`), because a loopback-bound socket cannot receive
replies from a LAN device.

## Performance budget

The Agent's local **CPU processing** budget is **p99 < 10 ms** per operation. Wall time is reported alongside it, but host scheduling and external network time are excluded. Run it with:

```bash
npm run bench:agent   # table + non-zero exit if a p99 exceeds 10 ms
npm run test:perf     # assertion form
```

The budget covers work the Agent controls: envelope encode/decode, session open/send
bookkeeping, the `/proxy/http` and `/hook` handlers (with an immediate mock upstream), and the
protocol codecs. CPU time excludes network RTT, DNS, TLS, broker/device time, external process
startup (MCP stdio), and the time an external target takes to answer; wall time is shown for
visibility. On a busy host the event loop can add isolated wall-time spikes that are not Agent CPU
work; run the benchmark on the target machine when checking the budget.

## Other entries

| Group | Entries | Transport | Notes / subset |
| --- | --- | --- | --- |
| HTTP | SOAP, JSON-RPC, XML-RPC, OData, HTTP Binary Body | Browser HTTP pipeline | Reuses the existing proxy/extension settings. Binary responses are only byte-accurate on the direct path; the UI explains when a proxy returned text. |
| HTTP | HTTP/2, HTTP/3 | Agent | HTTP/2 uses Node `http2` (h2/h2c). HTTP/3 reports `UNSUPPORTED` unless an optional QUIC runtime is installed; browsers negotiate HTTP/3 automatically. |
| Browser Realtime | HLS, WebRTC DataChannel | Browser | HLS logs manifests/fragments and plays in the page. WebRTC offers loopback and manual SDP modes; TURN and media codecs are out of scope. |
| Browser Realtime | STOMP (WS), XMPP (WS), SIP (WS) | Browser or Agent WS bridge | Can fall back to the agent's one-time local bridge when CORS/Origin blocks the target. STOMP transactions, XMPP MUC and SIP media/INVITE are not implemented. |
| Agent | Webhooks, A2A, MCP | Agent / Browser | Webhooks allocate a random `/hook/<secret>` URL. A2A does card discovery + `message/send`. MCP supports remote Streamable HTTP/SSE and agent-configured stdio servers. |
| Raw & Streaming | Raw Socket, Unix Domain Socket, RTSP, RTMP, RTP, RTCP, ISO 8583 | Agent | Raw socket reuses TCP/UDP. RTSP supports OPTIONS/DESCRIBE/SETUP/PLAY/PAUSE/TEARDOWN with Digest auth. RTMP is a command/chunk subset (no media codecs). RTP/RTCP parse headers and reports. ISO 8583 uses a fixed 1987 field subset (2, 3, 4, 7, 11, 12, 13, 32, 37, 39, 41, 42, 49, 55). Unix sockets are path-based only (no Windows named pipes). |
| RPC & Messaging | gRPC, Dubbo, Thrift, Hessian, AMQP, Kafka, STOMP (TCP) | Agent | gRPC supports unary + server streaming (no reflection). Dubbo is 2.x Hessian2 unary. Thrift uses a minimal IDL parser and TBinaryProtocol. Hessian uses the agent-side Hessian2 convention. AMQP/Kafka need a reachable broker; Kafka does not auto-reconnect. STOMP-TCP implements the frame subset. |
| IoT / Industrial | CoAP, LwM2M, OPC UA, Modbus TCP, DNP3, IEC 60870-5-104, BACnet/IP | Agent | CoAP is `coap://` only (no DTLS) and supports Observe. LwM2M covers register/read/write/observe with text payloads. OPC UA uses SecurityPolicy None plus optional username/password. Modbus validates unit/address/quantity and supports guarded polling. DNP3 covers integrity/class reads and a CROB point operate. IEC 104 covers STARTDT, interrogation and single-point reads. BACnet/IP covers Who-Is, ReadProperty and numeric WriteProperty. Real-hardware behaviour is not part of automated tests. |

Every entry keeps at most 2000 log rows and is capped at 16 MiB per message. Industrial and raw
protocols normally have no authentication; use them only on isolated/trusted networks.

## Fields

| Field | Protocols | Type | Default | Description |
| --- | --- | --- | --- | --- |
| `host` | TCP, UDP | text | `127.0.0.1` | Target host name or IP. Required; resolved and connected from the agent's machine, not the browser. |
| `port` | TCP, UDP | number | `9000` | Target port, integer 1–65535. Required. |
| `bindPort` | UDP | number | `0` | Local UDP port the agent binds before sending, integer 0–65535. `0` lets the OS choose an ephemeral port, which is what request/response tests need. Set a fixed port only when the peer must send to a known local port. |
| `encoding` | TCP, UDP | select | `base64` | How received bytes are decoded for display: `base64` or `utf8`. See below. |
| `framing` | TCP | select | `none` | `none` delivers raw chunks; `line` delivers one `data` entry per `\n`-terminated line (a trailing `\r` is stripped, and a non-empty remainder is emitted on close). |

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

1. **Start.** `npm --prefix agent install` once, then `npm run agent`. The agent's control plane binds
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
   loopback. Use a non-loopback origin, for example the deployed `https://tools.erik.xyz`
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
non-loopback page origin (for example the deployed `https://tools.erik.xyz`) can trigger the
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

The agent's control plane only listens on `127.0.0.1`, requires the per-start token and an
exact-match Origin, and never accepts file paths or commands from the page. The only exception to the
loopback bind is the UDP data socket for a non-loopback target, described above. Phase 0 ships no MCP
protocol or UI selector. The agent already reads MCP stdio server definitions from `agent/config.json` (git-ignored; copy
`agent/config.example.json`); when MCP support lands, those servers will only be startable from that
file, and the page will not be able to add or modify entries.
