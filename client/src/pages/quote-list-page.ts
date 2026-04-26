import { LitElement, css, html } from "lit"
import { fetchQuotes, markQuoteAccomplished, quotesSyncedEvent } from "../services/api.ts"
import { navigate } from "../services/navigation.ts"
import { compareQuoteTimestampsDescending } from "../utils/quote/quote-date.ts"
import type { QuoteWithDetails } from "../types/databaseTypes.ts"
import "../components/quote-card.ts"

export class QuoteListPage extends LitElement {
  static properties = {
    quotes: { state: true },
    loading: { state: true },
    error: { state: true },
    accomplishingQuoteIds: { state: true },
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
  private accomplishingQuoteIds: string[] = []

  connectedCallback(): void {
    super.connectedCallback()
    window.addEventListener(quotesSyncedEvent, this.loadQuotes)
    void this.loadQuotes()
  }

  disconnectedCallback(): void {
    window.removeEventListener(quotesSyncedEvent, this.loadQuotes)
    super.disconnectedCallback()
  }
  private async loadQuotes(): Promise<void> {
    this.loading = true
    this.error = ""

    try {
      const quotes = await fetchQuotes()
      this.quotes = [...quotes].sort(
        (left, right) => compareQuoteTimestampsDescending(left.date, right.date) || right.id.localeCompare(left.id),
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
          .accomplishing=${this.accomplishingQuoteIds.includes(quote.id)}
          @click=${() => {
            navigate(`/quotes/${quote.id}`)
          }}
          @mark-accomplished=${async () => {
            if (quote.accomplished || this.accomplishingQuoteIds.includes(quote.id)) {
              return
            }

            this.accomplishingQuoteIds = [...this.accomplishingQuoteIds, quote.id]

            try {
              const updatedQuote = await markQuoteAccomplished(quote.id)
              this.quotes = this.quotes.map((currentQuote) =>
                currentQuote.id === updatedQuote.id ? updatedQuote : currentQuote,
              )
            } catch (error) {
              this.error = error instanceof Error ? error.message : "Unable to mark quote accomplished."
            } finally {
              this.accomplishingQuoteIds = this.accomplishingQuoteIds.filter((id) => id !== quote.id)
            }
          }}
        ></quote-card>
      `,
    )
  }

  render() {
    return html`
      <mdui-top-app-bar variant="large" scroll-behavior="shrink">
        <mdui-top-app-bar-title>HVAC Quotes</mdui-top-app-bar-title>
        <mdui-button-icon
          icon="refresh"
          ?disabled=${this.loading}
          @click=${() => void this.loadQuotes()}
        ></mdui-button-icon>
      </mdui-top-app-bar>

      <main>${this.renderQuotesList()}</main>

      <mdui-fab class="add-fab" icon="add" @click=${() => navigate("/quotes/new")}></mdui-fab>
    `
  }
}

customElements.define("quote-list-page", QuoteListPage)
