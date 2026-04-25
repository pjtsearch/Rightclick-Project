import { LitElement, css, html } from "lit"
import { createEmptyCustomer } from "./quote-draft.ts"
import type { Customer } from "./types.ts"

export class AddQuoteNewCustomerDialog extends LitElement {
  static properties = {
    open: { type: Boolean },
    customerForm: { state: true },
  }

  static styles = css`
    main {
      padding-top: 64px;
    }
  `

  open = false
  private customerForm: Customer = createEmptyCustomer()
  private readonly customerFormId = `new-customer-form-${globalThis.crypto.randomUUID()}`

  private emit(type: string, detail?: unknown): void {
    this.dispatchEvent(new CustomEvent(type, { detail, bubbles: true, composed: true }))
  }

  updated(changed: Map<string, unknown>): void {
    if (changed.has("open") && this.open) {
      this.customerForm = createEmptyCustomer()
    }
  }

  private updateForm(update: Partial<Customer>): void {
    this.customerForm = {
      ...this.customerForm,
      ...update,
    }
  }

  private handleSubmit(event: SubmitEvent): void {
    event.preventDefault()
    const form = event.currentTarget as HTMLFormElement

    if (!form.reportValidity()) {
      return
    }

    this.emit("confirm", { ...this.customerForm })
  }

  render() {
    return html`
      <mdui-dialog fullscreen .open=${this.open}>
        <mdui-top-app-bar>
          <mdui-button-icon icon="close" @click=${() => this.emit("close")}></mdui-button-icon>
          <mdui-top-app-bar-title>New Customer</mdui-top-app-bar-title>
          <div style="flex-grow: 1;"></div>
          <mdui-button type="submit" form=${this.customerFormId}>Confirm</mdui-button>
        </mdui-top-app-bar>

        <form id=${this.customerFormId} @submit=${(event: SubmitEvent) => this.handleSubmit(event)}>
          <main>
            <mdui-text-field
              class="section"
              name="name"
              label="Name"
              required
              .value=${this.customerForm.name}
              @input=${(event: Event) => {
                this.updateForm({
                  name: (event.target as HTMLInputElement).value,
                })
              }}
            ></mdui-text-field>
            <mdui-text-field
              class="section"
              name="address"
              label="Address"
              required
              .value=${this.customerForm.address}
              @input=${(event: Event) => {
                this.updateForm({
                  address: (event.target as HTMLInputElement).value,
                })
              }}
            ></mdui-text-field>
            <mdui-text-field
              class="section"
              name="phone"
              label="Phone"
              .value=${this.customerForm.phone ?? ""}
              @input=${(event: Event) => {
                this.updateForm({
                  phone: (event.target as HTMLInputElement).value || null,
                })
              }}
            ></mdui-text-field>
            <mdui-text-field
              class="section"
              name="propertyType"
              label="Property Type"
              .value=${this.customerForm.propertyType ?? ""}
              @input=${(event: Event) => {
                this.updateForm({
                  propertyType: (event.target as HTMLInputElement).value || null,
                })
              }}
            ></mdui-text-field>
            <mdui-text-field
              class="section"
              name="squareFootage"
              type="number"
              step="any"
              label="Square Footage"
              .value=${String(this.customerForm.squareFootage ?? "")}
              @input=${(event: Event) => {
                const value = (event.target as HTMLInputElement).value
                this.updateForm({
                  squareFootage: value ? Number(value) : null,
                })
              }}
            ></mdui-text-field>
            <mdui-text-field
              class="section"
              name="systemType"
              label="System Type"
              .value=${this.customerForm.systemType ?? ""}
              @input=${(event: Event) => {
                this.updateForm({
                  systemType: (event.target as HTMLInputElement).value || null,
                })
              }}
            ></mdui-text-field>
            <mdui-text-field
              class="section"
              name="systemAge"
              type="number"
              step="any"
              label="System Age"
              .value=${String(this.customerForm.systemAge ?? "")}
              @input=${(event: Event) => {
                const value = (event.target as HTMLInputElement).value
                this.updateForm({
                  systemAge: value ? Number(value) : null,
                })
              }}
            ></mdui-text-field>
            <mdui-text-field
              class="section"
              name="lastServiceDate"
              type="date"
              label="Last Service Date"
              .value=${this.customerForm.lastServiceDate ?? ""}
              @input=${(event: Event) => {
                this.updateForm({
                  lastServiceDate: (event.target as HTMLInputElement).value || null,
                })
              }}
            ></mdui-text-field>
          </main>
        </form>
      </mdui-dialog>
    `
  }
}

customElements.define("add-quote-new-customer-dialog", AddQuoteNewCustomerDialog)
