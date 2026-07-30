import { useTranslations } from 'next-intl'
import { AxiomaMark } from '@/components/AxiomaMark'
import { LocaleSwitcher } from '@/components/site/LocaleSwitcher'
// Ver o comentário em SiteNav.tsx: href cru derruba o visitante para o pt-BR.
import { Link } from '@/i18n/navigation'

// Casca das páginas institucionais/legais (privacidade, termos, contato).
// Mundo Glass Bench (ver DESIGN.md): mesa clara, azul como único acento,
// Bricolage no título. Antes usava cinzas e laranja cravados na mão, de antes
// do redesign — e essas páginas são justamente as que um revisor abre.
export function ContentPage({
  title,
  intro,
  children,
  // Idioma do CONTEÚDO, quando ele não acompanha o idioma do site. Existe por
  // causa de `privacidade` e `termos`, que continuam em português na versão
  // inglesa: sem isto o <html lang="en"> faria o leitor de tela ler um documento
  // português com voz inglesa, e o Google indexaria o texto como se fosse inglês.
  contentLang,
}: {
  title: string
  intro?: React.ReactNode
  children: React.ReactNode
  contentLang?: string
}): React.JSX.Element {
  const t = useTranslations('contentPage')

  return (
    <div className="glass-site">
      <main className="min-h-screen">
        <div className="mx-auto w-full max-w-[900px] px-6 py-14 sm:py-16">
          <div className="mb-14 flex items-center justify-between">
            <Link href="/" className="flex items-center gap-2.5">
              <span
                className="grid size-9 place-items-center rounded-full text-white"
                style={{ background: 'linear-gradient(to top, #1e40af, #2563eb)' }}
              >
                <AxiomaMark className="size-5" />
              </span>
              <span className="font-brand text-[22px] leading-none tracking-tight">Axyoma</span>
            </Link>
            <div className="flex items-center gap-4">
              <LocaleSwitcher />
              <Link
                href="/download"
                className="text-[15px] font-medium transition-colors"
                style={{ color: 'var(--accent)' }}
              >
                {t('download')}
              </Link>
            </div>
          </div>

          <h1 className="gb-display text-[clamp(2.1rem,4.6vw,3.25rem)]" lang={contentLang}>
            {title}
          </h1>
          {intro ? (
            <p
              className="gb-measure mt-5 text-[17px] leading-relaxed"
              style={{ color: 'var(--ink-muted)' }}
              lang={contentLang}
            >
              {intro}
            </p>
          ) : null}

          <div
            className="mt-14 flex flex-col gap-12 text-[16.5px] leading-relaxed"
            style={{ color: 'var(--ink-muted)' }}
            lang={contentLang}
          >
            {children}
          </div>

          <div
            className="mt-16 border-t pt-6 text-[15px]"
            style={{ borderColor: 'var(--hairline)', color: 'var(--ink-faint)' }}
          >
            <Link href="/" className="underline underline-offset-4">
              {t('back')}
            </Link>
          </div>
        </div>
      </main>
    </div>
  )
}

// Seção padrão: título sólido em preto (sem degradê/itálico) + corpo.
//
// `id` existe para as páginas legais: documento de conformidade é lido por
// consulta ("o que diz sobre retenção?"), não da primeira à última linha, e
// quem revisa precisa mandar link para um trecho específico. `scroll-mt`
// compensa a âncora ficar colada no topo da janela.
export function Secao({
  titulo,
  id,
  children,
}: {
  titulo: string
  id?: string
  children: React.ReactNode
}): React.JSX.Element {
  return (
    <section id={id} className={id ? 'scroll-mt-8' : undefined}>
      <h2
        className="mb-4 text-[22px] font-semibold tracking-[-0.02em] sm:text-[26px]"
        style={{ color: 'var(--ink)' }}
      >
        {titulo}
      </h2>
      <div className="flex flex-col gap-4">{children}</div>
    </section>
  )
}

// Divisão dentro de uma seção. Documento legal longo sem terceiro nível vira
// parede de texto — e é justamente onde mora o detalhe que o revisor procura.
export function SubSecao({
  titulo,
  children,
}: {
  titulo: string
  children: React.ReactNode
}): React.JSX.Element {
  return (
    <div>
      <h3 className="mb-2 text-[17px] font-semibold" style={{ color: 'var(--ink)' }}>
        {titulo}
      </h3>
      <div className="flex flex-col gap-3">{children}</div>
    </div>
  )
}

/** Lista com marcador discreto, no mesmo ritmo do corpo. */
export function Lista({ itens }: { itens: React.ReactNode[] }): React.JSX.Element {
  return (
    <ul className="flex flex-col gap-2">
      {itens.map((item, i) => (
        <li key={i} className="flex gap-2.5">
          <span
            className="mt-[9px] h-[5px] w-[5px] shrink-0 rounded-full"
            style={{ background: 'var(--accent)' }}
            aria-hidden
          />
          <span>{item}</span>
        </li>
      ))}
    </ul>
  )
}

/**
 * Tabela para as matrizes que uma política precisa ter (base legal por
 * finalidade, operador por país, prazo por categoria).
 *
 * A rolagem horizontal fica DENTRO do contêiner: numa tela estreita, tabela de
 * três colunas empurraria a página inteira para o lado.
 */
export function Tabela({
  colunas,
  linhas,
}: {
  colunas: string[]
  linhas: React.ReactNode[][]
}): React.JSX.Element {
  return (
    <div
      className="gb-raised overflow-x-auto rounded-[14px]"
      style={{ border: '1px solid var(--hairline)' }}
    >
      <table className="w-full min-w-[520px] border-collapse text-[15px]">
        <thead>
          <tr>
            {colunas.map((c) => (
              <th
                key={c}
                scope="col"
                className="px-4 py-3 text-left text-[13.5px] font-semibold"
                style={{ color: 'var(--ink)', borderBottom: '1px solid var(--hairline)' }}
              >
                {c}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {linhas.map((linha, i) => (
            <tr key={i}>
              {linha.map((celula, j) => (
                <td
                  key={j}
                  className="px-4 py-3 align-top leading-relaxed"
                  style={i > 0 ? { borderTop: '1px solid var(--hairline)' } : undefined}
                >
                  {celula}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

/** Índice ancorado. Ver o comentário de `Secao` sobre por que ele existe. */
export function Indice({ itens }: { itens: { id: string; titulo: string }[] }): React.JSX.Element {
  const t = useTranslations('contentPage')
  return (
    <nav
      aria-label={t('indexAriaLabel')}
      className="rounded-[14px] p-5"
      style={{ border: '1px solid var(--hairline)' }}
    >
      <p className="mb-3 text-[13px] font-semibold uppercase tracking-wide" style={{ color: 'var(--ink-faint)' }}>
        {t('onThisPage')}
      </p>
      <ol className="grid gap-x-8 gap-y-1.5 text-[15px] sm:grid-cols-2">
        {itens.map((it, i) => (
          <li key={it.id} className="flex gap-2">
            <span className="gb-mono shrink-0 text-[13px]" style={{ color: 'var(--ink-faint)' }}>
              {String(i + 1).padStart(2, '0')}
            </span>
            <a href={`#${it.id}`} className="underline-offset-4 hover:underline">
              {it.titulo}
            </a>
          </li>
        ))}
      </ol>
    </nav>
  )
}

/**
 * Aviso no topo das páginas legais quando o site está em outro idioma.
 *
 * `privacidade` e `termos` NÃO são traduzidos (spec `multilingue.md` §2.1 e §6):
 * são documentos jurídicos, e o visitante europeu está sob GDPR, não LGPD —
 * traduzir por máquina um texto que declara o que se faz com dado pessoal é
 * assumir risco em outra jurisdição. Enquanto não houver revisão humana, a
 * versão em inglês serve o documento em português COM este aviso, que é a opção
 * honesta: política mal traduzida é pior do que política em outro idioma.
 *
 * Só aparece fora do português — por isso as chaves `legal.ptOnly*` existem no
 * catálogo pt-BR (a verificação de paridade exige) mas nunca chegam à tela.
 */
export function AvisoDocumentoEmPortugues({
  titulo,
  corpo,
}: {
  titulo: string
  corpo: React.ReactNode
}): React.JSX.Element {
  return (
    <aside
      className="gb-raised rounded-[14px] p-5"
      style={{ border: '1px solid var(--accent)' }}
      lang="en"
    >
      <p className="text-[15px] font-semibold" style={{ color: 'var(--ink)' }}>
        {titulo}
      </p>
      <p className="mt-2 text-[14.5px] leading-relaxed" style={{ color: 'var(--ink-muted)' }}>
        {corpo}
      </p>
    </aside>
  )
}

// Painel para itens de FAQ e blocos de destaque.
export function Card({ children }: { children: React.ReactNode }): React.JSX.Element {
  return (
    <div className="gb-raised rounded-[16px] p-6" style={{ border: '1px solid var(--hairline)' }}>
      {children}
    </div>
  )
}

// Link de destaque no acento azul (o laranja é reservado à marca).
export function A({ href, children }: { href: string; children: React.ReactNode }): React.JSX.Element {
  return (
    <a
      href={href}
      className="font-medium underline underline-offset-2"
      style={{ color: 'var(--accent)' }}
    >
      {children}
    </a>
  )
}
