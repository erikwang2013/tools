const test = require("node:test")
const assert = require("node:assert/strict")
const net = require("node:net")
const {
  buildRtspRequest,
  digestAuthorization,
  parseRtspResponse,
} = require("../lib/rtsp")
const adapter = require("../adapters/rtsp")

test("builds a request with CSeq and parses a response", () => {
  const req = buildRtspRequest({
    method: "DESCRIBE",
    uri: "rtsp://x/a",
    cseq: 1,
    headers: { Accept: "application/sdp" },
  })
  assert.match(req, /^DESCRIBE rtsp:\/\/x\/a RTSP\/1.0\r\n/)
  const res = parseRtspResponse(
    Buffer.from("RTSP/1.0 200 OK\r\nCSeq: 1\r\nContent-Length: 2\r\n\r\nhi")
  )
  assert.equal(res.status, 200)
  assert.equal(res.headers.CSeq, "1")
  assert.equal(res.body, "hi")
})

test("computes RFC 2617 digest", () => {
  const auth = digestAuthorization({
    username: "u",
    password: "p",
    realm: "r",
    nonce: "n",
    method: "DESCRIBE",
    uri: "rtsp://x/a",
  })
  assert.match(auth, /^Digest username="u", realm="r", nonce="n", uri="rtsp:\/\/x\/a", response="[0-9a-f]{32}"$/)
})

test("retries a digest challenge once", async () => {
  const requests = []
  const server = net.createServer(socket => {
    let buffer = ""
    socket.on("data", chunk => {
      buffer += chunk.toString()
      let index
      while ((index = buffer.indexOf("\r\n\r\n")) !== -1) {
        const head = buffer.slice(0, index)
        buffer = buffer.slice(index + 4)
        const method = head.split(" ")[0]
        requests.push(head)
        if (method === "OPTIONS") {
          socket.write("RTSP/1.0 200 OK\r\nCSeq: 1\r\n\r\n")
        } else if (head.includes("Authorization:")) {
          socket.write("RTSP/1.0 200 OK\r\nCSeq: 3\r\nContent-Length: 3\r\n\r\nsdp")
        } else {
          socket.write(
            'RTSP/1.0 401 Unauthorized\r\nCSeq: 2\r\nWWW-Authenticate: Digest realm="r", nonce="n"\r\n\r\n'
          )
        }
      }
    })
  })
  await new Promise(resolve => server.listen(0, "127.0.0.1", resolve))
  const events = []
  const session = await adapter.create(
    {
      url: `rtsp://127.0.0.1:${server.address().port}/stream`,
      method: "DESCRIBE",
      username: "u",
      password: "p",
    },
    event => events.push(event)
  )
  session.send()
  await new Promise(resolve => setTimeout(resolve, 150))
  assert.equal(requests.filter(request => request.startsWith("DESCRIBE")).length, 2)
  assert.ok(events.some(event => event.type === "log" && /RTSP 200/.test(event.payload.message)))
  assert.ok(events.some(event => event.type === "data" && event.payload.data === "sdp"))
  session.close()
  await new Promise(resolve => server.close(resolve))
})
