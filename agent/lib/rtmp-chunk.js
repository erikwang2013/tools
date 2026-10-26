const DEFAULT_CHUNK_SIZE = 128
const MAX_BUFFER_BYTES = 16 * 1024 * 1024

function basicHeader(fmt, csid) {
  if (csid >= 2 && csid <= 63) return Buffer.from([(fmt << 6) | csid])
  if (csid >= 64 && csid <= 319) return Buffer.from([fmt << 6, csid - 64])
  if (csid >= 320 && csid <= 65599) {
    const value = csid - 64
    return Buffer.from([(fmt << 6) | 1, (value >> 8) & 0xff, value & 0xff])
  }
  throw new Error("invalid chunk stream id")
}

function encodeChunk({
  csid = 3,
  typeId = 20,
  streamId = 0,
  timestamp = 0,
  payload = Buffer.alloc(0),
  chunkSize = DEFAULT_CHUNK_SIZE,
} = {}) {
  if (!Buffer.isBuffer(payload)) throw new Error("payload must be a Buffer")
  const parts = []
  const header = Buffer.alloc(11)
  header.writeUIntBE(timestamp & 0xffffff, 0, 3)
  header.writeUIntBE(payload.length, 3, 3)
  header[6] = typeId
  header.writeUInt32LE(streamId >>> 0, 7)
  parts.push(basicHeader(0, csid), header)
  let offset = 0
  parts.push(payload.subarray(0, Math.min(chunkSize, payload.length)))
  offset += Math.min(chunkSize, payload.length)
  while (offset < payload.length) {
    parts.push(basicHeader(3, csid))
    parts.push(payload.subarray(offset, Math.min(offset + chunkSize, payload.length)))
    offset += chunkSize
  }
  if (payload.length === 0) parts.push(payload)
  return Buffer.concat(parts)
}

class RtmpChunkDecoder {
  constructor({ chunkSize = DEFAULT_CHUNK_SIZE } = {}) {
    this.chunkSize = chunkSize
    this.buffer = Buffer.alloc(0)
    this.streams = new Map()
  }

  push(chunk) {
    this.buffer = Buffer.concat([this.buffer, chunk])
    if (this.buffer.length > MAX_BUFFER_BYTES) throw new Error("RTMP buffer limit exceeded")
    const messages = []
    for (;;) {
      const consumed = this.parseOne(messages)
      if (!consumed) break
      this.buffer = this.buffer.subarray(consumed)
    }
    return messages
  }

  parseOne(messages) {
    const buf = this.buffer
    if (!buf.length) return 0
    const first = buf[0]
    const fmt = first >> 6
    let csid = first & 0x3f
    let offset = 1
    if (csid === 0) {
      if (buf.length < 2) return 0
      csid = 64 + buf[1]
      offset = 2
    } else if (csid === 1) {
      if (buf.length < 3) return 0
      csid = 64 + buf[1] + buf[2] * 256
      offset = 3
    }
    const state = this.streams.get(csid) || {
      timestamp: 0,
      length: 0,
      typeId: 0,
      streamId: 0,
      extended: false,
      pending: null,
    }
    const headerSizes = [11, 7, 3, 0]
    const headerSize = headerSizes[fmt]
    if (buf.length < offset + headerSize) return 0
    let timestampField = null
    let timestampDelta = 0
    if (fmt === 0) {
      timestampField = buf.readUIntBE(offset, 3)
      state.timestamp = timestampField
      state.length = buf.readUIntBE(offset + 3, 3)
      state.typeId = buf[offset + 6]
      state.streamId = buf.readUInt32LE(offset + 7)
    } else if (fmt === 1) {
      timestampField = buf.readUIntBE(offset, 3)
      timestampDelta = timestampField
      state.timestamp = (state.timestamp + timestampDelta) >>> 0
      state.length = buf.readUIntBE(offset + 3, 3)
      state.typeId = buf[offset + 6]
    } else if (fmt === 2) {
      timestampField = buf.readUIntBE(offset, 3)
      timestampDelta = timestampField
      state.timestamp = (state.timestamp + timestampDelta) >>> 0
    }
    state.extended = timestampField === 0xffffff || (fmt === 3 && state.extended)
    offset += headerSize
    if (state.extended) {
      if (buf.length < offset + 4) {
        this.streams.set(csid, state)
        return 0
      }
      const extended = buf.readUInt32BE(offset)
      if (fmt === 0) state.timestamp = extended
      else if (fmt === 1 || fmt === 2) state.timestamp = (state.timestamp - timestampDelta + extended) >>> 0
      offset += 4
    }
    if (fmt !== 3 || !state.pending) {
      state.pending = {
        timestamp: state.timestamp,
        typeId: state.typeId,
        streamId: state.streamId,
        length: state.length,
        chunks: [],
        remaining: state.length,
      }
    }
    const pending = state.pending
    const size = Math.min(this.chunkSize, pending.remaining)
    if (buf.length < offset + size) {
      this.streams.set(csid, state)
      return 0
    }
    if (size) pending.chunks.push(Buffer.from(buf.subarray(offset, offset + size)))
    pending.remaining -= size
    offset += size
    if (pending.remaining === 0) {
      messages.push({
        csid,
        timestamp: pending.timestamp,
        typeId: pending.typeId,
        streamId: pending.streamId,
        payload: Buffer.concat(pending.chunks, pending.length),
      })
      state.pending = null
    }
    this.streams.set(csid, state)
    return offset
  }
}

module.exports = { encodeChunk, RtmpChunkDecoder, DEFAULT_CHUNK_SIZE }
