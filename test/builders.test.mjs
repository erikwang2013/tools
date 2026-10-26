import test from "node:test"
import assert from "node:assert/strict"
import {
  buildJsonRpcRequest,
  buildODataRequest,
  buildSoapRequest,
  buildXmlRpcRequest,
} from "../protocols/builders.mjs"

test("soap sets action and xml content type", () => {
  const req = buildSoapRequest(
    { url: "https://x.test/svc", soapAction: "urn:Hi", headers: { A: "b" } },
    { encoding: "utf8", data: "<Envelope/>" }
  )
  assert.equal(req.method, "POST")
  assert.equal(req.headers["Content-Type"], "text/xml; charset=utf-8")
  assert.equal(req.headers.SOAPAction, "urn:Hi")
  assert.equal(req.data, "<Envelope/>")
})

test("soap omits an empty SOAPAction", () => {
  const req = buildSoapRequest({ url: "https://x.test/svc", headers: {} }, null)
  assert.equal(req.headers.SOAPAction, undefined)
})

test("json-rpc wraps method, params and id", () => {
  const req = buildJsonRpcRequest(
    { url: "https://x.test/rpc", headers: {} },
    { encoding: "utf8", data: '{"a":1}' }
  )
  assert.deepEqual(JSON.parse(req.data), {
    jsonrpc: "2.0",
    id: 1,
    method: "method",
    params: { a: 1 },
  })
})

test("xml-rpc escapes params and maps scalar types", () => {
  const req = buildXmlRpcRequest(
    { url: "https://x.test/rpc", method: "m", headers: {} },
    { encoding: "utf8", data: '["a<b", 2, 1.5, true]' }
  )
  assert.match(req.data, /<methodName>m<\/methodName>/)
  assert.match(req.data, /<string>a&lt;b<\/string>/)
  assert.match(req.data, /<int>2<\/int>/)
  assert.match(req.data, /<double>1.5<\/double>/)
  assert.match(req.data, /<boolean>1<\/boolean>/)
})

test("odata builds query string and body", () => {
  const req = buildODataRequest(
    {
      url: "https://x.test/odata/",
      entitySet: "People",
      method: "GET",
      filter: "Age gt 1",
      top: 5,
      headers: {},
    },
    null
  )
  assert.equal(req.url, "https://x.test/odata/People?$filter=Age+gt+1&$top=5")
  assert.equal(req.method, "GET")
})

test("rejects malformed inputs", () => {
  assert.throws(
    () =>
      buildJsonRpcRequest(
        { url: "https://x.test/rpc", headers: {} },
        { encoding: "utf8", data: "{" }
      ),
    /JSON/
  )
  assert.throws(
    () =>
      buildXmlRpcRequest(
        { url: "https://x.test/rpc", method: "m", headers: {} },
        { encoding: "utf8", data: '[{"a":1}]' }
      ),
    /unsupported/i
  )
  assert.throws(
    () => buildODataRequest({ url: "", entitySet: "", method: "GET", headers: {} }, null),
    /url/i
  )
})
