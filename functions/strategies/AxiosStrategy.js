import axios from "axios"

const axiosWithProxy = async (req, { state }) => {
  const proxyUrl = state.postwoman.settings.PROXY_URL
  if (!proxyUrl) throw new Error("Proxy URL is not configured")
  const { data } = await axios.post(proxyUrl, req)
  return data
}

const axiosWithoutProxy = async (req, _store) => {
  const res = await axios(req)
  return res
}

const axiosStrategy = (req, store) => {
  if (store.state.postwoman.settings.PROXY_ENABLED) {
    return axiosWithProxy(req, store)
  }
  return axiosWithoutProxy(req, store)
}

export default axiosStrategy
