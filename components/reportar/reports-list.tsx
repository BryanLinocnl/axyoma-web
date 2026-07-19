'use client'

import { useEffect, useState } from 'react'
import { BugIcon, LightbulbIcon, SparklesIcon } from 'lucide-react'
import { supabase } from '@/lib/supabase-browser'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import type { ErrorReport, ReportType } from './types'

const TYPE_META: Record<ReportType, { label: string; icon: typeof BugIcon }> = {
  bug: { label: 'Bug', icon: BugIcon },
  suggestion: { label: 'Sugestão', icon: LightbulbIcon },
  feature: { label: 'Feature', icon: SparklesIcon },
}

const STATUS_LABEL: Record<string, string> = {
  open: 'Aberto',
  in_progress: 'Em andamento',
  done: 'Concluído',
  closed: 'Fechado',
}

const STATUS_VARIANT: Record<string, 'outline' | 'secondary' | 'default'> = {
  open: 'outline',
  in_progress: 'secondary',
  done: 'default',
  closed: 'default',
}

export function ReportsList({ userId, refreshKey }: { userId: string; refreshKey: number }): React.JSX.Element {
  const [reports, setReports] = useState<ErrorReport[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!userId) return
    let cancelled = false
    // Refetch on refreshKey change (after a new report is submitted); intentional
    // client data reload, same pattern as ContaProvider.load().
    // eslint-disable-next-line react-hooks/set-state-in-effect -- intentional client data fetch
    setLoading(true)
    void supabase
      .from('error_reports')
      .select('id, type, title, body, status, meta, created_at')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .then(({ data }) => {
        if (cancelled) return
        setReports((data as ErrorReport[]) ?? [])
        setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [userId, refreshKey])

  if (loading) {
    return <p className="text-muted-foreground text-sm">Carregando…</p>
  }

  if (reports.length === 0) {
    return (
      <Card className="p-6">
        <p className="text-muted-foreground text-sm">Você ainda não enviou nenhum report.</p>
      </Card>
    )
  }

  return (
    <div className="flex flex-col gap-3">
      {reports.map((r) => {
        const meta = TYPE_META[r.type]
        const Icon = meta.icon
        return (
          <Card key={r.id} className="p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-start gap-3">
                <div className="bg-muted mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg">
                  <Icon className="size-4" />
                </div>
                <div>
                  <p className="text-sm font-medium">{r.title}</p>
                  {r.body && <p className="text-muted-foreground mt-1 text-sm">{r.body}</p>}
                  <p className="text-muted-foreground/80 mt-2 text-xs">
                    {meta.label} ·{' '}
                    {new Date(r.created_at).toLocaleDateString('pt-BR', {
                      day: '2-digit',
                      month: '2-digit',
                      year: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </p>
                </div>
              </div>
              <Badge variant={STATUS_VARIANT[r.status] ?? 'outline'}>{STATUS_LABEL[r.status] ?? r.status}</Badge>
            </div>
          </Card>
        )
      })}
    </div>
  )
}
