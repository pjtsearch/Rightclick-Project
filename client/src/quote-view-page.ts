import { LitElement, css, html } from "lit"
import { fetchEquipment, fetchLaborRates, fetchQuote } from "./api.ts"
import { navigate } from "./navigation.ts"
import { getLaborTotal, getQuoteEquipmentTotal, getQuoteTotal } from "./quote-totals.ts"
import type { Equipment, LaborRate, QuoteWithDetails } from "./types.ts"

export class QuoteViewPage extends LitElement {
  static properties = {
    quote: { attribute: false },
    loading: { state: true },
    quoteId: { attribute: false },
  }

  static styles = css`
    :host {
    }

    main {
      padding: 1rem 1rem 6rem;
      max-width: 32rem;
      margin: 0 auto;
      display: grid;
    }

    .section {
      margin-bottom: 1rem;
    }

    .total {
      position: sticky;
      bottom: 0;
      padding: 1rem;
      border-top: 1px solid rgb(0 0 0 / 0.08);
      display: flex;
      justify-content: space-between;
      font-weight: 700;
    }
  `

  quote: QuoteWithDetails | null = null
  quoteId = ""
  private equipment: Equipment[] = []
  private laborRates: LaborRate[] = []
  private loading = true

  connectedCallback(): void {
    super.connectedCallback()
    void this.loadQuote()
  }

  updated(changed: Map<string, unknown>): void {
    if (changed.has("quoteId")) {
      void this.loadQuote()
    }
  }

  private async loadQuote(): Promise<void> {
    if (!this.quoteId) {
      return
    }

    this.loading = true

    try {
      this.quote = await fetchQuote(this.quoteId)
      this.equipment = await fetchEquipment()
      this.laborRates = await fetchLaborRates()
    } finally {
      this.loading = false
    }
  }

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

  private quoteTotal(): number {
    return this.quote ? getQuoteTotal(this.quote) : 0
  }

  private equipmentSubtotal(): number {
    return this.quote ? getQuoteEquipmentTotal(this.quote) : 0
  }

  private laborSubtotal(): number {
    return this.quote ? getLaborTotal(this.quote) : 0
  }

  private handleDone(): void {
    navigate("/")
  }

  render() {
    if (this.loading) {
      return html`
        <mdui-top-app-bar>
          <mdui-top-app-bar-title>Quote Summary</mdui-top-app-bar-title>
        </mdui-top-app-bar>
        <main>
          <mdui-card style="padding: 24px; text-align: center;">
            <mdui-circular-progress indeterminate></mdui-circular-progress>
          </mdui-card>
        </main>
      `
    }

    if (!this.quote) {
      return html``
    }

    return html`
      <mdui-top-app-bar>
        <mdui-top-app-bar-title>Quote Summary</mdui-top-app-bar-title>
        <div style="flex-grow: 1;"></div>
        <mdui-button @click=${() => this.handleDone()}>Done</mdui-button>
      </mdui-top-app-bar>

      <main>
        <mdui-card class="section" style="padding: 16px;">
          <div><strong>${this.quote.customer.name}</strong></div>
          <div>${this.quote.customer.address}</div>
          <div>${this.formatDate(this.quote.date)}</div>
          <div>Surcharge: ${this.quote.surcharge}%</div>
        </mdui-card>

        <mdui-card class="section">
          <div style="padding: 16px 16px 0;">
            <strong>Equipment</strong>
          </div>
          <mdui-list>
            ${this.quote.equipments.length
              ? this.quote.equipments.map((item) => {
                  const equipment = this.equipment.find(({ id }) => id === item.equipmentId)
                  return html`
                    <mdui-list-item>
                      ${equipment!.name}
                      <div slot="description">${equipment!.category} • Qty ${item.quantity}</div>
                      <div slot="end-icon">${this.formatMoney(item.price)}</div>
                    </mdui-list-item>
                  `
                })
              : html` <mdui-list-item> No equipment selected </mdui-list-item> `}
          </mdui-list>
        </mdui-card>

        <mdui-card class="section">
          <div style="padding: 16px 16px 0;">
            <strong>Labor</strong>
          </div>
          <mdui-list>
            ${this.quote.labors.length
              ? this.quote.labors.map((item) => {
                  const labor = this.laborRates.find(({ jobId }) => jobId == item.laborId)
                  return html`
                    <mdui-list-item>
                      ${labor!.name}
                      <div slot="description">${item.hours} hr • ${this.formatMoney(item.price / item.hours)}/hr</div>
                      <div slot="end-icon">${this.formatMoney(item.price)}</div>
                    </mdui-list-item>
                  `
                })
              : html` <mdui-list-item> No labor selected </mdui-list-item> `}
          </mdui-list>
        </mdui-card>

        <mdui-card class="section" style="padding: 16px;">
          <div style="display: flex; justify-content: space-between;">
            <span>Equipment Subtotal</span>
            <strong>${this.formatMoney(this.equipmentSubtotal())}</strong>
          </div>
          <div style="display: flex; justify-content: space-between; margin-top: 12px;">
            <span>Labor Subtotal</span>
            <strong>${this.formatMoney(this.laborSubtotal())}</strong>
          </div>
        </mdui-card>

        <div class="total">
          <span>Total</span>
          <span>${this.formatMoney(this.quoteTotal())}</span>
        </div>
      </main>
    `
  }
}

customElements.define("quote-view-page", QuoteViewPage)
