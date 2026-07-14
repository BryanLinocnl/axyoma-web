import { SiteNav } from '@/components/landing/SiteNav'
import { Hero } from '@/components/landing/Hero'
import { ProofBar } from '@/components/landing/ProofBar'
import { ModesSection } from '@/components/landing/ModesSection'
import { ValuePillars } from '@/components/landing/ValuePillars'
import { HowItWorks } from '@/components/landing/HowItWorks'
import { Pricing } from '@/components/landing/Pricing'
import { FinalCta } from '@/components/landing/FinalCta'
import { SiteFooter } from '@/components/landing/SiteFooter'

export default function Home(): React.JSX.Element {
  return (
    <main id="conteudo" className="relative min-h-screen bg-[var(--bg)]">
      <a
        href="#modos"
        className="sr-only z-[60] rounded-full bg-white px-4 py-2 text-sm font-semibold text-black focus:not-sr-only focus:fixed focus:left-4 focus:top-4"
      >
        Pular para o conteúdo
      </a>
      <SiteNav />
      <Hero />
      <ProofBar id="modos" />
      <ModesSection />
      <ValuePillars />
      <HowItWorks />
      <Pricing />
      <FinalCta />
      <SiteFooter />
    </main>
  )
}
