const UNITS = ["B", "KB", "MB", "GB", "TB", "PB"] as const

const ID_NUMBER_FORMATTER = new Intl.NumberFormat("id-ID", {
  minimumFractionDigits: 0,
  maximumFractionDigits: 1,
})

export function formatBytes(bytes: number | null | undefined): string {
  if (bytes == null || !Number.isFinite(bytes) || bytes < 0) return "—"
  if (bytes === 0) return "0 B"
  const exponent = Math.min(Math.floor(Math.log10(bytes) / Math.log10(1024)), UNITS.length - 1)
  const value = bytes / Math.pow(1024, exponent)
  return `${ID_NUMBER_FORMATTER.format(value)} ${UNITS[exponent]}`
}

export function formatBytesPair(used: number, total: number): string {
  return `${formatBytes(used)} / ${formatBytes(total)}`
}
