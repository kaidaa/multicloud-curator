export const OPEN_FILE_UNAVAILABLE_MESSAGE =
  "Link buka file belum tersedia. Jalankan refresh akun untuk memperbarui informasi file."

export function openInProvider(href: string | null): void {
  if (!href) return
  window.open(href, "_blank", "noopener,noreferrer")
}
