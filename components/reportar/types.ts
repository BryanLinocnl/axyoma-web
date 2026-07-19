export type ReportType = 'bug' | 'suggestion' | 'feature'

export type ErrorReport = {
  id: string
  type: ReportType
  title: string
  body: string | null
  status: string
  meta: Record<string, unknown>
  created_at: string
}
