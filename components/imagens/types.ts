// Uma geração de imagem (linha de `image_generations`). `image_url` guarda o
// PATH do objeto no Storage; a URL assinada é resolvida sob demanda no client.
export type ImageGeneration = {
  id: string
  user_id?: string
  prompt: string
  model: string | null
  image_url: string | null
  status: string | null
  credits: number | null
  created_at?: string
}

// Item pronto para exibir: a linha + a URL assinada resolvida.
export type GalleryItem = ImageGeneration & { signedUrl: string | null }

// Modelos de imagem disponíveis — deve espelhar a allow-list do route
// `POST /api/v1/images`.
export const IMAGE_MODELS: { id: string; label: string }[] = [
  { id: 'google/gemini-2.5-flash-image-preview', label: 'Gemini 2.5 Flash Image (rápido)' },
  { id: 'google/gemini-2.5-flash-image', label: 'Gemini 2.5 Flash Image' },
]

export const DEFAULT_IMAGE_MODEL = IMAGE_MODELS[0].id
