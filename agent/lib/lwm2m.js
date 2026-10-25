function buildRegisterPayload({ endpoint, objects = [], lifetime = 300 } = {}) {
  if (!endpoint) throw new Error("endpoint is required")
  const query = `ep=${encodeURIComponent(endpoint)}&lt=${Number(lifetime) || 300}`
  const body = objects.map(path => `<${path}>;rt="oma.lwm2m"`).join(",")
  return { query, body }
}

function buildObjectPath(path) {
  if (typeof path !== "string" || !/^\/\d+(\/\d+)*$/.test(path)) {
    throw new Error("invalid object path")
  }
  return path
}

module.exports = { buildRegisterPayload, buildObjectPath }
