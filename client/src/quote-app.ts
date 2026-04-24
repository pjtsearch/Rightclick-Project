import { LitElement, css, html } from "lit"
import { snackbar } from "mdui"
import type { QuoteWithDetails } from "./types.ts"
import "./quote-card.ts"

export class QuoteApp extends LitElement {
  static properties = {
    quotes: { state: true },
    loading: { state: true },
    error: { state: true },
  }

  static styles = css`
    :host {
      display: block;
      min-height: 100vh;
    }

    main {
      padding: 1rem 1rem 6rem;
      max-width: 32rem;
      margin: 0 auto;
    }

    .state {
      margin-bottom: 1rem;
    }

    .add-fab {
      position: fixed;
      right: 1rem;
      bottom: calc(1rem + env(safe-area-inset-bottom));
      z-index: 20;
    }
  `

  private quotes: QuoteWithDetails[] = []

  private loading = true

  private error = ""

  connectedCallback(): void {
    super.connectedCallback()
    void this.loadQuotes()
  }

  private async loadQuotes(): Promise<void> {
    this.loading = true
    this.error = ""

    try {
      const response = await fetch("/quotes")

      if (!response.ok) {
        throw new Error(`Failed to load quotes (${response.status})`)
      }

      const quotes = (await response.json()) as QuoteWithDetails[]
      this.quotes = [...quotes].sort((left, right) => right.id - left.id)
    } catch (error) {
      this.error = error instanceof Error ? error.message : "Unable to load quotes."
    } finally {
      this.loading = false
    }
  }

  private handleAddClick(): void {
    snackbar({
      message: "Quote creation UI is the next step.",
      closeable: true,
    })
  }

  private renderQuotesList() {
    if (this.loading) {
      return html`
        <mdui-circular-progress indeterminate></mdui-circular-progress>
        <div style="margin-top: 12px;">Loading quotes from the server...</div>
      `
    }

    if (this.error) {
      return html`
        <div>${this.error}</div>
        <div style="margin-top: 12px;">
          <mdui-button variant="filled" @click=${() => this.loadQuotes()}>Try again</mdui-button>
        </div>
      `
    }

    if (this.quotes.length === 0) {
      return html` No quotes yet. Tap the Add button to create the first one. `
    }

    return html` <div>${this.quotes.map((quote) => html`<quote-card .quote=${quote}></quote-card>`)}</div> `
  }

  render() {
    return html`
      <mdui-top-app-bar>
        <mdui-top-app-bar-title>HVAC Quotes</mdui-top-app-bar-title>
      </mdui-top-app-bar>

      <main>${this.renderQuotesList()}</main>

      <mdui-fab class="add-fab" icon="add" @click=${() => this.handleAddClick()}></mdui-fab>
    `
  }
}

customElements.define("quote-app", QuoteApp)
