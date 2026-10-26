<template>
  <div class="panel">
    <div class="panel-actions">
      <button :disabled="busy" @click="start">
        {{ fields.mode === "Manual" ? $t("manual_sdp") : $t("start_loopback") }}
      </button>
      <button :disabled="!connected" @click="stop">{{ $t("close") }}</button>
      <input
        v-model="input"
        type="text"
        data-test="webrtc-input"
        :aria-label="$t('message')"
        :disabled="!connected"
        @keyup.enter="send"
      />
      <button :disabled="!connected || !input" @click="send">{{ $t("send") }}</button>
    </div>
  </div>
</template>

<style scoped lang="scss">
.panel-actions {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  padding: 8px 4px;
}

.panel-actions > * {
  margin-right: 8px;
}
</style>

<script>
export default {
  props: {
    fields: {
      type: Object,
      required: true,
    },
  },
  data() {
    return {
      busy: false,
      connected: false,
      input: "",
      pc1: null,
      pc2: null,
      channel: null,
    }
  },
  beforeDestroy() {
    this.stop()
  },
  methods: {
    log(message, direction = "info") {
      this.$emit("log", { direction, message })
    },
    fail(error) {
      this.log((error && error.message) || String(error), "error")
    },
    iceServers() {
      return this.fields.stun ? [{ urls: this.fields.stun }] : []
    },
    async start() {
      this.busy = true
      try {
        if (this.fields.mode === "Manual") await this.startManual()
        else await this.startLoopback()
      } catch (error) {
        this.fail(error)
      } finally {
        this.busy = false
      }
    },
    async startLoopback() {
      this.stop()
      const pc1 = new RTCPeerConnection({ iceServers: this.iceServers() })
      const pc2 = new RTCPeerConnection({ iceServers: this.iceServers() })
      this.pc1 = pc1
      this.pc2 = pc2
      pc1.onicecandidate = event => {
        if (event.candidate) pc2.addIceCandidate(event.candidate).catch(() => {})
      }
      pc2.onicecandidate = event => {
        if (event.candidate) pc1.addIceCandidate(event.candidate).catch(() => {})
      }
      const channel = pc1.createDataChannel("postwoman")
      this.attachChannel(channel)
      const offer = await pc1.createOffer()
      await pc1.setLocalDescription(offer)
      await pc2.setRemoteDescription(offer)
      const answer = await pc2.createAnswer()
      await pc2.setLocalDescription(answer)
      await pc1.setRemoteDescription(answer)
      this.log("Loopback offer/answer complete")
    },
    async startManual() {
      if (this.pc1 && this.fields.remoteSdp) {
        const remote = JSON.parse(this.fields.remoteSdp)
        await this.pc1.setRemoteDescription(remote)
        this.log("Remote answer applied")
        return
      }
      this.stop()
      const pc = new RTCPeerConnection({ iceServers: this.iceServers() })
      this.pc1 = pc
      this.attachChannel(pc.createDataChannel("postwoman"))
      const offer = await pc.createOffer()
      await pc.setLocalDescription(offer)
      this.fields.remoteSdp = JSON.stringify({ type: offer.type, sdp: offer.sdp })
      this.log("Offer created; paste the remote answer into Remote SDP and press Manual SDP again")
    },
    attachChannel(channel) {
      this.channel = channel
      channel.onopen = () => {
        this.connected = true
        this.log("Data channel open")
      }
      channel.onclose = () => {
        this.connected = false
        this.log("Data channel closed")
      }
      channel.onmessage = event => this.log(String(event.data), "received")
    },
    send() {
      if (!this.channel || this.channel.readyState !== "open") return
      this.channel.send(this.input)
      this.log(this.input, "sent")
      this.input = ""
    },
    stop() {
      if (this.channel) this.channel.close()
      if (this.pc1) this.pc1.close()
      if (this.pc2) this.pc2.close()
      this.channel = null
      this.pc1 = null
      this.pc2 = null
      this.connected = false
    },
  },
}
</script>
