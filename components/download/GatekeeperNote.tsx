'use client'

import { useState } from 'react'
import { Check, Copy } from 'lucide-react'

/**
 * O macOS diz que o app "está danificado" — e a explicação honesta.
 *
 * POR QUE ISSO ACONTECE: o build ainda não é assinado com um Developer ID da
 * Apple. Todo arquivo baixado pelo navegador chega com o atributo estendido
 * `com.apple.quarantine`; quando o Gatekeeper vai validar a assinatura e não
 * encontra nenhuma, o macOS não diz "não é assinado" — ele diz "está
 * danificado e não pode ser aberto". A mensagem é enganosa: o arquivo está
 * íntegro, o que falta é a assinatura.
 *
 * O COMANDO É ESCOPADO A ESTE APP, de propósito. A receita que circula por aí é
 * `sudo spctl --master-disable`, que desliga a verificação do sistema INTEIRO e
 * vale para todo download futuro — trocar um aviso incômodo por uma máquina
 * desprotegida. `xattr -dr com.apple.quarantine` num caminho específico remove a
 * quarentena só daquele pacote e não altera nenhuma política do sistema.
 *
 * Isto some quando o certificado da Apple for renovado e o build passar a ser
 * assinado e notarizado: aí o Gatekeeper valida sozinho e não há passo manual.
 */

const APP = '/Applications/AXYOMA AI.app'
const COMANDO = `xattr -dr com.apple.quarantine "${APP}"`

export function GatekeeperNote(): React.JSX.Element {
  const [copied, setCopied] = useState(false)

  async function copy(): Promise<void> {
    try {
      await navigator.clipboard.writeText(COMANDO)
      setCopied(true)
      setTimeout(() => setCopied(false), 1800)
    } catch {
      /* clipboard indisponível — o comando continua selecionável na tela */
    }
  }

  return (
    <section
      className="mt-10 w-full max-w-[560px] rounded-[14px] p-5 text-left"
      style={{ border: '1px solid var(--hairline)' }}
      aria-labelledby="gatekeeper-titulo"
    >
      <h2 id="gatekeeper-titulo" className="text-[14.5px] font-medium">
        No macOS, se aparecer “o app está danificado”
      </h2>

      <p className="mt-2 text-[13.5px] leading-relaxed" style={{ color: 'var(--ink-muted)' }}>
        O arquivo está íntegro. Esta versão ainda não é assinada com um certificado da Apple, e o
        macOS descreve toda aplicação sem assinatura desse jeito. Arraste o app para a pasta{' '}
        <span className="gb-mono text-[12.5px]">Aplicativos</span> e rode uma vez no Terminal:
      </p>

      {/* O comando QUEBRA em vez de rolar. Numa única linha com scroll
          horizontal ele aparece cortado no meio do caminho, e comando truncado
          se lê como comando incompleto — a pessoa que precisa desta caixa é
          justamente a que não sabe o que deveria estar depois do corte. */}
      <div
        className="mt-3 flex items-start gap-2 rounded-[10px] px-3 py-2.5"
        style={{ background: 'color-mix(in srgb, var(--ink) 5%, transparent)' }}
      >
        <code
          className="gb-mono min-w-0 flex-1 break-all whitespace-pre-wrap text-[12.5px] leading-relaxed"
          style={{ color: 'var(--ink)' }}
        >
          {COMANDO}
        </code>
        {/* Só o ícone: a palavra "Copiar" roubava a largura de que o comando
            precisa para caber numa linha. O rótulo continua existindo para
            leitor de tela e como tooltip. */}
        <button
          type="button"
          onClick={copy}
          className="grid size-7 shrink-0 place-items-center rounded-[8px] transition-colors hover:bg-[color-mix(in_srgb,var(--ink)_8%,transparent)]"
          style={{ color: copied ? 'var(--ink)' : 'var(--ink-muted)' }}
          aria-label={copied ? 'Comando copiado' : 'Copiar comando'}
          title={copied ? 'Copiado' : 'Copiar comando'}
        >
          {copied ? <Check className="size-4" aria-hidden /> : <Copy className="size-4" aria-hidden />}
        </button>
      </div>

      <p className="mt-3 text-[12.5px] leading-relaxed" style={{ color: 'var(--ink-faint)' }}>
        Ele remove a marca de quarentena apenas deste aplicativo. Nenhuma proteção do seu sistema é
        desligada, e os próximos downloads seguem sendo verificados normalmente.
      </p>
    </section>
  )
}
