import { LitElement, css, html } from "lit"
import { fetchQuotes } from "./api.ts"
import { navigate } from "./navigation.ts"
import type { QuoteWithDetails } from "./types.ts"
import "./quote-card.ts"

export class QuoteListPage extends LitElement {
  static properties = {
    quotes: { state: true },
    loading: { state: true },
    error: { state: true },
  }

  static styles = css`
    :host {
      display: block;
    }

    main {
      padding: 1rem 1rem 6rem;
      max-width: 32rem;
      margin: 0 auto;
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
      const quotes = await fetchQuotes()
      this.quotes = [...quotes].sort(
        (left, right) => right.date.localeCompare(left.date) || right.id.localeCompare(left.id),
      )
    } catch (error) {
      this.error = error instanceof Error ? error.message : "Unable to load quotes."
    } finally {
      this.loading = false
    }
  }

  private renderQuotesList() {
    if (this.loading) {
      return html`
        <mdui-card style="padding: 24px; text-align: center;">
          <mdui-circular-progress indeterminate></mdui-circular-progress>
          <div style="margin-top: 12px;">Loading quotes from the server...</div>
        </mdui-card>
      `
    }

    if (this.error) {
      return html`
        <mdui-card style="padding: 24px; text-align: center;">
          <div>${this.error}</div>
          <div style="margin-top: 12px;">
            <mdui-button variant="filled" @click=${() => void this.loadQuotes()}>Try again</mdui-button>
          </div>
        </mdui-card>
      `
    }

    if (this.quotes.length === 0) {
      return html`
        <mdui-card style="padding: 24px; text-align: center;">
          No quotes yet. Tap the Add button to create the first one.
        </mdui-card>
      `
    }

    return this.quotes.map(
      (quote) => html`
        <quote-card
          .quote=${quote}
          @click=${() => {
            navigate(`/quotes/${quote.id}`)
          }}
        ></quote-card>
      `,
    )
  }

  render() {
    return html`
      <mdui-top-app-bar variant="large" scroll-behavior="shrink">
        <mdui-top-app-bar-title>HVAC Quotes</mdui-top-app-bar-title>
      </mdui-top-app-bar>

      <main>${this.renderQuotesList()}</main>

      <mdui-fab class="add-fab" icon="add" @click=${() => navigate("/quotes/new")}></mdui-fab>
    `
  }
}

customElements.define("quote-list-page", QuoteListPage)
