'use client'

import { useState } from 'react'
import { useConta } from '@/lib/conta-context'
import { ReportForm } from '@/components/reportar/report-form'
import { ReportsList } from '@/components/reportar/reports-list'

export default function PlaygroundLogsPage(): React.JSX.Element {
  const { userId } = useConta()
  const [refreshKey, setRefreshKey] = useState(0)

  return (
    <div className="flex flex-col gap-6">
      <ReportForm onSubmitted={() => setRefreshKey((k) => k + 1)} />
      <div>
        <p className="mb-3 text-sm font-semibold">Seus reports</p>
        <ReportsList userId={userId} refreshKey={refreshKey} />
      </div>
    </div>
  )
}
