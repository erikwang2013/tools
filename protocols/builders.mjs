import { base64ToBytes } from "../functions/bytes.mjs"

function jsonParams(wire) {
  if (!wire || wire.data === "" || wire.data == null) return []
  let value
  try {
    value = JSON.parse(wire.data)
  } catch {
    throw new Error("Invalid JSON params")
  }
  return value
}

function escapeXml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
}

function xmlRpcValue(value) {
  if (typeof value === "string") return `<value><string>${escapeXml(value)}</string></value>`
  if (typeof value === "boolean") return `<value><boolean>${value ? 1 : 0}</boolean></value>`
  if (typeof value === "number") {
    if (!Number.isFinite(value)) throw new Error("Unsupported XML-RPC parameter type: number")
    if (Number.isInteger(value)) return `<value><int>${value}</int></value>`
    return `<value><double>${value}</double></value>`
  }
  throw new Error(`Unsupported XML-RPC parameter type: ${value === null ? "null" : typeof value}`)
}

export function buildSoapRequest(fields, wire) {
  const headers = { ...(fields.headers || {}) }
  headers["Content-Type"] = headers["Content-Type"] || "text/xml; charset=utf-8"
  if (fields.soapAction) headers.SOAPAction = fields.soapAction
  return { method: "POST", url: fields.url, headers, data: wire ? wire.data : "" }
}

export function buildJsonRpcRequest(fields, wire) {
  const headers = { ...(fields.headers || {}), "Content-Type": "application/json" }
  const method = typeof fields.method === "string" && fields.method !== "" ? fields.method : "method"
  const id = fields.id === undefined || fields.id === "" ? 1 : Number(fields.id)
  const body = { jsonrpc: "2.0", id, method, params: jsonParams(wire) }
  return { method: "POST", url: fields.url, headers, data: JSON.stringify(body) }
}

export function buildXmlRpcRequest(fields, wire) {
  const params = jsonParams(wire)
  const values = Array.isArray(params) ? params : [params]
  const body =
    `<?xml version="1.0"?>` +
    `<methodCall><methodName>${escapeXml(fields.method || "")}</methodName><params>` +
    values.map(value => `<param>${xmlRpcValue(value)}</param>`).join("") +
    `</params></methodCall>`
  return {
    method: "POST",
    url: fields.url,
    headers: { ...(fields.headers || {}), "Content-Type": "text/xml" },
    data: body,
  }
}

export function buildHttpBinaryRequest(fields, wire) {
  const req = {
    method: fields.method || "GET",
    url: fields.url,
    headers: { ...(fields.headers || {}) },
    responseType: "arraybuffer",
  }
  if (wire) req.data = base64ToBytes(wire.data)
  return req
}

export function buildODataRequest(fields, wire) {
  if (typeof fields.url !== "string" || fields.url.trim() === "") throw new Error("url is required")
  if (typeof fields.entitySet !== "string" || fields.entitySet.trim() === "") {
    throw new Error("entitySet is required")
  }
  const query = []
  const encode = value => encodeURIComponent(String(value)).replace(/%20/g, "+")
  for (const key of ["filter", "select", "expand", "orderby", "top", "skip"]) {
    if (fields[key] !== undefined && fields[key] !== "") query.push(`$${key}=${encode(fields[key])}`)
  }
  const url =
    fields.url.replace(/\/$/, "") + "/" + fields.entitySet + (query.length ? `?${query.join("&")}` : "")
  const method = fields.method || "GET"
  const req = { method, url, headers: { ...(fields.headers || {}) } }
  if (method !== "GET" && wire) {
    req.data = wire.data
    if (!Object.keys(req.headers).some(name => name.toLowerCase() === "content-type")) {
      req.headers["Content-Type"] = "application/json"
    }
  }
  return req
}
