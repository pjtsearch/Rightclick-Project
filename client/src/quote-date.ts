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
