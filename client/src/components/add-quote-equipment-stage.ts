import Fuse from "fuse.js"
import { LitElement, css, html } from "lit"
import { fetchEquipment } from "../services/api.ts"
import type { Equipment, QuoteEquipment, QuoteWithDetails } from "../types/databaseTypes.ts"
import { emptyQuote } from "../utils/quote/quote-draft.ts"

export class AddQuoteEquipmentStage extends LitElement {
  static properties = {
    quote: { attribute: false },
    equipment: { state: true },
    loading: { state: true },
    query: { state: true },
    category: { state: true },
  }

  static styles = css`
    main {
      display: grid;
    }

    mdui-circular-progress {
      margin: auto;
    }

    mdui-card {
      padding: 16px;
    }
    .chip-row {
      overflow-x: auto;
      display: flex;
      gap: 0.5rem;
      padding: 0.5rem;
    }

    .search {
      position: sticky;
      top: 64px;
      z-index: 10;
      margin-top: 1rem;
    }

    .stepper {
      display: flex;
      align-items: center;
    }

    .stepper.empty {
      .remove {
        display: none;
      }
      span {
        display: none;
      }
    }

    .top-items {
      display: grid;
      gap: 0.5rem;
    }

    .catalog-list {
      display: grid;
      gap: 1rem;
    }

    .item-card {
      padding: 16px;
      display: grid;
      grid-template-columns: 1fr auto;
      align-items: center;
    }

    .item-head,
    .summary-row {
      display: flex;
      justify-content: space-between;
      gap: 1rem;
    }

    .item-head {
      align-items: center;
    }

    .summary {
      display: grid;
      gap: 12px;
      .summary-row {
        align-items: center;
      }
    }

    .item-copy {
      flex: 1;
      min-width: 0;
    }

    .item-meta {
      color: rgb(0 0 0 / 0.68);
      font-size: 0.95rem;
      margin-top: 0.25rem;
    }

    .unit-price {
      font-weight: 700;
      white-space: nowrap;
    }
  `

  quote: QuoteWithDetails = { ...emptyQuote }
  private equipment: Equipment[] = []
  private loading = true
  private query = ""
  private category = ""

  connectedCallback(): void {
    super.connectedCallback()
    void this.loadEquipment()
  }

  private emit(type: string, detail?: unknown): void {
    this.dispatchEvent(new CustomEvent(type, { detail, bubbles: true, composed: true }))
  }

  private async loadEquipment(): Promise<void> {
    this.loading = true

    try {
      this.equipment = await fetchEquipment()
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

  private categories(): string[] {
    return [...new Set(this.equipment.map((item) => item.category))].sort()
  }

  private filteredEquipmentByCategory(): Equipment[] {
    return this.category ? this.equipment.filter((item) => item.category === this.category) : this.equipment
  }

  private equipmentFuse(): Fuse<Equipment> {
    return new Fuse(this.filteredEquipmentByCategory(), {
      threshold: 0.3,
      keys: ["id", "name", "category", "brand", "modelNumber"],
    })
  }

  private filteredEquipment(): Equipment[] {
    return this.query
      ? this.equipmentFuse()
          .search(this.query)
          .map((result) => result.item)
      : this.filteredEquipmentByCategory()
  }

  private quantityFor(equipmentId: string): number {
    return this.quote.equipments.find((item) => item.equipmentId === equipmentId)?.quantity ?? 0
  }

  private setQuantity(item: Equipment, quantity: number): void {
    const nextQuantity = Math.max(0, Math.trunc(quantity))
    const nextEquipments = [...this.quote.equipments]
    const existingIndex = nextEquipments.findIndex((selection) => selection.equipmentId === item.id)

    if (nextQuantity === 0) {
      if (existingIndex >= 0) {
        nextEquipments.splice(existingIndex, 1)
      }
    } else {
      const nextSelection: QuoteEquipment = {
        quoteId: this.quote.id,
        equipmentId: item.id,
        quantity: nextQuantity,
        price: item.baseCost,
      }

      if (existingIndex >= 0) {
        nextEquipments[existingIndex] = nextSelection
      } else {
        nextEquipments.push(nextSelection)
      }
    }

    this.updateQuote({ equipments: nextEquipments })
  }

  private changeQuantity(item: Equipment, delta: number): void {
    this.setQuantity(item, this.quantityFor(item.id) + delta)
  }

  private equipmentSubtotal(): number {
    return this.quote.equipments.reduce((total, selection) => total + selection.price * selection.quantity, 0)
  }

  private selectedUnits(): number {
    return this.quote.equipments.reduce((total, selection) => total + selection.quantity, 0)
  }

  private formatMoney(value: number): string {
    return new Intl.NumberFormat(undefined, {
      style: "currency",
      currency: "USD",
      maximumFractionDigits: 2,
    }).format(value)
  }

  render() {
    return html`
      <mdui-top-app-bar>
        <mdui-button-icon icon="arrow_back" @click=${() => this.emit("back")}></mdui-button-icon>
        <mdui-top-app-bar-title>Choose Equipment</mdui-top-app-bar-title>
        <mdui-button @click=${() => this.emit("continue")}>Continue</mdui-button>
      </mdui-top-app-bar>

      <main>
        ${this.loading
          ? html`<mdui-circular-progress indeterminate></mdui-circular-progress> `
          : html` <div class="top-items">
                <mdui-card>
                  <div><strong>${this.quote.customer.name}</strong></div>
                  <div>${this.quote.customer.address}</div>
                </mdui-card>

                <mdui-card class="summary">
                  <div class="summary-row">
                    <span>Selected Units</span>
                    <strong>${this.selectedUnits()}</strong>
                  </div>
                  <div class="summary-row">
                    <span>Equipment Subtotal</span>
                    <strong>${this.formatMoney(this.equipmentSubtotal())}</strong>
                  </div>
                </mdui-card>
              </div>

              <mdui-text-field
                class="search"
                icon="search"
                label="Search equipment"
                .value=${this.query}
                @input=${(event: Event) => {
                  this.query = (event.target as HTMLInputElement).value
                }}
              ></mdui-text-field>

              <div class="chip-row">
                <mdui-chip clickable ?selected=${this.category === ""} @click=${() => (this.category = "")}
                  >All</mdui-chip
                >
                ${this.categories().map(
                  (category) => html`
                    <mdui-chip
                      clickable
                      ?selected=${this.category === category}
                      @click=${() => {
                        this.category = category
                      }}
                      >${category}</mdui-chip
                    >
                  `,
                )}
              </div>

              <div class="catalog-list">
                ${this.filteredEquipment().map(
                  (item) => html`
                    <mdui-card class="item-card">
                      <div class="item-head">
                        <div class="item-copy">
                          <div><strong>${item.name}</strong></div>
                          <div class="item-meta">${item.category} • ${item.brand} • ${item.modelNumber}</div>
                        </div>
                        <div class="unit-price">${this.formatMoney(item.baseCost)}</div>
                      </div>

                      <div class=${"stepper" + (this.quantityFor(item.id) == 0 ? " empty" : "")}>
                        <mdui-button-icon
                          class="remove"
                          icon="remove"
                          @click=${() => this.changeQuantity(item, -1)}
                        ></mdui-button-icon>
                        <span>${String(this.quantityFor(item.id))}</span>
                        <mdui-button-icon
                          class="add"
                          icon="add"
                          @click=${() => this.changeQuantity(item, 1)}
                        ></mdui-button-icon>
                      </div>
                    </mdui-card>
                  `,
                )}
              </div>`}
      </main>
    `
  }
}

customElements.define("add-quote-equipment-stage", AddQuoteEquipmentStage)
