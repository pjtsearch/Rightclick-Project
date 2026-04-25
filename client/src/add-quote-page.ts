import { LitElement, html } from "lit"
import type { Customer, QuoteWithDetails } from "./types.ts"
import "./add-quote-customer-stage.ts"
import "./add-quote-equipment-stage.ts"
import "./add-quote-labor-stage.ts"
import "./add-quote-finalize-stage.ts"
import { createEmptyQuote } from "./quote-draft.ts"

export class AddQuotePage extends LitElement {
  static properties = {
    quote: { attribute: false },
    stage: { state: true },
  }

  quote: QuoteWithDetails = createEmptyQuote()
  private stage: "customer" | "equipment" | "labor" | "finalize" = "customer"

  render() {
    if (this.stage === "customer") {
      return html`
        <add-quote-customer-stage
          .customer=${this.quote.customer}
          @change=${(event: CustomEvent<Customer>) => {
            this.quote.customer = event.detail
          }}
          @continue=${() => {
            this.stage = "equipment"
          }}
        ></add-quote-customer-stage>
      `
    }

    if (this.stage === "equipment") {
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
    }

    if (this.stage === "finalize") {
      return html`
        <add-quote-finalize-stage
          .quote=${this.quote}
          @quote-changed=${(event: CustomEvent<QuoteWithDetails>) => {
            this.quote = event.detail
          }}
          @back=${() => {
            this.stage = "labor"
          }}
        ></add-quote-finalize-stage>
      `
    }

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
  }
}

customElements.define("add-quote-page", AddQuotePage)
