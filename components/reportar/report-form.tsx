'use client'

import { useState } from 'react'
import { usePathname } from 'next/navigation'
import { BugIcon, LightbulbIcon, SparklesIcon, Loader2Icon, SendIcon } from 'lucide-react'
import { supabase } from '@/lib/supabase-browser'
import { useConta } from '@/lib/conta-context'
import pkg from '@/package.json'

const appVersion = pkg.version
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import type { ReportType } from './types'

const TYPES: { value: ReportType; label: string; icon: typeof BugIcon }[] = [
  { value: 'bug', label: 'Bug', icon: BugIcon },
  { value: 'suggestion', label: 'Sugestão', icon: LightbulbIcon },
  { value: 'feature', label: 'Feature', icon: SparklesIcon },
]

/** Metadados capturados automaticamente pra ajudar no diagnóstico — sem input do usuário. */
function captureMeta(pathname: string): Record<string, unknown> {
  return {
    route: pathname,
    appVersion,
    userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : null,
  }
}

export function ReportForm({ onSubmitted }: { onSubmitted: () => void }): React.JSX.Element {
  const { userId } = useConta()
  const pathname = usePathname()
  const [type, setType] = useState<ReportType>('bug')
  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)

  async function handleSubmit(e: React.FormEvent): Promise<void> {
    e.preventDefault()
    if (!title.trim() || !userId) return
    setSubmitting(true)
    setError('')
    setSuccess(false)

    const { error: insertError } = await supabase.from('error_reports').insert({
      user_id: userId,
      type,
      title: title.trim(),
      body: body.trim() || null,
      meta: captureMeta(pathname),
    })

    setSubmitting(false)
    if (insertError) {
      setError('Não foi possível enviar seu report. Tente novamente.')
      return
    }
    setTitle('')
    setBody('')
    setSuccess(true)
    onSubmitted()
  }

  return (
    <Card className="p-6">
      <CardHeader className="px-0 pt-0">
        <CardTitle>Reportar erro ou sugestão</CardTitle>
        <CardDescription>
          Conte o que aconteceu ou o que você gostaria de ver no Axyoma. Capturamos a rota atual e
          seu navegador automaticamente pra ajudar no diagnóstico.
        </CardDescription>
      </CardHeader>
      <CardContent className="px-0 pb-0">
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div>
            <Label className="mb-2">Tipo</Label>
            <Tabs value={type} onValueChange={(v) => setType(v as ReportType)}>
              <TabsList>
                {TYPES.map(({ value, label, icon: Icon }) => (
                  <TabsTrigger key={value} value={value} className="gap-1.5">
                    <Icon className="size-3.5" />
                    {label}
                  </TabsTrigger>
                ))}
              </TabsList>
            </Tabs>
          </div>

          <div>
            <Label htmlFor="report-title" className="mb-2">
              Título
            </Label>
            <Input
              id="report-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Resumo em uma linha"
              maxLength={140}
              required
            />
          </div>

          <div>
            <Label htmlFor="report-body" className="mb-2">
              Descrição
            </Label>
            <Textarea
              id="report-body"
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder="O que aconteceu, passos para reproduzir, ou detalhes da sugestão..."
              rows={5}
            />
          </div>

          {error && <p className="text-destructive text-sm">{error}</p>}
          {success && <p className="text-sm text-emerald-500">Report enviado. Obrigado pelo retorno!</p>}

          <div className="flex justify-end">
            <Button type="submit" disabled={submitting || !title.trim()}>
              {submitting ? <Loader2Icon className="size-3.5 animate-spin" /> : <SendIcon className="size-3.5" />}
              Enviar
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  )
}
