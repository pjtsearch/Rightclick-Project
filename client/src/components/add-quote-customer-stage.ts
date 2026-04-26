import Fuse from "fuse.js"
import { LitElement, css, html } from "lit"
import "./add-quote-new-customer-dialog.ts"
import { fetchCustomers } from "../services/api.ts"
import { navigate } from "../services/navigation.ts"
import type { Customer } from "../types/databaseTypes.ts"
import { emptyCustomer } from "../utils/quote/quote-draft.ts"

export class AddQuoteCustomerStage extends LitElement {
  static properties = {
    customer: { attribute: false },
    newCustomer: { attribute: false },
    newDialogIsOpen: { attribute: false },
    customers: { state: true },
    query: { state: true },
    loading: { state: true },
  }

  static styles = css`
    main {
      margin-top: 64px;
      display: grid;
    }

    .search {
      position: sticky;
      top: 64px;
      z-index: 10;
    }

    .fab {
      position: fixed;
      right: 1rem;
      bottom: calc(1rem + env(safe-area-inset-bottom));
      z-index: 20;
    }

    mdui-circular-progress {
      margin: auto;
    }
  `

  customer: Customer = { ...emptyCustomer }
  newCustomer: Customer = { ...emptyCustomer }
  private customers: Customer[] = []
  private query = ""
  private loading = true
  newDialogIsOpen = false

  connectedCallback(): void {
    super.connectedCallback()
    void this.loadCustomers()
  }

  private emit(type: string, detail?: unknown): void {
    this.dispatchEvent(new CustomEvent(type, { detail, bubbles: true, composed: true }))
  }

  private async loadCustomers(): Promise<void> {
    this.loading = true

    try {
      this.customers = await fetchCustomers()
    } finally {
      this.loading = false
    }
  }

  private customerFuse(): Fuse<Customer> {
    return new Fuse(this.customers, {
      threshold: 0.35,
      keys: [
        "id",
        "name",
        "address",
        "phone",
        "propertyType",
        "squareFootage",
        "systemType",
        "systemAge",
        "lastServiceDate",
      ],
    })
  }

  private filteredCustomers(): Customer[] {
    return this.query
      ? this.customerFuse()
          .search(this.query)
          .map((result) => result.item)
      : this.customers
  }

  private selectCustomer(customer: Customer): void {
    this.emit("select-customer", customer)
    this.emit("continue")
  }

  private formatServiceDate(value: string | null): string | null {
    if (!value) {
      return null
    }

    const timestamp = Date.parse(`${value}T00:00:00`)

    if (Number.isNaN(timestamp)) {
      return value
    }

    return new Intl.DateTimeFormat(undefined, {
      month: "short",
      day: "numeric",
      year: "numeric",
    }).format(new Date(timestamp))
  }

  render() {
    return html`
      <mdui-top-app-bar>
        <mdui-button-icon icon="arrow_back" @click=${() => navigate("/")}></mdui-button-icon>
        <mdui-top-app-bar-title>Choose Customer</mdui-top-app-bar-title>
      </mdui-top-app-bar>

      <main>
        ${this.loading
          ? html`<mdui-circular-progress indeterminate></mdui-circular-progress> `
          : html`
              <mdui-text-field
                class="search"
                icon="search"
                label="Search customers"
                .value=${this.query}
                @input=${(event: Event) => {
                  this.query = (event.target as HTMLInputElement).value
                }}
              ></mdui-text-field>

              <mdui-list class="customers-list">
                ${this.filteredCustomers().map(
                  (customer) => html`
                    <mdui-list-item @click=${() => this.selectCustomer(customer)}>
                      ${customer.name}
                      <div slot="description">
                        <div>${customer.address}</div>
                        ${customer.systemType ? html`<div>${customer.systemType}</div>` : ""}
                        ${customer.lastServiceDate
                          ? html`<div>Last Service ${this.formatServiceDate(customer.lastServiceDate)}</div>`
                          : ""}
                      </div>
                    </mdui-list-item>
                  `,
                )}
              </mdui-list>
            `}
      </main>

      <mdui-fab
        class="fab"
        extended
        icon="person_add"
        @click=${() => this.emit("new-customer-dialog-open-changed", true)}
      >
        New Customer
      </mdui-fab>

      <add-quote-new-customer-dialog
        .open=${this.newDialogIsOpen}
        .customer=${this.newCustomer}
        @draft-changed=${(event: CustomEvent<Customer>) => {
          this.emit("new-customer-edited", event.detail)
        }}
        @close=${() => {
          this.emit("new-customer-dialog-open-changed", false)
        }}
        @confirm=${(event: CustomEvent<Customer>) => {
          this.emit("new-customer-dialog-open-changed", false)
          this.emit("new-customer-edited", event.detail)
          this.selectCustomer(event.detail)
        }}
      ></add-quote-new-customer-dialog>
    `
  }
}

customElements.define("add-quote-customer-stage", AddQuoteCustomerStage)
