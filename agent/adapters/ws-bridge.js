module.exports = {
  id: "ws-bridge",
  create(config = {}, emit, context = {}) {
    if (!context.bridgeRegistry) {
      return Promise.reject(new Error("websocket bridge is not available"))
    }
    return context.bridgeRegistry
      .register({
        ...config,
        onClose: reason => emit({ type: "closed", payload: { reason } }),
      })
      .then(({ secret, url }) => ({
        ready: { url },
        send() {},
        close() {
          context.bridgeRegistry.unregister(secret)
        },
      }))
  },
}
