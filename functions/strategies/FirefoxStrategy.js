const firefoxWithProxy = (req, { state }) =>
  new Promise((resolve, reject) => {
    const proxyUrl = state.postwoman.settings.PROXY_URL
    if (!proxyUrl) return reject(new Error("Proxy URL is not configured"))
    const eventListener = event => {
      window.removeEventListener("firefoxExtSendRequestComplete", eventListener)

      if (event.detail.error) {
        reject(JSON.parse(event.detail.error))
      } else {
        resolve(JSON.parse(event.detail.response).data)
      }
    }

    window.addEventListener("firefoxExtSendRequestComplete", eventListener)

    window.firefoxExtSendRequest({
      method: "post",
      url: proxyUrl,
      data: req
    });
  });

const firefoxWithoutProxy = (req, _store) =>
  new Promise((resolve, reject) => {
    const eventListener = ({ detail }) => {
      window.removeEventListener("firefoxExtSendRequestComplete", eventListener)

      if (detail.error) {
        reject(JSON.parse(detail.error))
      } else {
        resolve(JSON.parse(detail.response))
      }
    }

    window.addEventListener("firefoxExtSendRequestComplete", eventListener)

    window.firefoxExtSendRequest(req)
  })

const firefoxStrategy = (req, store) => {
  if (store.state.postwoman.settings.PROXY_ENABLED) {
    return firefoxWithProxy(req, store)
  }
  return firefoxWithoutProxy(req, store)
}

export default firefoxStrategy
