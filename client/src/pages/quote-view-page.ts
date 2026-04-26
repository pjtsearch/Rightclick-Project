import { LitElement, css, html } from "lit"
import { deleteQuote, fetchEquipment, fetchLaborRates, fetchQuote } from "../services/api.ts"
import { navigate } from "../services/navigation.ts"
import { formatQuoteTimestamp } from "../utils/quote/quote-date.ts"
import { getLaborTotal, getQuoteEquipmentTotal, getQuoteTotal } from "../utils/quote/quote-totals.ts"
import type { Equipment, LaborRate, QuoteWithDetails } from "../types/databaseTypes.ts"

export class QuoteViewPage extends LitElement {
  static properties = {
    quote: { attribute: false },
    loading: { state: true },
    quoteId: { attribute: false },
    confirmDeleteOpen: { state: true },
    deleting: { state: true },
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

    @media print {
      mdui-top-app-bar {
        display: none;
      }

      main {
        padding: 0;
        max-width: none;
      }

      .total {
        position: static;
      }
    }
  `

  quote: QuoteWithDetails | null = null
  quoteId = ""
  private equipment: Equipment[] = []
  private laborRates: LaborRate[] = []
  private loading = true
  private confirmDeleteOpen = false
  private deleting = false

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
    return formatQuoteTimestamp(value)
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

  private handlePrint(): void {
    window.print()
  }

  private async handleDelete(): Promise<void> {
    if (!this.quote) {
      return
    }

    this.deleting = true

    try {
      await deleteQuote(this.quote.id)
      this.confirmDeleteOpen = false
      navigate("/")
    } finally {
      this.deleting = false
    }
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
        <mdui-button variant="outlined" @click=${() => this.handlePrint()}>Print</mdui-button>
        <mdui-button
          variant="outlined"
          @click=${() => {
            this.confirmDeleteOpen = true
          }}
          >Delete</mdui-button
        >
        <mdui-button @click=${() => this.handleDone()}>Done</mdui-button>
      </mdui-top-app-bar>

      <main>
        <mdui-card class="section" style="padding: 16px;">
          <div><strong>HVAC Quote for ${this.quote.customer.name}</strong></div>
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

      <mdui-dialog
        .open=${this.confirmDeleteOpen}
        @close=${() => {
          if (!this.deleting) {
            this.confirmDeleteOpen = false
          }
        }}
      >
        <div style="padding: 24px 24px 8px;">
          <div style="font-size: 1.1rem; font-weight: 700;">Delete Quote?</div>
          <div style="margin-top: 8px; color: rgb(0 0 0 / 0.72);">This will permanently remove this quote.</div>
        </div>
        <div slot="action" style="display: flex; gap: 0.75rem; justify-content: flex-end; padding: 0 24px 24px;">
          <mdui-button
            ?disabled=${this.deleting}
            @click=${() => {
              this.confirmDeleteOpen = false
            }}
            >Cancel</mdui-button
          >
          <mdui-button variant="filled" ?loading=${this.deleting} @click=${() => void this.handleDelete()}
            >Delete</mdui-button
          >
        </div>
      </mdui-dialog>
    `
  }
}

customElements.define("quote-view-page", QuoteViewPage)
