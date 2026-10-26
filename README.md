<div align="center">
  <a href="https://tools.erik.xyz"><img src="static/logo.png" alt="Postwoman logo" height="160"></a>
  <br>
  <br>
  <p>
    <b>A free, fast and beautiful API request builder</b>
  </p>
  <p>
     <i>Web alternative to Postman - Helps you create requests faster, saving precious time on development.</i>
  </p>
  <p>

  [![Website](https://img.shields.io/website?url=https%3A%2F%2Ftools.erik.xyz&logo=Postwoman&label=website)](https://tools.erik.xyz) [![GitHub release](https://img.shields.io/github/release/erikwang2013/tools/all?logo=GitHub)](https://github.com/erikwang2013/tools/releases/latest) [![License](https://img.shields.io/badge/license-MIT-blue)](LICENSE)

  </p>
  <p>
    <sub>Maintained at <a href="https://github.com/erikwang2013/tools">erikwang2013/tools</a></sub>
  </p>
</div>

---

**Docs: _[使用指南](https://tools.erik.xyz/guide), [Protocol Lab](docs/protocol-lab.md), [Local Agent](agent/README.md)_**

<div align="center">
  <br>
  <img src="static/images/screenshot1.png" alt="Screenshot1" width="100%">
  <br>
</div>

### Features ✨

❤️ **Lightweight**: Crafted with minimalistic UI design - simple design is the best design.

⚡️ **Fast**: Send requests and get/copy responses in real-time - fast software is the best software.

**Methods:**
 - `GET` - Retrieve information about the REST API resource
 - `HEAD` - Retrieve response headers identical to those of a GET request, but without the response body.
 - `POST` - Create a REST API resource
 - `PUT` - Update a REST API resource
 - `DELETE` - Delete a REST API resource or related component
 - `CONNECT` - Establishes a tunnel to the server identified by the target resource
 - `OPTIONS` - Describe the communication options for the target resource
 - `TRACE` - Performs a message loop-back test along the path to the target resource
 - `PATCH` - Apply partial modifications to a REST API resource
 - `<custom>` - Some APIs use custom request methods such as `LIST`. Type in your custom methods.

🌈 **Make it yours**: Customizable combinations for background, foreground and accent colors: because customization is freedom. [Customize now ✨](https://tools.erik.xyz/settings).

**Customizations:**
 - Choose theme: Kinda Dark (default), Clearly White, Just Black and System theme
 - Choose accent color: Green (default), Yellow, Pink, Red, Purple, Orange, Cyan and Blue
 - Toggle multi-colored headings

_Customized themes are synced with local session storage_

🔥 **PWA**: Install as a [PWA](https://developers.google.com/web/progressive-web-apps) on your device.

**Features:**
 - Instant loading with [Service Workers](https://developers.google.com/web/fundamentals/primers/service-workers)
 - Offline support
 - Low RAM/memory and CPU usage
 - Add to Home Screen
 - Desktop PWA
 - ([full features](https://developers.google.com/web/progressive-web-apps))

🚀 **Request**: Retrieve response from endpoint instantly.

 - Choose `method`
 - Enter `URL` and `Path`
 - Send

**Features:**
 - Copy/share public "Share URL"
 - Generate request code for `JavaScript XHR`, `Fetch` and `cURL`
 - Copy generated request code to clipboard
 - Import `cURL`
 - Label requests

🔌 **WebSocket**: Establish full-duplex communication channels over a single TCP connection.

 - Send and receive data
 - Basic and Bearer Token authentication

📡 **Server Sent Events**: Receive a stream of updates from a server over a HTTP connection without resorting to polling.

🌩 **Socket.IO**: Send and Receive data with socketio server. SocketIO is popular websocket solution.

🦟 **MQTT**: Subscribe and Publish to topics of a MQTT Broker.

🔮 **GraphQL**: GraphQL is a query language for APIs and a runtime for fulfilling those queries with your existing data.

 - Set endpoint and get schemas
 - Multi-column docs
 - Set custom request headers
 - Query schema
 - Get query response

🔐 **Authentication**: Allows to identify the end user.

**Types:**
 - None
 - Basic
 - Bearer Token
 - OAuth 2.0
 - OIDC Access Token/PKCE (Proof Key for Code Exchange)

📢 **Headers**: Describes the format the body of your request is being sent as.

 - Add or remove Header list

📫 **Parameters**: Use request parameters to set varying parts in simulated requests.

📃 **Request Body**: Used to send and receive data via the REST API.

**Options:**
 - Set `Content Type`
 - Add or remove Parameter list
 - Toggle between key-value and RAW input Parameter list

👋 **Responses**: Contains the status line, headers and the message/response body.

 - Copy response to clipboard
 - Download response to as a file
 - View preview of HTML responses

⏰ **History**: Request entries are synced with local session storage to reuse with a single click.

**Fields:**
 - Star
 - Label
 - Method
 - Status code
 - URL
 - Path
 - Timestamp
 - Duration
 - Pre-request script

_History entries can be sorted by any fields_

_Histories can be deleted one-by-one or all together_

📁 **Collections**: Keep your API requests organized with collections and folders. Reuse them with a single click.

**Options:**
 - Create infinite collections, folders and requests
 - Edit, delete, move, export, import and replace

_Collections are synced with local session storage_

🌐 **Proxy**: Enable Proxy Mode from Settings to access blocked APIs.

**Features:**
 - Hide your IP address
 - Fixes [CORS](https://developer.mozilla.org/en-US/docs/Web/HTTP/CORS) (Cross Origin Resource Sharing) issues
 - Access APIs served in non-HTTPS (`http://`)
 - Use custom Proxy URL

_Official Postwoman Proxy is hosted by Apollo Software - **[Privacy Policy](https://apollosoftware.xyz/legal/postwoman)**_

📜 **Pre-Request Scripts β**: Snippets of code associated with a request that are executed before the request is sent.

**Use-cases:**
 - Include timestamp in the request headers
 - Send a random alphanumeric string in the URL parameters

_Requests with Pre-Request Scripts are indicated in History entries_

📄 **API Documentation**: Create and share dynamic API documentation easily, quickly.

**Usage:**
 1. Add your requests to Collections and Folders
 2. Export Collections and easily share your APIs with the rest of your team
 3. Import Collections and Generate Documentation on-the-go

⌨️ **Keyboard Shortcuts**: Optimized for efficiency.

**Shortcuts:**
 - Send Request <kbd>Ctrl</kbd> + <kbd>G</kbd>
 - Save to Collections <kbd>Ctrl</kbd> + <kbd>S</kbd>
 - Copy Request Link <kbd>Ctrl</kbd> + <kbd>K</kbd>
 - Reset Request <kbd>Ctrl</kbd> + <kbd>L</kbd>

🌎 **i18n β**: Experience the app in your own language.

 1. Scroll down to the footer
 2. Click "Choose Language" icon button
 3. Select your language from the menu

_Keep in mind: Translations aren't available for all source and target language combinations_

**To provide a localized experience for users around the world, you can add you own translations.**

_**All `i18n` contributions are welcome to `i18n` [branch](https://github.com/liyasthomas/postwoman/tree/i18n) only!**_

📦 **Add-ons**: Official add-ons for Postwoman.

 - **[Proxy β](https://github.com/postwoman-io/postwoman-proxy)** - A simple proxy server created for Postwoman
 - **[CLI β](https://github.com/postwoman-io/postwoman-cli)** - A CLI solution for Postwoman
 - **Browser Extensions** - Browser extensions that simplifies access to Postwoman

   [![Firefox](https://raw.github.com/alrra/browser-logos/master/src/firefox/firefox_16x16.png) **Firefox**](https://addons.mozilla.org/en-US/firefox/addon/postwoman) &nbsp;|&nbsp; [![Chrome](https://raw.github.com/alrra/browser-logos/master/src/chrome/chrome_16x16.png) **Chrome**](https://chrome.google.com/webstore/detail/postwoman-extension-for-c/amknoiejhlmhancpahfcfcfhllgkpbld) ([GitHub](https://github.com/AndrewBastin/postwoman-extension))

   >**Extensions fixes `CORS` issues.**

_Add-ons are developed and maintained under **[Official Postwoman Organization](https://github.com/postwoman-io)**._

✅ **Post-Request Tests β**: Write tests associated with a request that are executed after the request response.

**Use-cases:**
 - Check the status code as an integer
 - Filter response headers
 - Parse the response data

🌱 **Environments** : Environment variables allow you to store and reuse values in your requests and scripts.

**Use-cases:**
 - By storing a value in a variable, you can reference it throughout your request section
 - If you need to update the value, you only have to change it in one place
 - Using variables increases your ability to work efficiently and minimizes the likelihood of error

**To find out more, see the [使用指南](https://tools.erik.xyz/guide).**

## Demo 🚀 [![Website](https://img.shields.io/website?url=https%3A%2F%2Ftools.erik.xyz&logo=Postwoman&label=website)](https://tools.erik.xyz)

[tools.erik.xyz](https://tools.erik.xyz)

## Usage 💡

1. Specify your request `method`
2. Type in your API `URL` and `path`
3. Send request
4. Get response

You're done!

## Protocol Lab 🧪

The Protocol Lab at `/protocols` is a generic workbench for non-HTTP protocols. It ships the full catalogue: HTTP family (SOAP, JSON-RPC, XML-RPC, OData, HTTP binary, HTTP/2, HTTP/3), browser realtime (HLS, WebRTC, STOMP/XMPP/SIP), raw transports (TCP, UDP, raw socket, Unix sockets, RTSP, RTMP, RTP/RTCP, ISO 8583), RPC and messaging (gRPC, Dubbo, Thrift, Hessian, AMQP, Kafka, STOMP-TCP), and IoT/industrial (CoAP, LwM2M, OPC UA, Modbus, DNP3, IEC 104, BACnet/IP).

Protocols that a browser cannot open directly run through the Local Agent below. Field reference, subset limits, receive encodings, payload modes and a manual test checklist are in [docs/protocol-lab.md](docs/protocol-lab.md). The Agent's local CPU processing budget is p99 < 10 ms (`npm run bench:agent`); wall time is reported separately and excludes external network/broker/device time.

## Local Agent 🤖

A small WebSocket agent that gives the Protocol Lab raw TCP/UDP sockets. It listens on loopback only and authenticates each connection with a token.

**This fork needs Node 16–18** for Nuxt 2.12 (Node 20+ fails in its `esm` loader), while the **agent package requires Node 18** (`>=18 <19`). Use Node 18 for both: the repo's `.nvmrc` pins 18, so `nvm use 18` covers the app and the agent.

```bash
npm --prefix agent install   # the agent has its own dependencies (ws)
npm run agent                # ws://127.0.0.1:3567/agent
```

Startup prints the URL, a random token and the allowed origins:

```
Postwoman Agent listening on ws://127.0.0.1:3567/agent
Token: <random hex>
Allowed origins: https://tools.erik.xyz, http://localhost:3000, http://127.0.0.1:3000
```

Open **Settings → Local Agent**, keep the default URL, paste the printed token and click **Connect**. The token is regenerated on every start unless you pass `--token`, so paste the new one after each restart. Options (`--port`, `--origin`, `--token`, `--config`) are documented in [agent/README.md](agent/README.md).

**Browser permission.** When the app is served from a non-loopback origin (for example the deployed HTTPS site), Chrome and Edge gate the loopback connection with a **Local Network Access** permission. Choose Allow; if it was dismissed, re-enable it in site settings (Chrome 145+ files it under **Apps on device → Local Network**) and reload. A page served from `localhost`/`127.0.0.1` is itself loopback and is normally exempt from the prompt. Firefox is best-effort and version-dependent; Safari is not a supported target for the agent protocols.

**Security boundary.**

- The agent's control plane (HTTP/WebSocket) binds `127.0.0.1` only; `--host` refuses anything else. A UDP session's data socket binds `127.0.0.1` for loopback targets and the wildcard address (`0.0.0.0`) for LAN targets, which is required to receive their replies.
- Every WebSocket upgrade must come from an exact-match Origin in the allowlist (`https://tools.erik.xyz`, `http://localhost:3000`, `http://127.0.0.1:3000`; add more with `--origin`). After the upgrade, the first frame must carry the printed token, or the agent replies `auth:fail` and closes with code 4001.
- The page never sends file paths or commands to the agent.
- Phase 0 has no MCP protocol or UI. The agent already reads MCP stdio server definitions from `agent/config.json` (git-ignored; copy `agent/config.example.json`); when MCP support lands, those servers will only be startable from that file, and the page will not be able to add or modify entries.

## Built with 🔧

* [Chromium](https://github.com/chromium/chromium) - Thanks for being so fast!
* HTML - For the web framework
* CSS - For styling components
* JavaScript - For magic!
* [Vue](https://vuejs.org/) - To add to the JavaScript magic!
* [Nuxt](https://nuxtjs.org/) - To add to the Vue magic!

## Developing 👷

#### Use a browser based development environment:

[![Open in Gitpod](https://gitpod.io/button/open-in-gitpod.svg)](https://gitpod.io/#https://github.com/erikwang2013/tools)

#### Or, with local development environment:

This fork needs **Node 16–18** (Nuxt 2.12's `esm` loader crashes on Node 20+). The checked-in `.npmrc` sets `--openssl-legacy-provider` for webpack 4 on Node 18.

1. [Clone this repo](https://help.github.com/en/articles/cloning-a-repository) with git.
2. Install dependencies by running `npm ci` within the directory that you cloned (probably `postwoman`).
3. Start the development server with `npm run dev`.
4. Open development site by going to [http://localhost:3000](http://localhost:3000) in your browser.

#### Or, with docker-compose:

1. [Clone this repo](https://help.github.com/en/articles/cloning-a-repository) with git.
2. Run `docker-compose up`
3. Open the static build at [http://localhost:3000](http://localhost:3000) in your browser.

## Docker 🐳

```bash
#build the static image
docker build -t postwoman:latest .

#run
docker run -p 3000:80 postwoman:latest
```

The image ships `nginx.conf` with HSTS, CSP, `X-Content-Type-Options`, `Referrer-Policy`, `Permissions-Policy` and `X-Frame-Options`. If you deploy `dist/` to an existing nginx host, merge the `add_header` directives from `nginx.conf` into that vhost.

## Releasing 🏷️

1. [Clone this repo](https://help.github.com/en/articles/cloning-a-repository) with git.
2. Install dependencies with `npm ci` (Node 16–18).
3. Build the static files with `npm run generate`.
4. Find the built project in `./dist`.

## Contributing 🍰

Please read [CONTRIBUTING](CONTRIBUTING.md) for details on our [CODE OF CONDUCT](CODE_OF_CONDUCT.md), and the process for submitting pull requests to us.

## Versioning 🔖 [![GitHub release](https://img.shields.io/github/release/erikwang2013/tools/all?logo=GitHub)](https://github.com/erikwang2013/tools/releases/latest)

This project uses the [Semantic Versioning specification](https://semver.org). For the versions available, see the [releases on this repository](https://github.com/erikwang2013/tools/releases).

## Change log 📝

See the [CHANGELOG](CHANGELOG.md) file for details.

## Authors 🔮

### Lead Developers

* **[Liyas Thomas](https://github.com/liyasthomas)** - *Author*
* **[John Harker](https://github.com/NBTX)** - *Lead developer*
* **[Andrew Bastin](https://github.com/andrewbastin)** - *Lead developer*
* **[James George](https://github.com/jamesgeorge007)** - *Lead maintainer*
* **[Caneco](https://twitter.com/caneco)** - *Logo and banner designer*

### Testing and Debugging

* ([contributors](https://github.com/erikwang2013/tools/graphs/contributors))

### Collaborators <!-- ALL-CONTRIBUTORS-BADGE:START - Do not remove or modify this section -->
[![All Contributors](https://img.shields.io/badge/all_contributors-13-orange.svg?style=flat-square)](#contributors-)
<!-- ALL-CONTRIBUTORS-BADGE:END -->

<!-- ALL-CONTRIBUTORS-LIST:START - Do not remove or modify this section -->
<!-- prettier-ignore-start -->
<!-- markdownlint-disable -->
<table>
  <tr>
    <td align="center"><a href="https://liyasthomas.web.app"><img src="https://avatars1.githubusercontent.com/u/10395817?v=4" width="100px;" alt=""/><br /><sub><b>Liyas Thomas</b></sub></a><br /><a href="https://github.com/liyasthomas/postwoman/commits?author=liyasthomas" title="Code">💻</a> <a href="#design-liyasthomas" title="Design">🎨</a></td>
    <td align="center"><a href="https://github.com/NBTX"><img src="https://avatars3.githubusercontent.com/u/43181178?v=4" width="100px;" alt=""/><br /><sub><b>John Harker</b></sub></a><br /><a href="https://github.com/liyasthomas/postwoman/commits?author=NBTX" title="Code">💻</a> <a href="#design-NBTX" title="Design">🎨</a></td>
    <td align="center"><a href="https://nicholaslaroux.com"><img src="https://avatars0.githubusercontent.com/u/1557529?v=4" width="100px;" alt=""/><br /><sub><b>Nicholas La Roux</b></sub></a><br /><a href="https://github.com/liyasthomas/postwoman/commits?author=larouxn" title="Code">💻</a></td>
    <td align="center"><a href="https://github.com/yubathom"><img src="https://avatars3.githubusercontent.com/u/4117768?v=4" width="100px;" alt=""/><br /><sub><b>Thomas Yuba</b></sub></a><br /><a href="https://github.com/liyasthomas/postwoman/commits?author=yubathom" title="Code">💻</a></td>
    <td align="center"><a href="http://www.linkedin.com/in/nickpalenchar"><img src="https://avatars1.githubusercontent.com/u/7539781?v=4" width="100px;" alt=""/><br /><sub><b>Nick Palenchar</b></sub></a><br /><a href="https://github.com/liyasthomas/postwoman/commits?author=nickpalenchar" title="Code">💻</a></td>
    <td align="center"><a href="https://github.com/AndrewBastin"><img src="https://avatars2.githubusercontent.com/u/9131943?v=4" width="100px;" alt=""/><br /><sub><b>Andrew Bastin</b></sub></a><br /><a href="https://github.com/liyasthomas/postwoman/commits?author=AndrewBastin" title="Code">💻</a></td>
    <td align="center"><a href="https://github.com/vlad0337187"><img src="https://avatars1.githubusercontent.com/u/12682937?v=4" width="100px;" alt=""/><br /><sub><b>Vladislav</b></sub></a><br /><a href="https://github.com/liyasthomas/postwoman/commits?author=vlad0337187" title="Code">💻</a></td>
  </tr>
  <tr>
    <td align="center"><a href="https://github.com/izerozlu"><img src="https://avatars3.githubusercontent.com/u/17386157?v=4" width="100px;" alt=""/><br /><sub><b>izerozlu</b></sub></a><br /><a href="https://github.com/liyasthomas/postwoman/commits?author=izerozlu" title="Code">💻</a></td>
    <td align="center"><a href="https://github.com/JacobAnavisca"><img src="https://avatars2.githubusercontent.com/u/21232366?v=4" width="100px;" alt=""/><br /><sub><b>Jacob Anavisca</b></sub></a><br /><a href="https://github.com/liyasthomas/postwoman/commits?author=JacobAnavisca" title="Code">💻</a></td>
    <td align="center"><a href="http://nityanandagohain.github.io"><img src="https://avatars3.githubusercontent.com/u/26831659?v=4" width="100px;" alt=""/><br /><sub><b>Nityananda Gohain</b></sub></a><br /><a href="https://github.com/liyasthomas/postwoman/commits?author=nityanandagohain" title="Code">💻</a></td>
    <td align="center"><a href="https://github.com/hosseinnedaee"><img src="https://avatars2.githubusercontent.com/u/42691357?v=4" width="100px;" alt=""/><br /><sub><b>Hossein Nedaee</b></sub></a><br /><a href="https://github.com/liyasthomas/postwoman/commits?author=hosseinnedaee" title="Code">💻</a></td>
    <td align="center"><a href="https://ghuser.io/jamesgeorge007"><img src="https://avatars2.githubusercontent.com/u/25279263?v=4" width="100px;" alt=""/><br /><sub><b>James George</b></sub></a><br /><a href="https://github.com/liyasthomas/postwoman/commits?author=jamesgeorge007" title="Code">💻</a></td>
    <td align="center"><a href="https://dmitryyankowski.com"><img src="https://avatars0.githubusercontent.com/u/20114263?v=4" width="100px;" alt=""/><br /><sub><b>Dmitry Yankowski</b></sub></a><br /><a href="https://github.com/liyasthomas/postwoman/commits?author=dmitryyankowski" title="Code">💻</a></td>
  </tr>
</table>

<!-- markdownlint-enable -->
<!-- prettier-ignore-end -->
<!-- ALL-CONTRIBUTORS-LIST:END -->

See the list of [contributors](https://github.com/liyasthomas/postwoman/graphs/contributors) who participated in this project.

### Thanks

* [dev.to 👩‍💻👨‍💻](https://dev.to)

### Code Contributors

This project exists thanks to all the people who contribute. [[Contribute](CONTRIBUTING.md)].

<a href="https://github.com/erikwang2013/tools/graphs/contributors">Contributors on GitHub</a>

## License 📄

This project is licensed under the [MIT License](https://opensource.org/licenses/MIT) - see the [LICENSE](LICENSE) file for details.

## Acknowledgements 🙏

* Original Postwoman project by [Liyas Thomas](https://github.com/liyasthomas)
* Hat tip to anyone whose code was used
* Inspirations:
  * [Dribbble](https://dribbble.com)

## Badges

<table>
<tr>
<th>Preview</th>
<th>Markdown code</th>
</tr>
<tbody>
<tr>
<td align="center" width="200px"><a href="https://tools.erik.xyz"><br/><img src="https://img.shields.io/badge/Tested_on-Postwoman-202124?logo=Postwoman"/></a><br/><sub>Default<sub></td>
<td><code>[![Postwoman](https://img.shields.io/badge/Tested_on-Postwoman-202124?logo=Postwoman)](https://tools.erik.xyz)</code></td>
</tr>
<tr>
<td align="center" width="200px"><a href="https://tools.erik.xyz"><br/><img src="https://img.shields.io/badge/Tested_on-Postwoman-success?logo=Postwoman"/></a><br/><sub>Success<sub></td>
<td><code>[![Postwoman](https://img.shields.io/badge/Tested_on-Postwoman-success?logo=Postwoman)](https://tools.erik.xyz)</code></td>
</tr>
<tr>
<td align="center" width="200px"><a href="https://tools.erik.xyz"><br/><img src="https://img.shields.io/badge/Tested_on-Postwoman-critical?logo=Postwoman"/></a><br/><sub>Critical<sub></td>
<td><code>[![Postwoman](https://img.shields.io/badge/Tested_on-Postwoman-critical?logo=Postwoman)](https://tools.erik.xyz)</code></td>
</tr>
<tr>
<td align="center" width="200px"><a href="https://tools.erik.xyz"><br/><img src="https://img.shields.io/badge/Tested_on-Postwoman-blueviolet?logo=Postwoman"/></a><br/><sub>Custom<sub></td>
<td><code>[![Postwoman](https://img.shields.io/badge/Tested_on-Postwoman-blueviolet?logo=Postwoman)](https://tools.erik.xyz)</code></td>
</tr>
<tr>
<td align="center" width="200px"><a href="https://tools.erik.xyz"><br/><img src="https://img.shields.io/badge/your_text-Postwoman-hex_color_code?logo=Postwoman"/></a><br/><sub>Customize<sub></td>
<td><code>[![Postwoman](https://img.shields.io/badge/your_text-Postwoman-hex_color_code?logo=Postwoman)](https://tools.erik.xyz)</code></td>
</tr>
</tbody>
</table>

<div align="center">
  <br>
  <a href="https://tools.erik.xyz"><img src="https://raw.githubusercontent.com/liyasthomas/templates/master/assets/logo.gif" alt="Postwoman.io" width="200"></a>
  <br>
  <h3>Happy Coding ❤︎</h3>
</div>
