import type { RealtimeEvent } from "../voice-assistant/voice-assistant.ts"

type RealtimeSessionUpdate = {
  instructions: string
  tools: unknown[]
}

type RealtimeVoiceSessionOptions = {
  getClientSecret: () => Promise<string>
  onEvent: (event: RealtimeEvent) => void
  onConnectingChange: (connecting: boolean) => void
  onListeningChange: (listening: boolean) => void
  onError: (message: string | null) => void
}

export class RealtimeVoiceSession {
  private readonly getClientSecret: () => Promise<string>
  private readonly onEvent: (event: RealtimeEvent) => void
  private readonly onConnectingChange: (connecting: boolean) => void
  private readonly onListeningChange: (listening: boolean) => void
  private readonly onError: (message: string | null) => void

  private audioElement: HTMLAudioElement | null = null
  private mediaStream: MediaStream | null = null
  private microphoneTrack: MediaStreamTrack | null = null
  private peerConnection: RTCPeerConnection | null = null
  private dataChannel: RTCDataChannel | null = null
  private sessionPromise: Promise<void> | null = null
  private sessionReady = false
  private connecting = false
  private listening = false
  private activeResponseId: string | null = null
  private outputAudioPlaying = false
  private pendingSessionUpdate: RealtimeSessionUpdate | null = null

  constructor(options: RealtimeVoiceSessionOptions) {
    this.getClientSecret = options.getClientSecret
    this.onEvent = options.onEvent
    this.onConnectingChange = options.onConnectingChange
    this.onListeningChange = options.onListeningChange
    this.onError = options.onError
  }

  get isConnecting(): boolean {
    return this.connecting
  }

  get isListening(): boolean {
    return this.listening
  }

  async ensureOpen(): Promise<void> {
    if (this.sessionReady && this.dataChannel?.readyState === "open" && this.peerConnection) {
      return
    }

    if (!this.sessionPromise) {
      this.sessionPromise = this.initSession().finally(() => {
        this.sessionPromise = null
      })
    }

    await this.sessionPromise
  }

  updateSession(sessionUpdate: RealtimeSessionUpdate): void {
    this.pendingSessionUpdate = sessionUpdate

    if (this.dataChannel?.readyState !== "open") {
      // We keep the newest prompt/tool state so a session opened moments later starts with fresh context.
      return
    }

    this.sendRealtimeEvent({
      type: "session.update",
      session: {
        type: "realtime",
        instructions: sessionUpdate.instructions,
        tool_choice: "auto",
        audio: {
          input: {
            turn_detection: null,
          },
          output: {
            voice: "marin",
          },
        },
        output_modalities: ["audio"],
        tools: sessionUpdate.tools,
      },
    })
  }

  sendEvent(event: unknown): void {
    this.sendRealtimeEvent(event)
  }

  startListening(): void {
    if (this.listening || !this.microphoneTrack || this.dataChannel?.readyState !== "open" || !this.sessionReady) {
      return
    }

    console.debug("Voice assistant start listening")
    // Starting a new turn should interrupt any spoken reply still in progress before reopening the mic.
    this.sendRealtimeEvent({ type: "input_audio_buffer.clear" })

    if (this.activeResponseId) {
      this.sendRealtimeEvent({
        type: "response.cancel",
        response_id: this.activeResponseId,
      })
    }

    if (this.outputAudioPlaying) {
      this.sendRealtimeEvent({ type: "output_audio_buffer.clear" })
    }

    this.microphoneTrack.enabled = true
    this.listening = true
    this.onListeningChange(true)
  }

  stopListening(): void {
    if (!this.listening || !this.microphoneTrack) {
      return
    }

    console.debug("Voice assistant stop listening")
    this.microphoneTrack.enabled = false
    this.listening = false
    this.onListeningChange(false)
    this.sendRealtimeEvent({ type: "input_audio_buffer.commit" })
    this.sendRealtimeEvent({ type: "response.create" })
  }

  disconnect(): void {
    this.cleanupSession()
  }

  private async initSession(): Promise<void> {
    this.connecting = true
    this.onConnectingChange(true)
    this.cleanupSession()

    try {
      const clientSecret = await this.getClientSecret()
      const mediaStream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const microphoneTrack = mediaStream.getAudioTracks()[0]

      if (!microphoneTrack) {
        throw new Error("No microphone track was available.")
      }

      microphoneTrack.enabled = false

      const audioElement = new Audio()
      audioElement.autoplay = true

      const peerConnection = new RTCPeerConnection()
      const dataChannel = peerConnection.createDataChannel("oai-events")

      this.mediaStream = mediaStream
      this.microphoneTrack = microphoneTrack
      this.audioElement = audioElement
      this.peerConnection = peerConnection
      this.dataChannel = dataChannel
      this.sessionReady = false

      peerConnection.ontrack = (event) => {
        const [stream] = event.streams

        if (stream) {
          audioElement.srcObject = stream
        }
      }

      peerConnection.onconnectionstatechange = () => {
        console.debug("Voice assistant peer connection state:", peerConnection.connectionState)

        if (peerConnection.connectionState === "failed" || peerConnection.connectionState === "closed") {
          this.stopListening()
          this.sessionReady = false
        }

        if (peerConnection.connectionState === "connected") {
          this.sessionReady = true
        }
      }

      dataChannel.addEventListener("open", () => {
        console.debug("Voice assistant data channel open")
        this.sessionReady = true

        if (this.pendingSessionUpdate) {
          this.updateSession(this.pendingSessionUpdate)
        }
      })
      dataChannel.addEventListener("close", () => {
        console.debug("Voice assistant data channel closed")
        this.sessionReady = false
      })
      dataChannel.addEventListener("message", (messageEvent) => {
        this.handleRealtimeMessage(messageEvent.data)
      })

      peerConnection.addTrack(microphoneTrack, mediaStream)

      const offer = await peerConnection.createOffer()
      await peerConnection.setLocalDescription(offer)

      const response = await fetch("https://api.openai.com/v1/realtime/calls", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${clientSecret}`,
          "Content-Type": "application/sdp",
        },
        body: offer.sdp ?? "",
      })

      if (!response.ok) {
        throw new Error(`Realtime connection failed (${response.status}).`)
      }

      const answerSdp = await response.text()
      await peerConnection.setRemoteDescription({
        type: "answer",
        sdp: answerSdp,
      })
      // Either the data channel or the connection can report ready first depending on timing, so accept either.
      await Promise.race([this.waitForDataChannelOpen(dataChannel), this.waitForPeerConnection(peerConnection)])
      this.onError(null)
    } catch (error) {
      this.cleanupSession()
      throw error
    } finally {
      this.connecting = false
      this.onConnectingChange(false)
    }
  }

  private cleanupSession(): void {
    this.dataChannel?.close()
    this.peerConnection?.close()
    this.microphoneTrack?.stop()
    this.mediaStream?.getTracks().forEach((track) => track.stop())

    if (this.audioElement) {
      this.audioElement.pause()
      this.audioElement.srcObject = null
    }

    this.dataChannel = null
    this.peerConnection = null
    this.microphoneTrack = null
    this.mediaStream = null
    this.audioElement = null
    this.listening = false
    this.onListeningChange(false)
    this.sessionReady = false
    this.activeResponseId = null
    this.outputAudioPlaying = false
  }

  private waitForDataChannelOpen(dataChannel: RTCDataChannel): Promise<void> {
    if (dataChannel.readyState === "open") {
      return Promise.resolve()
    }

    return new Promise((resolve, reject) => {
      const timeoutId = window.setTimeout(() => {
        cleanup()
        reject(new Error("Timed out waiting for the realtime data channel to open."))
      }, 10000)

      const handleOpen = () => {
        cleanup()
        resolve()
      }
      const handleClose = () => {
        cleanup()
        reject(new Error("The realtime data channel closed before it was ready."))
      }

      const cleanup = () => {
        window.clearTimeout(timeoutId)
        dataChannel.removeEventListener("open", handleOpen)
        dataChannel.removeEventListener("close", handleClose)
      }

      dataChannel.addEventListener("open", handleOpen)
      dataChannel.addEventListener("close", handleClose)
    })
  }

  private waitForPeerConnection(peerConnection: RTCPeerConnection): Promise<void> {
    if (peerConnection.connectionState === "connected") {
      return Promise.resolve()
    }

    return new Promise((resolve, reject) => {
      const timeoutId = window.setTimeout(() => {
        cleanup()
        reject(new Error("Timed out waiting for the realtime peer connection."))
      }, 10000)

      const handleStateChange = () => {
        if (peerConnection.connectionState === "connected") {
          cleanup()
          resolve()
          return
        }

        if (peerConnection.connectionState === "failed" || peerConnection.connectionState === "closed") {
          cleanup()
          reject(new Error(`The realtime peer connection ${peerConnection.connectionState}.`))
        }
      }

      const cleanup = () => {
        window.clearTimeout(timeoutId)
        peerConnection.removeEventListener("connectionstatechange", handleStateChange)
      }

      peerConnection.addEventListener("connectionstatechange", handleStateChange)
    })
  }

  private handleRealtimeMessage(data: string): void {
    let event: RealtimeEvent | null = null

    try {
      event = JSON.parse(data) as RealtimeEvent
    } catch (error) {
      console.error("Unable to parse realtime event", error)
      return
    }

    if (event.type === "response.created" && event.response?.id) {
      this.activeResponseId = event.response.id
    }

    if (event.type === "response.done") {
      if (!event.response?.id || event.response.id === this.activeResponseId) {
        this.activeResponseId = null
      }

      this.outputAudioPlaying = false
    }

    if (event.type === "output_audio_buffer.started") {
      this.outputAudioPlaying = true

      if (event.response_id) {
        this.activeResponseId = event.response_id
      }
    }

    if (event.type === "output_audio_buffer.stopped" || event.type === "output_audio_buffer.cleared") {
      this.outputAudioPlaying = false

      if (event.response_id && event.response_id === this.activeResponseId) {
        this.activeResponseId = null
      }
    }

    if (event.type === "error") {
      console.error("Voice assistant realtime error", event)
      this.onError("Realtime session error. Check the console for details.")
    }

    this.onEvent(event)
  }

  private sendRealtimeEvent(event: unknown): void {
    if (this.dataChannel?.readyState !== "open") {
      return
    }

    this.dataChannel.send(JSON.stringify(event))
  }
}
