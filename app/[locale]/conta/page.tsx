'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

export default function ContaRootRedirect(): null {
  const router = useRouter()
  useEffect(() => {
    router.replace('/conta/visao-geral/visao-geral')
  }, [router])
  return null
}
