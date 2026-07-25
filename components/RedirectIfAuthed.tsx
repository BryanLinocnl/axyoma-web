'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase-browser'

const DESTINO = '/conta/visao-geral/visao-geral'

/**
 * Guarda inversa das páginas de autenticação: quem JÁ tem sessão não vê /login
 * nem /signup — vai direto para a conta.
 *
 * POR QUE NO CLIENTE E NÃO NO MIDDLEWARE: a sessão real mora no localStorage
 * (supabase-js com persistSession). O cookie `axyoma-access-token` que o
 * middleware enxerga é só um espelho de TTL curto — ver o comentário longo em
 * middleware.ts. Redirecionar a partir dele daria dois erros:
 *   • espelho expirado com sessão viva → o usuário logado continuaria vendo o
 *     formulário (o bug que isto conserta seguiria de pé);
 *   • espelho sobrevivente com sessão morta → o deslogado seria chutado para
 *     fora do login, sem meio de entrar. Esse é o pior dos dois.
 * `getSession()` lê o localStorage e responde a verdade, sem rede.
 *
 * Enquanto a checagem não resolve, nada é renderizado: é leitura local, custa
 * um frame, e evita o formulário piscar para quem já está logado.
 */
export function RedirectIfAuthed({ children }: { children: React.ReactNode }): React.JSX.Element | null {
  const router = useRouter()
  const [status, setStatus] = useState<'checando' | 'anonimo'>('checando')

  useEffect(() => {
    let vivo = true

    void supabase.auth.getSession().then(({ data }) => {
      if (!vivo) return
      if (data.session) router.replace(DESTINO)
      else setStatus('anonimo')
    })

    // Cobre o login feito em OUTRA aba e a volta do OAuth: sem isto o
    // formulário continuaria na tela depois da sessão nascer.
    const { data: sub } = supabase.auth.onAuthStateChange((_evento, session) => {
      if (session) router.replace(DESTINO)
    })

    return () => {
      vivo = false
      sub.subscription.unsubscribe()
    }
  }, [router])

  if (status === 'checando') return null
  return <>{children}</>
}
