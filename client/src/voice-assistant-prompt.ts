import type { VoiceAssistantContext } from "./voice-assistant.ts"

export const updateQuoteToolName = "update_quote_draft"

export function buildVoiceAssistantInstructions(context: VoiceAssistantContext): string {
  return [
    "You are a voice assistant that edits an HVAC quote draft for the user.",
    `The current UI stage is "${context.stage}". Prioritize helping with that stage, but you may update any part of the quote if the user clearly asks.`,
    "You are given the current quote draft, the customer list, the equipment catalog, and the labor rates as JSON.",
    "If the user has not provided enough information to make a reliable change, ask one short follow-up question and do not call the function yet.",
    "When you do have enough information, call update_quote_draft.",
    "When the user clearly wants to work in a different part of the quote builder, include a ui.stage value so the app can switch stages for them.",
    "If the user wants to add a brand new customer or starts dictating new customer details, set ui.stage to customer and ui.openNewCustomerDialog to true.",
    "When the new customer dialog is open, edit newCustomer instead of quote.customer.",
    "When the user confirms the new customer and wants to continue, set ui.confirmNewCustomer to true.",
    "If the user selects an existing customer, usually move to the equipment stage next.",
    "If the user starts adding or editing equipment, move to the equipment stage. If they start adding or editing labor, move to the labor stage.",
    "If the user asks to review pricing, surcharge, or save the quote, move to the finalize stage.",
    "Only set ui.saveQuote to true when the quote is ready to be saved. If the user asks to save before final review, move to the finalize stage first instead of saving immediately.",
    "If you include equipments or labors in the function call, send the complete desired list for that section, not just one changed item.",
    "Use existing customer ids, equipment ids, and labor ids from the provided JSON whenever possible.",
    "Do not invent catalog items. Keep unchanged parts of the quote as they are.",
    "Prices are managed by the app, so do not try to set custom prices; base the prices off of what is in the equipment and labor rates JSONs; multiply them according to the quantity or hours.",
    "Express the surcharge as a number 1-100, not as a decimal from 0-1.",
    "Do not change quote.date. The app sets that automatically when the quote is saved.",
    "Always speak in English. Try to be as terse as possible, and don't say more than you need to. However, still be sure to ask questions if necessary.",
    `Current quote draft JSON: ${JSON.stringify(context.quote)}`,
    `New customer dialog open: ${JSON.stringify(context.newCustomerDialogIsOpen)}`,
    `Current new customer draft JSON: ${JSON.stringify(context.newCustomer)}`,
    `Customers JSON: ${JSON.stringify(context.customers)}`,
    `Equipment JSON: ${JSON.stringify(context.equipment)}`,
    `Labor rates JSON: ${JSON.stringify(context.laborRates)}`,
  ].join("\n")
}

export function buildUpdateQuoteTool() {
  return {
    type: "function",
    name: updateQuoteToolName,
    description:
      "Update the quote draft after the user has given enough detail. You may send the full quote draft or only the fields that should change.",
    parameters: {
      type: "object",
      additionalProperties: false,
      properties: {
        note: {
          type: "string",
          description: "A short summary of the changes that were applied.",
        },
        ui: {
          type: "object",
          additionalProperties: false,
          properties: {
            stage: {
              type: "string",
              enum: ["customer", "equipment", "labor", "finalize"],
            },
            openNewCustomerDialog: {
              type: "boolean",
            },
            confirmNewCustomer: {
              type: "boolean",
            },
            saveQuote: {
              type: "boolean",
            },
          },
        },
        newCustomer: {
          type: "object",
          additionalProperties: false,
          properties: {
            id: { type: "string" },
            name: { type: "string" },
            address: { type: "string" },
            phone: { type: ["string", "null"] },
            propertyType: { type: ["string", "null"] },
            squareFootage: { type: ["number", "null"] },
            systemType: { type: ["string", "null"] },
            systemAge: { type: ["number", "null"] },
            lastServiceDate: { type: ["string", "null"] },
          },
        },
        quote: {
          type: "object",
          additionalProperties: false,
          properties: {
            surcharge: {
              type: "number",
            },
            customer: {
              type: "object",
              additionalProperties: false,
              properties: {
                id: { type: "string" },
                name: { type: "string" },
                address: { type: "string" },
                phone: { type: ["string", "null"] },
                propertyType: { type: ["string", "null"] },
                squareFootage: { type: ["number", "null"] },
                systemType: { type: ["string", "null"] },
                systemAge: { type: ["number", "null"] },
                lastServiceDate: { type: ["string", "null"] },
              },
            },
            equipments: {
              type: "array",
              items: {
                type: "object",
                additionalProperties: false,
                properties: {
                  equipmentId: { type: "string" },
                  quantity: { type: "number" },
                },
              },
            },
            labors: {
              type: "array",
              items: {
                type: "object",
                additionalProperties: false,
                properties: {
                  laborId: { type: "string" },
                  hours: { type: "number" },
                },
              },
            },
          },
        },
      },
    },
  }
}
