import Fuse from "fuse.js"
import { LitElement, css, html } from "lit"
import { fetchEquipment, fetchLaborRates } from "../services/api.ts"
import type { Equipment, LaborRate, QuoteLabor, QuoteWithDetails } from "../types/databaseTypes.ts"
import { emptyQuote } from "../utils/quote/quote-draft.ts"

export class AddQuoteLaborStage extends LitElement {
  static properties = {
    quote: { attribute: false },
    equipment: { state: true },
    laborRates: { state: true },
    loading: { state: true },
    query: { state: true },
  }

  static styles = css`
    mdui-card {
      padding: 16px;
    }

    .search {
      position: sticky;
      top: 64px;
      z-index: 10;
      margin-top: 1rem;
      margin-bottom: 0.5rem;
    }

    .top-items {
      display: grid;
      gap: 0.5rem;
    }

    .catalog-list {
      display: grid;
      gap: 1rem;
    }

    .stepper {
      display: flex;
      align-items: center;
      mdui-text-field {
        width: 80px;
      }
    }

    .stepper.empty {
      .remove {
        display: none;
      }
      mdui-text-field {
        display: none;
      }
    }

    .item-card {
      display: grid;
      grid-template-columns: 1fr auto;
      align-items: center;
    }

    .item-start {
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 1rem;
    }

    .item-total {
      font-weight: bold;
    }

    .summary-row {
      display: flex;
      justify-content: space-between;
      gap: 1rem;
    }

    .summary-row {
      align-items: center;
    }

    .item-meta {
      color: rgb(0 0 0 / 0.68);
      font-size: 0.95rem;
      margin-top: 0.25rem;
    }
  `

  quote: QuoteWithDetails = { ...emptyQuote }
  private equipment: Equipment[] = []
  private laborRates: LaborRate[] = []
  private loading = true
  private query = ""

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

  private laborFuse(): Fuse<LaborRate> {
    return new Fuse(this.laborRates, {
      threshold: 0.3,
      keys: ["jobId", "name"],
    })
  }

  private filteredLaborRates(): LaborRate[] {
    return this.query
      ? this.laborFuse()
          .search(this.query)
          .map((result) => result.item)
      : this.laborRates
  }

  private hoursFor(laborId: string): number {
    return this.quote.labors.find((item) => item.laborId === laborId)?.hours ?? 0
  }

  private normalizeHours(hours: number): number {
    return Math.max(0, Math.round(hours * 2) / 2)
  }

  private setHours(item: LaborRate, hours: number): void {
    const nextHours = this.normalizeHours(hours)
    const nextLabors = [...this.quote.labors]
    const existingIndex = nextLabors.findIndex((selection) => selection.laborId === item.jobId)

    if (nextHours === 0) {
      if (existingIndex >= 0) {
        nextLabors.splice(existingIndex, 1)
      }
    } else {
      const nextSelection: QuoteLabor = {
        quoteId: this.quote.id,
        laborId: item.jobId,
        hours: nextHours,
        price: item.hourlyRate,
      }

      if (existingIndex >= 0) {
        nextLabors[existingIndex] = nextSelection
      } else {
        nextLabors.push(nextSelection)
      }
    }

    this.updateQuote({ labors: nextLabors })
  }

  private changeHours(item: LaborRate, delta: number): void {
    this.setHours(item, this.hoursFor(item.jobId) + delta)
  }

  private equipmentSubtotal(): number {
    return this.quote.equipments.reduce((total, selection) => total + selection.price * selection.quantity, 0)
  }

  private laborSubtotal(): number {
    return this.quote.labors.reduce((total, selection) => total + selection.price * selection.hours, 0)
  }

  private quoteTotal(): number {
    return this.equipmentSubtotal() + this.laborSubtotal()
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
          <mdui-top-app-bar-title>Choose Labor</mdui-top-app-bar-title>
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
        <mdui-top-app-bar-title>Quote Labor</mdui-top-app-bar-title>
        <div style="flex-grow: 1;"></div>
        <mdui-button @click=${() => this.emit("continue")}>Continue</mdui-button>
      </mdui-top-app-bar>

      <main>
        <div class="top-items">
          <mdui-card class="section" style="padding: 16px;">
            <div><strong>${this.quote.customer.name}</strong></div>
            <div>${this.quote.customer.address}</div>
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
          </mdui-card>
        </div>

        <mdui-text-field
          class="search"
          icon="search"
          label="Search labor"
          .value=${this.query}
          @input=${(event: Event) => {
            this.query = (event.target as HTMLInputElement).value
          }}
        ></mdui-text-field>

        <div class="catalog-list">
          ${this.filteredLaborRates().map(
            (item) => html`
              <mdui-card class="item-card">
                <div class="item-start">
                  <div class="item-left">
                    <div><strong>${item.name}</strong></div>
                    <div class="item-meta">
                      ${item.estimatedHoursMin}–${item.estimatedHoursMax} hr • ${this.formatMoney(item.hourlyRate)}/hr
                    </div>
                  </div>
                  ${this.hoursFor(item.jobId) != 0
                    ? html`<div class="item-total">
                        ${this.formatMoney(item.hourlyRate * this.hoursFor(item.jobId))}
                      </div>`
                    : ""}
                </div>

                <div class=${"stepper" + (this.hoursFor(item.jobId) == 0 ? " empty" : "")}>
                  <mdui-button-icon
                    class="remove"
                    icon="remove"
                    @click=${() => this.changeHours(item, -0.5)}
                  ></mdui-button-icon>
                  <mdui-text-field
                    type="number"
                    step="0.5"
                    min="0"
                    label="Hours"
                    .value=${String(this.hoursFor(item.jobId))}
                    @input=${(event: Event) => {
                      this.setHours(item, Number((event.target as HTMLInputElement).value || 0))
                    }}
                  ></mdui-text-field>
                  <mdui-button-icon
                    class="add"
                    icon="add"
                    @click=${() => this.changeHours(item, 0.5)}
                  ></mdui-button-icon>
                </div>
              </mdui-card>
            `,
          )}
        </div>

        <mdui-card style="padding: 16px;">
          <div class="summary-row">
            <span>Subtotal</span>
            <strong>${this.formatMoney(this.quoteTotal())}</strong>
          </div>
        </mdui-card>
      </main>
    `
  }
}

customElements.define("add-quote-labor-stage", AddQuoteLaborStage)
