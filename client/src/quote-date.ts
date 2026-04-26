export function formatQuoteTimestamp(value: string): string {
  const timestamp = Date.parse(value)

  if (Number.isNaN(timestamp)) {
    return value
  }

  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(timestamp))
}

export function compareQuoteTimestampsDescending(left: string, right: string): number {
  const leftTimestamp = Date.parse(left)
  const rightTimestamp = Date.parse(right)

  if (Number.isNaN(leftTimestamp) || Number.isNaN(rightTimestamp)) {
    return right.localeCompare(left)
  }

  return rightTimestamp - leftTimestamp
}

export function getLocalDateString(date = new Date()): string {
  const year = String(date.getFullYear())
  const month = String(date.getMonth() + 1).padStart(2, "0")
  const day = String(date.getDate()).padStart(2, "0")

  return `${year}-${month}-${day}`
}
