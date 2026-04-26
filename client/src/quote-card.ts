import { LitElement, css, html } from "lit"
import { formatQuoteTimestamp } from "./quote-date.ts"
import type { QuoteWithDetails } from "./types.ts"
import { getQuoteTotal } from "./quote-totals.ts"

export class QuoteCard extends LitElement {
  static properties = {
    quote: { attribute: false },
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
      color: rgb(196 92 0);
      font-size: 0.9rem;
      font-weight: 600;
    }
  `

  quote?: QuoteWithDetails

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

  render() {
    if (!this.quote) {
      return html``
    }

    return html`
      <mdui-card>
        <div class="quote-head">
          <div><strong>${this.quote.customer.name}</strong></div>
          <div>${this.formatDate(this.quote.date)}</div>
        </div>

        <div class="quote-summary">
          <strong>${this.formatMoney(this.quoteTotal(this.quote))}</strong>
        </div>

        ${this.quote.syncStatus === "pending" ? html`<div class="quote-status">Pending Upload</div>` : ""}
      </mdui-card>
    `
  }
}

customElements.define("quote-card", QuoteCard)
