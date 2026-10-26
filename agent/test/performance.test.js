const test = require("node:test")
const assert = require("node:assert/strict")
const { BUDGET_MS, run } = require("../bench/local-latency")

test(
  "agent local processing stays under the 10ms p99 budget",
  { skip: process.env.AGENT_PERF !== "1" && "set AGENT_PERF=1 to run the latency budget" },
  async () => {
    const results = await run({ iterations: 200, warmup: 10 })
    for (const result of results) {
      assert.ok(
        result.cpuP99 < BUDGET_MS,
        `${result.name}: CPU p99 ${result.cpuP99.toFixed(3)}ms (budget ${BUDGET_MS}ms)`
      )
    }
  }
)
