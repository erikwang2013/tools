const tcp = require("./tcp")
const udp = require("./udp")

module.exports = {
  id: "raw-socket",
  create(config = {}, emit) {
    const kind = config.kind || "tcp"
    if (kind !== "tcp" && kind !== "udp") {
      return Promise.reject(new Error("invalid kind"))
    }
    return (kind === "udp" ? udp : tcp).create(config, emit)
  },
}
