import { SiteNav } from '@/components/landing/SiteNav'
import { Hero } from '@/components/landing/Hero'
import { ModelWall } from '@/components/landing/ModelWall'
import { ProblemSection } from '@/components/landing/ProblemSection'
import { ControlSection } from '@/components/landing/ControlSection'
import { ScaleSection } from '@/components/landing/ScaleSection'
import { ProductGrid } from '@/components/landing/ProductGrid'
import { LedgerSection } from '@/components/landing/LedgerSection'
import { RunSection } from '@/components/landing/RunSection'
import { Pricing } from '@/components/landing/Pricing'
import { Faq } from '@/components/landing/Faq'
import { SiteFooter } from '@/components/landing/SiteFooter'
import { getTranslations, setRequestLocale } from 'next-intl/server'

// `setRequestLocale` em toda página do `[locale]`: sem ele o next-intl marca a
// rota como dinâmica na primeira leitura de idioma, e a landing — estática desde
// sempre — passaria a ser renderizada a cada visita.
export default async function Home({
  params,
}: {
  params: Promise<{ locale: string }>
}): Promise<React.JSX.Element> {
  const { locale } = await params
  setRequestLocale(locale)
  const t = await getTranslations('home')

  return (
    <div className="glass-site relative min-h-screen">
      <a
        href="#conteudo"
        className="sr-only z-[60] rounded-[10px] px-4 py-2 text-sm font-semibold focus:not-sr-only focus:fixed focus:left-4 focus:top-4"
        style={{ background: 'var(--accent)', color: '#fff' }}
      >
        {t('skipToContent')}
      </a>
      <SiteNav />
      <main id="conteudo">
        <Hero />
        <ModelWall />
        {/* Problema antes de recurso. Fica DEPOIS da parede de modelos, não
            entre ela e o herói: a parede é a prova imediata da promessa do
            herói, e separar as duas quebra a leitura. Daqui em diante a página
            é funcionalidade — ControlSection, ProductGrid, Ledger — e é
            justamente isso que precisava de um porquê antes. */}
        <ProblemSection />
        <ControlSection />
        <ScaleSection />
        <ProductGrid />
        <LedgerSection />
        <RunSection />
        <Pricing />
        <Faq />
      </main>
      <SiteFooter />
    </div>
  )
}
