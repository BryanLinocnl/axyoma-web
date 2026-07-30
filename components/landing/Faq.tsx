import { useTranslations } from 'next-intl'

// A ORDEM DA LISTA VIVE AQUI, não no JSON: é decisão de página (o que se
// pergunta primeiro), não de tradução.
//
//   • `ondeChave` — onde a chave mora é a primeira pergunta de quem cola uma
//     chave num app de terceiro, e a resposta é um diferencial nosso: não
//     guardamos. Vale pergunta própria em vez de uma linha escondida em outra.
//   • `sistemas` — LINUX: o instalador voltou a ser gerado só para Windows e
//     macOS. Enquanto o AppImage não volta, esta resposta não pode listá-lo —
//     é a pergunta que alguém faz JUSTAMENTE para decidir se baixa.
const ITEMS = [
  'oque',
  'api',
  'byok',
  'ondeChave',
  'local',
  'escolher',
  'autonomia',
  'cobranca',
  'sistemas',
] as const

export function Faq(): React.JSX.Element {
  const t = useTranslations('faq')

  return (
    <section id="faq" className="relative">
      <div className="mx-auto max-w-[1200px] px-5 py-20 sm:px-6 sm:py-28 lg:py-32">
        <h2 className="gb-display text-[clamp(2.1rem,4.9vw,3.5rem)]">{t('title')}</h2>

        <div className="mt-12 flex flex-col gap-3">
          {ITEMS.map((id) => (
            // `name="faq"` = accordion nativo: abrir um fecha os outros, sem JS.
            <details
              key={id}
              name="faq"
              className="group rounded-[18px] px-5 py-4 transition-colors sm:px-6 sm:py-5"
              style={{ background: 'color-mix(in srgb, var(--ink) 4%, transparent)' }}
            >
              <summary className="flex cursor-pointer list-none items-center justify-between gap-5 text-[16.5px] font-semibold tracking-[-0.015em] [&::-webkit-details-marker]:hidden">
                {t(`${id}Q`)}
                <span
                  aria-hidden
                  className="grid h-8 w-8 shrink-0 place-items-center rounded-full text-[18px] leading-none transition-transform duration-200 group-open:rotate-45"
                  style={{ border: '1px solid var(--hairline-strong)', color: 'var(--ink-muted)' }}
                >
                  +
                </span>
              </summary>
              <p
                className="mt-3 max-w-[68ch] text-[15px] leading-relaxed"
                style={{ color: 'var(--ink-muted)' }}
              >
                {t(`${id}A`)}
              </p>
            </details>
          ))}
        </div>
      </div>
    </section>
  )
}
