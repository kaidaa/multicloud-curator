const ABSOLUTE_FORMATTER = new Intl.DateTimeFormat("id-ID", {
  day: "numeric",
  month: "short",
  year: "numeric",
})

// Output bahasa Indonesia: "baru saja", "5 menit lalu", "3 hari lalu", lalu
// fallback ke tanggal absolut saat lebih dari seminggu supaya tidak ambigu.
export function formatRelativeTime(iso: string | null | undefined): string {
  if (!iso) return "—"
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return "—"

  const diffMs = Date.now() - date.getTime()
  if (diffMs < 0) return "baru saja"

  const seconds = Math.floor(diffMs / 1000)
  if (seconds < 60) return "baru saja"
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes} menit lalu`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours} jam lalu`
  const days = Math.floor(hours / 24)
  if (days < 7) return `${days} hari lalu`

  return ABSOLUTE_FORMATTER.format(date)
}
