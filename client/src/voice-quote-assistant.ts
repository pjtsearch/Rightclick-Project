import { LitElement, css, html, type PropertyValues } from "lit"
import { fetchCustomers, fetchEquipment, fetchLaborRates, fetchRealtimeClientSecret } from "./api.ts"
import { createEmptyCustomer } from "./quote-draft.ts"
import { RealtimeVoiceSession } from "./realtime-voice-session.ts"
import type { Customer, Equipment, LaborRate, QuoteWithDetails } from "./types.ts"
import type { QuoteVoiceUpdatePayload, RealtimeEvent, VoiceAssistantAction, VoiceAssistantContext } from "./voice-assistant.ts"
import { buildUpdateQuoteTool, buildVoiceAssistantInstructions, updateQuoteToolName } from "./voice-assistant-prompt.ts"
import { normalizeAssistantAction, normalizeNewCustomer, normalizeQuote } from "./voice-assistant-normalizers.ts"
import type { QuoteStage } from "./voice-assistant.ts"

export class VoiceQuoteAssistant extends LitElement {
  static properties = {
    quote: { attribute: false },
    stage: { attribute: false },
    newCustomer: { attribute: false },
    newCustomerDialogIsOpen: { type: Boolean },
    customers: { state: true },
    equipment: { state: true },
    laborRates: { state: true },
    loading: { state: true },
    connecting: { state: true },
    listening: { state: true },
    online: { state: true },
    errorMessage: { state: true },
  }

  static styles = css`
    .voice-fab {
      position: fixed;
      left: 1rem;
      bottom: calc(1rem + env(safe-area-inset-bottom));
      z-index: 10000;
      touch-action: none;
      user-select: none;
    }
  `

  quote: QuoteWithDetails = {
    id: "",
    surcharge: 0,
    date: "",
    customer: {
      id: "",
      name: "",
      address: "",
      phone: null,
      propertyType: null,
      squareFootage: null,
      systemType: null,
      systemAge: null,
      lastServiceDate: null,
    },
    equipments: [],
    labors: [],
  }
  stage: QuoteStage = "customer"
  newCustomer: Customer = createEmptyCustomer()
  newCustomerDialogIsOpen = false
  private customers: Customer[] = []
  private equipment: Equipment[] = []
  private laborRates: LaborRate[] = []
  private loading = true
  private connecting = false
  private listening = false
  private online = navigator.onLine
  private errorMessage: string | null = null
  private pointerIsDown = false
  private processedCallIds = new Set<string>()
  private readonly session = new RealtimeVoiceSession({
    getClientSecret: () => fetchRealtimeClientSecret(),
    onEvent: (event) => {
      this.handleRealtimeEvent(event)
    },
    onConnectingChange: (connecting) => {
      this.connecting = connecting
    },
    onListeningChange: (listening) => {
      this.listening = listening
    },
    onError: (message) => {
      this.errorMessage = message
    },
  })

  connectedCallback(): void {
    super.connectedCallback()
    window.addEventListener("online", this.handleOnline)
    window.addEventListener("offline", this.handleOffline)
    void this.loadContext()
  }

  disconnectedCallback(): void {
    window.removeEventListener("online", this.handleOnline)
    window.removeEventListener("offline", this.handleOffline)
    this.session.disconnect()
    super.disconnectedCallback()
  }

  protected updated(changedProperties: PropertyValues<this>): void {
    if (
      changedProperties.has("quote") ||
      changedProperties.has("stage") ||
      changedProperties.has("newCustomer") ||
      changedProperties.has("newCustomerDialogIsOpen") ||
      changedProperties.has("customers") ||
      changedProperties.has("equipment") ||
      changedProperties.has("laborRates")
    ) {
      // Keep the live session prompt aligned with the latest draft so the next utterance uses current app state.
      this.updateSessionInstructions()
    }
  }

  private readonly handleOnline = (): void => {
    this.online = true
    this.errorMessage = null
  }

  private readonly handleOffline = (): void => {
    this.online = false
    this.session.stopListening()
  }

  private getAssistantContext(): VoiceAssistantContext {
    return {
      quote: this.quote,
      stage: this.stage,
      newCustomer: this.newCustomer,
      newCustomerDialogIsOpen: this.newCustomerDialogIsOpen,
      customers: this.customers,
      equipment: this.equipment,
      laborRates: this.laborRates,
    }
  }

  private updateSessionInstructions(): void {
    this.session.updateSession({
      instructions: buildVoiceAssistantInstructions(this.getAssistantContext()),
      tools: [buildUpdateQuoteTool()],
    })
  }

  private async loadContext(): Promise<void> {
    this.loading = true

    try {
      const [customers, equipment, laborRates] = await Promise.all([
        fetchCustomers(),
        fetchEquipment(),
        fetchLaborRates(),
      ])
      this.customers = customers
      this.equipment = equipment
      this.laborRates = laborRates
      this.errorMessage = null
    } catch (error) {
      this.errorMessage = error instanceof Error ? error.message : "Unable to load quote assistant data."
    } finally {
      this.loading = false
    }
  }

  private emitQuoteChanged(quote: QuoteWithDetails): void {
    this.dispatchEvent(
      new CustomEvent<QuoteWithDetails>("quote-changed", {
        detail: quote,
        bubbles: true,
        composed: true,
      }),
    )
  }

  private emitAssistantAction(action: VoiceAssistantAction): void {
    this.dispatchEvent(
      new CustomEvent<VoiceAssistantAction>("assistant-action", {
        detail: action,
        bubbles: true,
        composed: true,
      }),
    )
  }

  private emitNewCustomerChanged(customer: Customer): void {
    this.dispatchEvent(
      new CustomEvent<Customer>("new-customer-edited", {
        detail: customer,
        bubbles: true,
        composed: true,
      }),
    )
  }

  private buttonLabel(): string {
    if (!this.online) {
      return "Voice Offline"
    }

    if (this.loading) {
      return "Loading Voice"
    }

    if (this.connecting) {
      return "Connecting..."
    }

    if (this.listening) {
      return "Listening..."
    }

    if (this.errorMessage) {
      return "Retry Voice"
    }

    return "Hold to Talk"
  }

  private async handlePointerDown(event: PointerEvent): Promise<void> {
    if (!this.online || this.loading) {
      return
    }

    event.preventDefault()
    this.pointerIsDown = true
    this.errorMessage = null

    const currentTarget = event.currentTarget

    if (currentTarget instanceof HTMLElement && "setPointerCapture" in currentTarget) {
      currentTarget.setPointerCapture(event.pointerId)
    }

    try {
      this.updateSessionInstructions()
      await this.session.ensureOpen()

      // The user might release before WebRTC finishes connecting, so only start the mic if they are still holding.
      if (this.pointerIsDown) {
        this.session.startListening()
      }
    } catch (error) {
      console.error("Unable to start voice quote assistant", error)
      this.errorMessage = error instanceof Error ? error.message : "Voice assistant unavailable."
      this.pointerIsDown = false
      this.session.stopListening()
    }
  }

  private handlePointerUp(event: PointerEvent): void {
    if (event.currentTarget instanceof HTMLElement && event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId)
    }

    this.pointerIsDown = false
    this.session.stopListening()
  }

  private handleRealtimeEvent(event: RealtimeEvent): void {
    if (event.type === "response.output_item.done" && event.item) {
      this.handleFunctionCall(event.item)
      return
    }

    if (event.type === "response.done" && event.response?.output) {
      for (const item of event.response.output) {
        this.handleFunctionCall(item)
      }
    }
  }

  private handleFunctionCall(item: { type?: string; name?: string; call_id?: string; arguments?: string }): void {
    if (item.type !== "function_call" || item.name !== updateQuoteToolName || !item.call_id) {
      return
    }

    if (this.processedCallIds.has(item.call_id)) {
      return
    }

    this.processedCallIds.add(item.call_id)

    try {
      const payload = JSON.parse(item.arguments ?? "{}") as QuoteVoiceUpdatePayload
      const context = this.getAssistantContext()
      const action = normalizeAssistantAction(payload, context)
      const nextQuote = normalizeQuote(payload.quote, context)
      const nextNewCustomer = normalizeNewCustomer(
        payload.newCustomer ??
          (this.newCustomerDialogIsOpen && payload.quote?.customer && typeof payload.quote.customer === "object"
            ? payload.quote.customer
            : null),
        context,
      )

      if (action?.openNewCustomerDialog) {
        // Open the dialog before applying draft edits so the parent can route those edits into the right state bucket.
        this.emitAssistantAction(action)
      }

      if (nextNewCustomer) {
        this.emitNewCustomerChanged(nextNewCustomer)
      }

      this.emitQuoteChanged(nextQuote)

      if (action && !action.openNewCustomerDialog) {
        this.emitAssistantAction(action)
      }

      this.session.sendEvent({
        type: "conversation.item.create",
        item: {
          type: "function_call_output",
          call_id: item.call_id,
          output: JSON.stringify({
            ok: true,
            note: payload.note ?? "Quote updated.",
            quote: nextQuote,
          }),
        },
      })
      this.session.sendEvent({ type: "response.create" })
    } catch (error) {
      console.error("Unable to apply voice quote update", error)
      this.session.sendEvent({
        type: "conversation.item.create",
        item: {
          type: "function_call_output",
          call_id: item.call_id,
          output: JSON.stringify({
            ok: false,
            error: error instanceof Error ? error.message : "Unable to apply the quote changes.",
          }),
        },
      })
      this.session.sendEvent({ type: "response.create" })
    }
  }

  render() {
    return html`
      <mdui-fab
        class="voice-fab"
        extended
        icon=${this.listening ? "mic" : "keyboard_voice"}
        ?disabled=${!this.online || this.loading}
        @pointerdown=${(event: PointerEvent) => {
          void this.handlePointerDown(event)
        }}
        @pointerup=${this.handlePointerUp}
        @pointercancel=${this.handlePointerUp}
        @lostpointercapture=${this.handlePointerUp}
      >
        ${this.buttonLabel()}
      </mdui-fab>
    `
  }
}

customElements.define("voice-quote-assistant", VoiceQuoteAssistant)
