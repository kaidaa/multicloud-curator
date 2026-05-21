import { ApiClientError } from "@/shared/api/client"

export { ApiClientError } from "@/shared/api/client"

// Map error code dari Interface Contract ke pesan Bahasa Indonesia yang
// user-friendly. Saat M3/M4 ditambah code lain sesuai backend response real.
const ERROR_MESSAGES: Record<string, string> = {
  validation_error: "Permintaan tidak valid. Coba lagi atau periksa input.",
  account_token_invalid:
    "Token akun sudah tidak berlaku. Silakan otorisasi ulang.",
  operation_in_progress:
    "Operasi sebelumnya masih berjalan. Tunggu hingga selesai.",
  provider_unavailable:
    "Layanan penyimpanan sedang tidak tersedia. Coba lagi nanti.",
  scope_insufficient:
    "Akun tidak memiliki izin yang cukup untuk operasi ini.",
  account_mismatch:
    "Akun yang dipilih berbeda dari akun yang sedang diotorisasi ulang.",
  invalid_state: "Sesi otorisasi sudah kedaluwarsa. Coba hubungkan akun lagi.",
  oauth_scope_error:
    "Izin yang diberikan belum lengkap. Coba ulangi otorisasi akun.",
  oauth_token_error:
    "Otorisasi provider gagal diproses. Coba hubungkan akun lagi.",
  oauth_callback_failed:
    "Callback otorisasi gagal diproses. Coba hubungkan akun lagi.",
  operation_failed: "Operasi gagal diproses.",
  not_owned: "Aksi ini hanya bisa dilakukan pada file milik akun Anda.",
  not_public: "File ini sudah tidak memiliki akses publik.",
  not_found: "Sumber daya yang diminta tidak ditemukan.",
  network_error: "Tidak bisa terhubung ke server. Cek koneksi internet.",
}

const DEFAULT_MESSAGE = "Terjadi kesalahan tak terduga. Coba lagi sebentar lagi."

export function getErrorMessage(error: unknown): string {
  if (error instanceof ApiClientError) {
    return ERROR_MESSAGES[error.code] ?? error.message ?? DEFAULT_MESSAGE
  }
  if (error instanceof Error) {
    return error.message || DEFAULT_MESSAGE
  }
  return DEFAULT_MESSAGE
}
