import type { Provider } from "@/features/accounts/api"

interface ProviderLogoProps {
  provider: Provider
  size?: "sm" | "md"
}

// Tailwind theme tidak include warna brand provider; pakai inline color
// karena hanya muncul di dua komponen dan tidak masuk design system token.
const PROVIDER_STYLE: Record<Provider, { bg: string; text: string; label: string; letter: string }> = {
  google: {
    bg: "bg-primary-soft",
    text: "text-primary-strong",
    label: "Google Drive",
    letter: "G",
  },
  dropbox: {
    bg: "bg-success-soft",
    text: "text-success-strong",
    label: "Dropbox",
    letter: "D",
  },
}

export function ProviderLogo({ provider, size = "md" }: ProviderLogoProps) {
  const style = PROVIDER_STYLE[provider]
  const dimension = size === "sm" ? "h-7 w-7 text-xs" : "h-9 w-9 text-sm"
  return (
    <span
      aria-label={style.label}
      className={`inline-flex items-center justify-center rounded-full font-semibold ${dimension} ${style.bg} ${style.text}`}
    >
      {style.letter}
    </span>
  )
}

export function getProviderLabel(provider: Provider): string {
  return PROVIDER_STYLE[provider].label
}
