'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { CreditCard } from 'lucide-react'
import { SUPABASE_URL } from '@/lib/supabase-browser'
import { creditsToBRL } from '@/lib/credits'
import { Card } from '@/components/ui/card'

// Gateway de cobrança: Asaas (`asaas-create-payment`). AbacatePay foi descontinuado.
// A 1ª compra do usuário exige CPF (a function responde 422 { error: 'cpf_required' });
// aqui, nesse caso, mandamos o usuário para a página Faturamento, que tem o
// formulário de CPF do fluxo completo. Compras seguintes abrem o checkout direto.
export function BuyCreditsCard({ token, creditBrl }: { token: string; creditBrl: number }): React.JSX.Element {
  const router = useRouter()
  const [buying, setBuying] = useState(false)

  async function buyCredits(): Promise<void> {
    setBuying(true)
    try {
      const res = await fetch(`${SUPABASE_URL}/functions/v1/asaas-create-payment`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ packId: 'credits-100' }),
      })
      const json = await res.json().catch(() => null)

      if (res.status === 422 && json?.error === 'cpf_required') {
        // 1ª compra: precisa de CPF → completa no Faturamento (tem o formulário).
        router.push('/conta/faturamento/creditos')
        return
      }
      if (json?.url) window.open(json.url as string, '_blank', 'noopener,noreferrer')
      else alert(json?.message ?? json?.error ?? 'Falha ao criar checkout.')
    } catch {
      alert('Não foi possível conectar ao gateway de pagamento. Verifique sua conexão e tente novamente.')
    } finally {
      setBuying(false)
    }
  }

  return (
    <Card className="flex flex-col justify-center gap-6 p-6">
      <div className="flex items-start gap-3">
        <span className="bg-muted flex size-9 shrink-0 items-center justify-center rounded-full">
          <CreditCard className="size-4" />
        </span>
        <div>
          <p className="text-lg font-semibold">Comprar créditos</p>
          <p className="text-muted-foreground mt-1 text-xs">
            Pague via PIX. 1 crédito = R${' '}
            {creditsToBRL(1, creditBrl).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}.
          </p>
        </div>
      </div>
      <button
        onClick={buyCredits}
        disabled={buying}
        className="brand-gradient rounded-full py-2.5 text-sm font-semibold text-white transition-transform hover:scale-[1.02] disabled:opacity-60 dark:text-black"
      >
        {buying ? 'Abrindo…' : 'Comprar créditos'}
      </button>
    </Card>
  )
}
