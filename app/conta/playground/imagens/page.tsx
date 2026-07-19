'use client'

import { useCallback, useEffect, useState } from 'react'
import Image from 'next/image'
import { Download, AlertCircle } from 'lucide-react'
import { supabase } from '@/lib/supabase-browser'
import { useConta } from '@/lib/conta-context'
import { Button } from '@/components/ui/button'
import { PromptBox } from '@/components/imagens/PromptBox'
import { Gallery } from '@/components/imagens/Gallery'
import { GenerationLoader } from '@/components/imagens/GenerationLoader'
import { DEFAULT_IMAGE_MODEL, type GalleryItem, type ImageGeneration } from '@/components/imagens/types'

const BUCKET = 'generations'
const HISTORY_LIMIT = 24
const SIGN_TTL = 3600

export default function PlaygroundImagensPage(): React.JSX.Element {
  const { userId, token, balance, reload } = useConta()
  const [prompt, setPrompt] = useState('')
  const [model, setModel] = useState(DEFAULT_IMAGE_MODEL)
  const [generating, setGenerating] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [current, setCurrent] = useState<GalleryItem | null>(null)
  const [history, setHistory] = useState<GalleryItem[]>([])
  const [loadingHistory, setLoadingHistory] = useState(true)

  // Resolve URLs assinadas em lote (1 requisição) para os paths de Storage.
  const signPaths = useCallback(async (paths: string[]): Promise<Map<string, string>> => {
    const map = new Map<string, string>()
    if (paths.length === 0) return map
    const { data } = await supabase.storage.from(BUCKET).createSignedUrls(paths, SIGN_TTL)
    for (const s of data ?? []) {
      if (s.path && s.signedUrl) map.set(s.path, s.signedUrl)
    }
    return map
  }, [])

  const loadHistory = useCallback(async () => {
    if (!userId) return
    const { data } = await supabase
      .from('image_generations')
      .select('id, prompt, model, image_url, status, credits, created_at')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(HISTORY_LIMIT)
    const rows = (data as ImageGeneration[]) ?? []
    const paths = rows.map((r) => r.image_url).filter((p): p is string => Boolean(p))
    const signed = await signPaths(paths)
    setHistory(rows.map((r) => ({ ...r, signedUrl: r.image_url ? (signed.get(r.image_url) ?? null) : null })))
    setLoadingHistory(false)
  }, [userId, signPaths])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- carregamento client após I/O
    void loadHistory()
  }, [loadHistory])

  async function generate(): Promise<void> {
    const p = prompt.trim()
    if (!p || generating) return
    setGenerating(true)
    setError(null)
    setCurrent(null)
    try {
      const res = await fetch('/api/v1/images', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ prompt: p, model }),
      })
      if (res.status === 402) {
        setError('Seus créditos acabaram. Compre créditos para continuar gerando imagens.')
        return
      }
      const data = await res.json().catch(() => null)
      if (!res.ok || !data?.image) {
        setError(data?.error?.message ?? 'Falha ao gerar a imagem. Tente novamente.')
        return
      }
      const item: GalleryItem = { ...(data.image as ImageGeneration), signedUrl: data.signedUrl ?? null }
      setCurrent(item)
      setHistory((prev) => [item, ...prev.filter((h) => h.id !== item.id)])
      void reload()
    } catch (e) {
      setError((e as Error).message || 'Erro de rede ao gerar a imagem.')
    } finally {
      setGenerating(false)
    }
  }

  // Baixa via blob (bucket privado, URL assinada de mesma origem Supabase).
  async function download(item: GalleryItem): Promise<void> {
    if (!item.signedUrl) return
    try {
      const res = await fetch(item.signedUrl)
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `axyoma-${item.id}.png`
      document.body.appendChild(a)
      a.click()
      a.remove()
      URL.revokeObjectURL(url)
    } catch {
      window.open(item.signedUrl, '_blank')
    }
  }

  const noCredits = balance <= 0

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-xl font-semibold">Imagens</h1>
        <p className="text-muted-foreground mt-1 text-sm">
          Descreva o que você quer ver e gere imagens com IA. Cada geração consome créditos.
        </p>
      </div>

      <PromptBox
        prompt={prompt}
        onPromptChange={setPrompt}
        model={model}
        onModelChange={setModel}
        onGenerate={generate}
        generating={generating}
        disabled={generating || noCredits || prompt.trim().length === 0}
      />

      {noCredits && !generating ? (
        <p className="text-muted-foreground mt-2 flex items-center gap-1.5 text-xs">
          <AlertCircle className="size-3.5" /> Você está sem créditos — compre para gerar imagens.
        </p>
      ) : null}

      {error ? (
        <div className="border-destructive/30 bg-destructive/10 text-destructive mt-4 flex items-start gap-2 rounded-xl border p-3 text-sm">
          <AlertCircle className="mt-0.5 size-4 shrink-0" />
          <span>{error}</span>
        </div>
      ) : null}

      {/* Palco: loader → resultado atual → (vazio) */}
      {generating ? (
        <div className="border-border bg-card mt-6 flex min-h-[320px] items-center justify-center rounded-2xl border">
          <GenerationLoader />
        </div>
      ) : current && current.signedUrl ? (
        <div className="border-border bg-card mt-6 overflow-hidden rounded-2xl border">
          <div className="relative flex items-center justify-center bg-black/30 p-4">
            <Image
              src={current.signedUrl}
              alt={current.prompt}
              width={1024}
              height={1024}
              unoptimized
              className="max-h-[62vh] w-auto rounded-lg object-contain"
            />
          </div>
          <div className="flex items-center justify-between gap-3 p-4">
            <p className="text-muted-foreground line-clamp-2 text-sm">{current.prompt}</p>
            <Button onClick={() => download(current)} variant="outline" className="shrink-0">
              <Download className="size-4" /> Baixar
            </Button>
          </div>
        </div>
      ) : null}

      <div className="mt-10">
        <h2 className="mb-3 text-sm font-semibold">Histórico</h2>
        <Gallery items={history} loading={loadingHistory} onSelect={setCurrent} onDownload={download} />
      </div>
    </div>
  )
}
