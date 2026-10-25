import test from "node:test"
import assert from "node:assert/strict"
import { fetchAgentCard, parseSse, sendA2AMessage } from "../functions/a2a.mjs"

test("fetches the agent card from well-known path", async () => {
  const calls = []
  const fetchImpl = async url => {
    calls.push(url)
    return new Response(JSON.stringify({ name: "x" }), { status: 200 })
  }
  assert.deepEqual(await fetchAgentCard("https://a.test", { fetchImpl }), { name: "x" })
  assert.equal(calls[0], "https://a.test/.well-known/agent-card.json")
})

test("sends a JSON-RPC message/send", async () => {
  let body
  const fetchImpl = async (_url, init) => {
    body = JSON.parse(init.body)
    return new Response("{}", { status: 200 })
  }
  await sendA2AMessage({ endpoint: "https://a.test/rpc", message: "hi", contextId: "c1", fetchImpl })
  assert.equal(body.method, "message/send")
  assert.equal(body.params.message.parts[0].text, "hi")
  assert.equal(body.params.contextId, "c1")
})

test("parses multi-line SSE events", async () => {
  const response = new Response('data: {"a":1}\n\ndata: {"b":2}\n\n')
  const events = []
  await parseSse(response, event => events.push(event))
  assert.deepEqual(events, [{ a: 1 }, { b: 2 }])
})
