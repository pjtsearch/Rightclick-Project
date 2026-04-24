import { LitElement, css, html } from "lit"
import type { QuoteLine, QuoteWithDetails } from "./types.ts"

export class QuoteCard extends LitElement {
  static properties = {
    quote: { attribute: false },
  }

  static styles = css`
    :host {
      display: block;
      margin-bottom: 1rem;
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
  `

  quote?: QuoteWithDetails

  private formatDate(value: string): string {
    return new Intl.DateTimeFormat(undefined, {
      month: "short",
      day: "numeric",
      year: "numeric",
    }).format(new Date(`${value}T12:00:00`))
  }

  private formatMoney(value: number): string {
    return new Intl.NumberFormat(undefined, {
      style: "currency",
      currency: "USD",
      maximumFractionDigits: 2,
    }).format(value)
  }

  private lineLabel(line: QuoteLine): string {
    if (line.type === "equipment") {
      return line.equipmentId ?? "Equipment"
    }

    if (line.type === "labor") {
      return line.laborId ?? "Labor"
    }

    return line.name ?? "Other"
  }

  private quoteTotal(quote: QuoteWithDetails): number {
    return quote.lines.reduce((total, line) => total + line.price, 0)
  }

  render() {
    if (!this.quote) {
      return html``
    }

    return html`
      <mdui-card style="padding: 16px;">
        <div class="quote-head">
          <div>
            <div>Quote #${this.quote.id}</div>
            <div><strong>${this.quote.customer.name}</strong></div>
          </div>
          <mdui-chip>${this.quote.lines.length} lines</mdui-chip>
        </div>

        <div class="quote-summary">
          <div>${this.formatDate(this.quote.date)}</div>
          <div>${this.quote.surcharge}%</div>
          <div>
            <strong>${this.formatMoney(this.quoteTotal(this.quote))}</strong>
          </div>
        </div>

        <mdui-list>
          ${this.quote.lines.slice(0, 3).map(
            (line) => html`
              <mdui-list-item rounded>
                <div slot="headline">${this.lineLabel(line)}</div>
                <div slot="description">${line.type}</div>
                <div slot="end-icon">${this.formatMoney(line.price)}</div>
              </mdui-list-item>
            `,
          )}
        </mdui-list>
      </mdui-card>
    `
  }
}

customElements.define("quote-card", QuoteCard)
