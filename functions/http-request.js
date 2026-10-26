import { sendNetworkRequest } from "./network"
import { normalizeResponse } from "./http-normalize.mjs"

export async function sendHttp(req, store) {
  return normalizeResponse(await sendNetworkRequest(req, store))
}
