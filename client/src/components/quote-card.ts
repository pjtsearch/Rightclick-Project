import { LitElement, css, html } from "lit"
import { formatQuoteTimestamp } from "../utils/quote/quote-date.ts"
import type { QuoteWithDetails } from "../types/databaseTypes.ts"
import { getQuoteTotal } from "../utils/quote/quote-totals.ts"

export class QuoteCard extends LitElement {
  static properties = {
    quote: { attribute: false },
    accomplishing: { type: Boolean },
  }

  static styles = css`
    :host {
      display: block;
      margin-bottom: 1rem;
    }

    mdui-card {
      width: 100%;
      padding: 1rem;
      cursor: pointer;
    }

    .quote-head,
    .quote-summary {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 0.75rem;
    }

    .quote-summary {
      margin-top: 0.75rem;
    }

    .quote-status {
      margin-top: 0.5rem;
      font-size: 0.9rem;
      font-weight: 600;
    }

    .quote-status.pending {
      color: rgb(196 92 0);
    }

    .quote-status.done {
      color: rgb(21 128 61);
    }
  `

  quote?: QuoteWithDetails
  accomplishing = false

  private formatDate(value: string): string {
    return value ? formatQuoteTimestamp(value) : ""
  }

  private formatMoney(value: number): string {
    return new Intl.NumberFormat(undefined, {
      style: "currency",
      currency: "USD",
      maximumFractionDigits: 2,
    }).format(value)
  }

  private quoteTotal(quote: QuoteWithDetails): number {
    return getQuoteTotal(quote)
  }

  private handleAccomplishClick(event: Event): void {
    event.stopPropagation()

    this.dispatchEvent(
      new CustomEvent("mark-accomplished", {
        bubbles: true,
        composed: true,
      }),
    )
  }

  render() {
    if (!this.quote) {
      return html``
    }

    return html`
      <mdui-card>
        <div class="quote-head">
          <div><strong>${this.quote.customer.name}</strong></div>
          <div style="display: flex; align-items: center; gap: 0.5rem;">
            <div>${this.formatDate(this.quote.date)}</div>
            <mdui-button-icon
              icon=${this.quote.accomplished ? "check_circle" : "radio_button_unchecked"}
              ?disabled=${this.quote.accomplished || this.accomplishing}
              @click=${this.handleAccomplishClick}
            ></mdui-button-icon>
          </div>
        </div>

        <div class="quote-summary">
          <strong>${this.formatMoney(this.quoteTotal(this.quote))}</strong>
        </div>

        ${this.quote.syncStatus === "pending" ? html`<div class="quote-status pending">Pending Upload</div>` : ""}
        ${this.quote.accomplished ? html`<div class="quote-status done">Accomplished</div>` : ""}
      </mdui-card>
    `
  }
}

customElements.define("quote-card", QuoteCard)
