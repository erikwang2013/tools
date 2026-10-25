// Node 18 ships no QUIC implementation. This adapter probes for the optional
// @currentspace/http3 package and reports a clear runtime error when absent.
function unsupported(reason) {
  const error = new Error(`HTTP/3 is not available in this runtime: ${reason}`)
  error.code = "UNSUPPORTED"
  return error
}

module.exports = {
  id: "http3",
  create() {
    let http3
    try {
      http3 = require("@currentspace/http3")
    } catch (error) {
      return Promise.reject(unsupported("optional package @currentspace/http3 is not installed"))
    }
    if (typeof http3.request !== "function") {
      return Promise.reject(unsupported("installed package exposes no request() API"))
    }
    return Promise.reject(unsupported("runtime integration is not implemented"))
  },
}
