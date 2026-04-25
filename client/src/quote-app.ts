import { Router } from "@lit-labs/router"
import { LitElement, html } from "lit"
import "./quote-list-page.ts"
import "./add-quote-page.ts"
import "./quote-view-page.ts"

export class QuoteApp extends LitElement {
  private readonly router = new Router(this, [
    {
      path: "/",
      render: () => html`<quote-list-page></quote-list-page>`,
    },
    {
      path: "/quotes/new",
      render: () => html`<add-quote-page></add-quote-page>`,
    },
    {
      path: "/quotes/:id",
      render: ({ id }) => html`<quote-view-page .quoteId=${id ?? ""}></quote-view-page>`,
    },
  ])

  render() {
    return html`${this.router.outlet()}`
  }
}

customElements.define("quote-app", QuoteApp)
