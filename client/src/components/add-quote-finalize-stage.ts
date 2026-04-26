import { LitElement, css, html } from "lit"
import { fetchEquipment, fetchLaborRates } from "../services/api.ts"
import { getLaborTotal, getQuoteEquipmentTotal, getQuoteTotal } from "../utils/quote/quote-totals.ts"
import type { Equipment, LaborRate, QuoteWithDetails } from "../types/databaseTypes.ts"
import { emptyQuote } from "../utils/quote/quote-draft.ts"

export class AddQuoteFinalizeStage extends LitElement {
  static properties = {
    quote: { attribute: false },
    equipment: { state: true },
    laborRates: { state: true },
    loading: { state: true },
  }

  static styles = css`
    main {
      padding: 1rem 1rem 6rem;
      max-width: 32rem;
      margin: 0 auto;
      display: grid;
    }

    .section {
      margin-bottom: 1rem;
    }

    .summary-row {
      display: flex;
      justify-content: space-between;
      gap: 1rem;
      align-items: center;
    }
  `

  quote: QuoteWithDetails = { ...emptyQuote }
  private equipment: Equipment[] = []
  private laborRates: LaborRate[] = []
  private loading = true

  connectedCallback(): void {
    super.connectedCallback()
    void this.loadData()
  }

  private emit(type: string, detail?: unknown): void {
    this.dispatchEvent(new CustomEvent(type, { detail, bubbles: true, composed: true }))
  }

  private async loadData(): Promise<void> {
    this.loading = true

    try {
      const [equipment, laborRates] = await Promise.all([fetchEquipment(), fetchLaborRates()])
      this.equipment = equipment
      this.laborRates = laborRates
    } finally {
      this.loading = false
    }
  }

  private updateQuote(update: Partial<QuoteWithDetails>): void {
    this.emit("quote-changed", {
      ...this.quote,
      ...update,
    })
  }

  private equipmentItem(equipmentId: string): Equipment | undefined {
    return this.equipment.find((item) => item.id === equipmentId)
  }

  private laborRateItem(laborId: string): LaborRate | undefined {
    return this.laborRates.find((item) => item.jobId === laborId)
  }

  private equipmentSubtotal(): number {
    return getQuoteEquipmentTotal(this.quote)
  }

  private laborSubtotal(): number {
    return getLaborTotal(this.quote)
  }

  private total(): number {
    return getQuoteTotal(this.quote)
  }

  private formatMoney(value: number): string {
    return new Intl.NumberFormat(undefined, {
      style: "currency",
      currency: "USD",
      maximumFractionDigits: 2,
    }).format(value)
  }

  render() {
    if (this.loading) {
      return html`
        <mdui-top-app-bar>
          <mdui-top-app-bar-title>Finalize Quote</mdui-top-app-bar-title>
        </mdui-top-app-bar>

        <main>
          <mdui-card style="padding: 24px; text-align: center;">
            <mdui-circular-progress indeterminate></mdui-circular-progress>
          </mdui-card>
        </main>
      `
    }

    return html`
      <mdui-top-app-bar>
        <mdui-button-icon icon="arrow_back" @click=${() => this.emit("back")}></mdui-button-icon>
        <mdui-top-app-bar-title>Finalize Quote</mdui-top-app-bar-title>
        <div style="flex-grow: 1;"></div>
        <mdui-button @click=${() => this.emit("save")}> Save Quote </mdui-button>
      </mdui-top-app-bar>

      <main>
        <mdui-card class="section" style="padding: 16px;">
          <div><strong>${this.quote.customer.name}</strong></div>
          <div>${this.quote.customer.address}</div>
        </mdui-card>

        <mdui-card class="section">
          <div style="padding: 16px 16px 0;">
            <strong>Equipment</strong>
          </div>
          <mdui-list>
            ${this.quote.equipments.length
              ? this.quote.equipments.map((item) => {
                  const equipment = this.equipmentItem(item.equipmentId)

                  return html`
                    <mdui-list-item rounded>
                      ${equipment?.name ?? item.equipmentId}
                      <div slot="description">
                        ${equipment?.category ?? "Equipment"} • Qty ${item.quantity} • ${this.formatMoney(item.price)}
                        each
                      </div>
                      <div slot="end-icon">${this.formatMoney(item.price * item.quantity)}</div>
                    </mdui-list-item>
                  `
                })
              : html` <mdui-list-item rounded> No equipment selected </mdui-list-item> `}
          </mdui-list>
        </mdui-card>

        <mdui-card class="section">
          <div style="padding: 16px 16px 0;">
            <strong>Labor</strong>
          </div>
          <mdui-list>
            ${this.quote.labors.length
              ? this.quote.labors.map((item) => {
                  const laborRate = this.laborRateItem(item.laborId)

                  return html`
                    <mdui-list-item rounded>
                      ${laborRate?.name ?? item.laborId}
                      <div slot="description">${item.hours} hr • ${this.formatMoney(item.price)}/hr</div>
                      <div slot="end-icon">${this.formatMoney(item.price * item.hours)}</div>
                    </mdui-list-item>
                  `
                })
              : html` <mdui-list-item rounded> No labor selected </mdui-list-item> `}
          </mdui-list>
        </mdui-card>

        <mdui-card class="section" style="padding: 16px;">
          <div style="margin-bottom: 12px;"><strong>Surcharge</strong></div>
          <div class="summary-row">
            <mdui-button-icon
              icon="remove"
              @click=${() => {
                this.updateQuote({ surcharge: Math.max(0, this.quote.surcharge - 1) })
              }}
            ></mdui-button-icon>
            <mdui-text-field
              type="number"
              step="any"
              suffix="%"
              label="Surcharge"
              .value=${String(this.quote.surcharge)}
              @input=${(event: Event) => {
                this.updateQuote({
                  surcharge: Number((event.target as HTMLInputElement).value || 0),
                })
              }}
            ></mdui-text-field>
            <mdui-button-icon
              icon="add"
              @click=${() => {
                this.updateQuote({ surcharge: this.quote.surcharge + 1 })
              }}
            ></mdui-button-icon>
          </div>
        </mdui-card>

        <mdui-card class="section" style="padding: 16px;">
          <div class="summary-row">
            <span>Equipment Subtotal</span>
            <strong>${this.formatMoney(this.equipmentSubtotal())}</strong>
          </div>
          <div class="summary-row" style="margin-top: 12px;">
            <span>Labor Subtotal</span>
            <strong>${this.formatMoney(this.laborSubtotal())}</strong>
          </div>
          <div class="summary-row" style="margin-top: 12px;">
            <span>Total</span>
            <strong>${this.formatMoney(this.total())}</strong>
          </div>
        </mdui-card>
      </main>
    `
  }
}

customElements.define("add-quote-finalize-stage", AddQuoteFinalizeStage)
