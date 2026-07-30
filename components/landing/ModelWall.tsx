import Image from 'next/image'
import { useTranslations } from 'next-intl'

/**
 * O lugar que uma landing de SaaS reserva a logos de cliente. O Axyoma ainda não
 * tem cliente para mostrar, e inventar um seria mentira — então o espaço vai
 * para uma verdade verificável: os provedores cujos modelos rodam dentro do app.
 * Os SVGs são os oficiais, já versionados em `public/providers/`.
 */
const PROVIDERS: { file: string; name: string }[] = [
  { file: 'anthropic', name: 'Anthropic' },
  { file: 'google', name: 'Google' },
  { file: 'openai', name: 'OpenAI' },
  { file: 'x-ai', name: 'xAI' },
  { file: 'meta-llama', name: 'Meta' },
  { file: 'deepseek', name: 'DeepSeek' },
  { file: 'moonshotai', name: 'Moonshot' },
  { file: 'qwen', name: 'Qwen' },
  { file: 'mistralai', name: 'Mistral' },
  { file: 'microsoft', name: 'Microsoft' },
]

export function ModelWall(): React.JSX.Element {
  const t = useTranslations('modelWall')

  return (
    <section className="relative">
      <div className="mx-auto max-w-[1200px] px-5 py-16 sm:px-6 sm:py-20">
        <p className="text-center text-[16px]" style={{ color: 'var(--ink)' }}>
          {t('title')}
        </p>
        <p
          className="mx-auto mt-1 max-w-[64ch] text-center text-[16px]"
          style={{ color: 'var(--ink-faint)' }}
        >
          {t('body')}
        </p>

        <ul className="mx-auto mt-12 grid max-w-[880px] grid-cols-2 gap-x-6 gap-y-9 sm:grid-cols-3 lg:grid-cols-5">
          {PROVIDERS.map((p) => (
            <li key={p.file} className="flex items-center justify-center gap-2.5">
              <Image
                src={`/providers/${p.file}.svg`}
                alt=""
                width={22}
                height={22}
                unoptimized
                aria-hidden
                className="h-[22px] w-[22px] shrink-0 opacity-80 dark:opacity-100 dark:[filter:invert(1)_hue-rotate(180deg)]"
              />
              <span className="text-[15px] font-medium" style={{ color: 'var(--ink-muted)' }}>
                {p.name}
              </span>
            </li>
          ))}
        </ul>
      </div>
    </section>
  )
}
