'use client'

import { useState } from 'react'
import { SUPABASE_URL } from '@/lib/supabase-browser'
import { creditsToBRL } from '@/lib/credits'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

const PACK_ID = 'credits-100'

// Gateway único: Asaas (`asaas-create-payment`). AbacatePay foi descontinuado.
// Contrato REAL (POST, JWT bearer):
//   body: { packId: string, cpf?: string }
//   1ª compra (sem asaas_customers ainda): exige `cpf`; sem ele responde
//   422 { error: 'cpf_required' }. Compras seguintes reaproveitam o customer.
//   sucesso: { url, paymentId, credits } — `url` é a fatura hosted da Asaas.
// Obs.: a function cria a cobrança como `billingType: 'PIX'` hoje — o pagamento
// é via PIX. Cartão de crédito exigirá mudança no backend (em breve).
const ENDPOINT = 'asaas-create-payment'

function formatCpf(digits: string): string {
  return digits
    .slice(0, 11)
    .replace(/(\d{3})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d{1,2})$/, '$1-$2')
}

function isValidCpf(digits: string): boolean {
  if (digits.length !== 11 || /^(\d)\1{10}$/.test(digits)) return false
  const calcDigit = (base: string, factor: number): number => {
    let sum = 0
    for (const c of base) sum += Number(c) * factor--
    const rest = (sum * 10) % 11
    return rest === 10 ? 0 : rest
  }
  const d1 = calcDigit(digits.slice(0, 9), 10)
  const d2 = calcDigit(digits.slice(0, 10), 11)
  return d1 === Number(digits[9]) && d2 === Number(digits[10])
}

export function BuyCreditsPanel({ token, creditBrl }: { token: string; creditBrl: number }): React.JSX.Element {
  const [buying, setBuying] = useState(false)
  const [needsCpf, setNeedsCpf] = useState(false)
  const [cpf, setCpf] = useState('')
  const [cpfError, setCpfError] = useState('')

  async function submit(): Promise<void> {
    const cpfDigits = cpf.replace(/\D/g, '')
    if (needsCpf && !isValidCpf(cpfDigits)) {
      setCpfError('CPF inválido.')
      return
    }
    setCpfError('')
    setBuying(true)
    try {
      const body: { packId: string; cpf?: string } = { packId: PACK_ID }
      if (needsCpf) body.cpf = cpfDigits

      const res = await fetch(`${SUPABASE_URL}/functions/v1/${ENDPOINT}`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const json = await res.json().catch(() => null)

      if (res.status === 422 && json?.error === 'cpf_required') {
        setNeedsCpf(true)
        return
      }
      if (json?.url) {
        // noopener,noreferrer: a fatura do gateway não herda `window.opener`
        // (evita reverse tabnabbing na aba recém-aberta).
        window.open(json.url as string, '_blank', 'noopener,noreferrer')
        setNeedsCpf(false)
        setCpf('')
      } else {
        alert(json?.message ?? json?.error ?? 'Falha ao criar checkout.')
      }
    } catch {
      // fetch() rejeita em falha de rede/DNS/CORS, antes de qualquer resposta.
      alert('Não foi possível conectar ao gateway de pagamento. Verifique sua conexão e tente novamente.')
    } finally {
      setBuying(false)
    }
  }

  return (
    <Card className="p-6">
      <p className="text-muted-foreground text-sm">Precisa de mais?</p>
      <p className="mt-1 text-lg font-semibold">Comprar créditos</p>
      <p className="text-muted-foreground mt-1 text-xs">
        Pacote de 100 créditos. 1 crédito = R${' '}
        {creditsToBRL(1, creditBrl).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}.
      </p>
      <p className="text-muted-foreground mt-2 text-xs">
        Pagamento via PIX. Cartão de crédito em breve.
      </p>

      {needsCpf && (
        <div className="mt-4">
          <Label htmlFor="asaas-cpf" className="mb-2">
            CPF (necessário só na 1ª compra)
          </Label>
          <Input
            id="asaas-cpf"
            inputMode="numeric"
            placeholder="000.000.000-00"
            value={formatCpf(cpf.replace(/\D/g, ''))}
            onChange={(e) => setCpf(e.target.value)}
            aria-invalid={Boolean(cpfError)}
          />
          {cpfError && <p className="text-destructive mt-1 text-xs">{cpfError}</p>}
        </div>
      )}

      <button
        onClick={submit}
        disabled={buying}
        className="brand-gradient mt-4 w-full rounded-full py-2.5 text-sm font-semibold text-white transition-transform hover:scale-[1.02] disabled:opacity-60 dark:text-black"
      >
        {buying ? 'Abrindo…' : needsCpf ? 'Confirmar CPF e continuar' : 'Comprar via PIX'}
      </button>
    </Card>
  )
}
