import { LitElement, html } from "lit"
import { createQuote } from "./api.ts"
import type { Customer, QuoteWithDetails } from "./types.ts"
import "./add-quote-customer-stage.ts"
import "./add-quote-equipment-stage.ts"
import "./add-quote-labor-stage.ts"
import "./add-quote-finalize-stage.ts"
import "./voice-quote-assistant.ts"
import { navigate } from "./navigation.ts"
import { generateNewCustomer, generateNewQuote } from "./quote-draft.ts"
import { VoiceAssistantAction } from "./voice-assistant.ts"

type QuoteStage = "customer" | "equipment" | "labor" | "finalize"

export class AddQuotePage extends LitElement {
  static properties = {
    quote: { attribute: false },
    stage: { state: true },
    newCustomerDialogIsOpen: { state: true },
    newCustomer: { attribute: false },
    saving: { state: true },
  }

  quote: QuoteWithDetails = generateNewQuote()
  private stage: QuoteStage = "customer"
  private newCustomerDialogIsOpen = false
  private newCustomer: Customer = generateNewCustomer()
  private saving: boolean = false

  private openNewCustomerDialog(): void {
    this.newCustomer = generateNewCustomer()
    this.newCustomerDialogIsOpen = true
    this.stage = "customer"
  }

  private handleAgentQuoteChanged(event: CustomEvent<QuoteWithDetails>): void {
    if (this.newCustomerDialogIsOpen && this.stage === "customer") {
      return
    }

    const prevQuote = this.quote
    this.quote = event.detail

    // If have selected a customer
    if (this.stage === "customer" && prevQuote.customer.id !== this.quote.customer.id) {
      this.stage = "equipment"
      return
    }

    // If are switching to labor
    if (
      this.stage === "equipment" &&
      event.detail.labors.length > 0 &&
      prevQuote.labors.length !== event.detail.labors.length
    ) {
      this.stage = "labor"
    }
  }

  private handleVoiceAssistantAction(event: CustomEvent<VoiceAssistantAction>): void {
    const action = event.detail
    const previousStage = this.stage

    if (action.confirmNewCustomer) {
      this.quote = {
        ...this.quote,
        customer: this.newCustomer,
      }
      this.newCustomerDialogIsOpen = false
      this.stage = action.stage ?? "equipment"
    }

    if (action.stage) {
      this.stage = action.stage

      if (action.stage !== "customer" && action.openNewCustomerDialog !== true && action.confirmNewCustomer !== true) {
        this.newCustomerDialogIsOpen = false
      }
    }

    if (typeof action.openNewCustomerDialog === "boolean") {
      if (action.openNewCustomerDialog) {
        this.openNewCustomerDialog()
      } else {
        this.newCustomerDialogIsOpen = false
      }
    }

    if (action.saveQuote) {
      if (previousStage !== "finalize") {
        this.stage = "finalize"
        return
      }

      void this.saveQuote()
    }
  }

  private async saveQuote(): Promise<void> {
    if (this.saving) {
      return
    }

    this.saving = true

    try {
      const savedQuote = await createQuote(this.quote)
      navigate(`/quotes/${savedQuote.id}`)
    } catch (_) {
      this.saving = false
    }
  }

  getStageContent() {
    switch (this.stage) {
      case "customer":
        return html`
          <add-quote-customer-stage
            .customer=${this.quote.customer}
            .newCustomer=${this.newCustomer}
            .newDialogIsOpen=${this.newCustomerDialogIsOpen}
            @select-customer=${(event: CustomEvent<Customer>) => {
              this.quote = {
                ...this.quote,
                customer: event.detail,
              }
            }}
            @new-customer-edited=${(event: CustomEvent<Customer>) => {
              this.newCustomer = event.detail
            }}
            @continue=${() => {
              this.newCustomerDialogIsOpen = false
              this.stage = "equipment"
            }}
            @new-customer-dialog-open-changed=${(event: CustomEvent<boolean>) => {
              if (event.detail) {
                this.openNewCustomerDialog()
                return
              }

              this.newCustomerDialogIsOpen = false
            }}
          ></add-quote-customer-stage>
        `
      case "equipment":
        return html`
          <add-quote-equipment-stage
            .quote=${this.quote}
            @quote-changed=${(event: CustomEvent<QuoteWithDetails>) => {
              this.quote = event.detail
            }}
            @continue=${() => {
              this.stage = "labor"
            }}
            @back=${() => {
              this.stage = "customer"
            }}
          ></add-quote-equipment-stage>
        `
      case "labor":
        return html`
          <add-quote-labor-stage
            .quote=${this.quote}
            @quote-changed=${(event: CustomEvent<QuoteWithDetails>) => {
              this.quote = event.detail
            }}
            @continue=${() => {
              this.stage = "finalize"
            }}
            @back=${() => {
              this.stage = "equipment"
            }}
          ></add-quote-labor-stage>
        `
      case "finalize":
        return html`
          <add-quote-finalize-stage
            .quote=${this.quote}
            .saving=${this.saving}
            @quote-changed=${(event: CustomEvent<QuoteWithDetails>) => {
              this.quote = event.detail
            }}
            @save=${() => {
              void this.saveQuote()
            }}
            @back=${() => {
              this.stage = "labor"
            }}
          ></add-quote-finalize-stage>
        `
    }
  }

  render() {
    return html`
      ${this.getStageContent()}
      <voice-quote-assistant
        .quote=${this.quote}
        .stage=${this.stage}
        .newCustomer=${this.newCustomer}
        .newCustomerDialogIsOpen=${this.newCustomerDialogIsOpen}
        @quote-changed=${(event: CustomEvent<QuoteWithDetails>) => this.handleAgentQuoteChanged(event)}
        @new-customer-edited=${(event: CustomEvent<Customer>) => {
          this.newCustomer = event.detail
        }}
        @assistant-action=${(event: CustomEvent<VoiceAssistantAction>) => this.handleVoiceAssistantAction(event)}
      ></voice-quote-assistant>
    `
  }
}

customElements.define("add-quote-page", AddQuotePage)
