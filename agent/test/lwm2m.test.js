const test = require("node:test")
const assert = require("node:assert/strict")
const { buildObjectPath, buildRegisterPayload } = require("../lib/lwm2m")

test("builds a register query and link-format body", () => {
  const { query, body } = buildRegisterPayload({
    endpoint: "dev1",
    objects: ["/3/0", "/4/0"],
    lifetime: 300,
  })
  assert.match(query, /ep=dev1/)
  assert.match(query, /lt=300/)
  assert.equal(body, '</3/0>;rt="oma.lwm2m",</4/0>;rt="oma.lwm2m"')
})

test("validates object paths", () => {
  assert.equal(buildObjectPath("/3/0/1"), "/3/0/1")
  assert.throws(() => buildObjectPath("3/0"), /object path/)
})
