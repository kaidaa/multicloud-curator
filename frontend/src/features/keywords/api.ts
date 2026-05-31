import { api } from "@/shared/api/client"

export type KeywordCategory = "default" | "custom"

interface KeywordResponse {
  id: string
  word: string
  category: KeywordCategory
  active: boolean
  created_at: string
}

export interface Keyword {
  id: string
  word: string
  category: KeywordCategory
  active: boolean
  createdAt: string
}

function mapKeyword(raw: KeywordResponse): Keyword {
  return {
    id: raw.id,
    word: raw.word,
    category: raw.category,
    active: raw.active,
    createdAt: raw.created_at,
  }
}

export async function listKeywords(): Promise<Keyword[]> {
  const response = await api.get<KeywordResponse[]>("/keywords")
  return response.data.map(mapKeyword)
}

export async function addKeyword(word: string): Promise<Keyword> {
  const response = await api.post<KeywordResponse>("/keywords", { word })
  return mapKeyword(response.data)
}

export async function toggleKeyword(id: string): Promise<Keyword> {
  const response = await api.patch<KeywordResponse>(`/keywords/${id}/toggle`)
  return mapKeyword(response.data)
}

export async function deleteKeyword(id: string): Promise<void> {
  await api.delete<null>(`/keywords/${id}`)
}
