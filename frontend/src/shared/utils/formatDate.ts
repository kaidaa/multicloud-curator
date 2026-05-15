const DATE_PART_FORMATTER = new Intl.DateTimeFormat("id-ID", {
  day: "numeric",
  month: "long",
  year: "numeric",
})

const TIME_PART_FORMATTER = new Intl.DateTimeFormat("id-ID", {
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
})

export function formatDateID(iso: string | null | undefined): string {
  if (!iso) return "—"
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return "—"
  // Indo lokal pisahkan jam dengan titik ("00.16") bukan titik dua,
  // jadi tukar manual karena Intl tidak expose separator override.
  const timePart = TIME_PART_FORMATTER.format(date).replace(":", ".")
  return `${DATE_PART_FORMATTER.format(date)}, ${timePart}`
}
