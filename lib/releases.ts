// Resolve os instaladores direto da API do GitHub, UM POR PLATAFORMA.
//
// POR QUE NÃO LINK FIXO: o nome do artefato carrega a versão
// (`AXYOMA.AI-0.3.1-arm64.dmg`), então todo lançamento invalidaria os links da
// página e alguém teria que lembrar de editá-los à mão. Já
// `/releases/latest/download/<nome>` também não resolve pelo mesmo motivo — o
// <nome> muda. Perguntar à API é o único caminho que sobrevive a um release
// sem intervenção.
//
// POR QUE NÃO BASTA `/releases/latest`: um release pode sair INCOMPLETO. Foi o
// que aconteceu na v1.1.0 — o CI ficou bloqueado por pendência de pagamento e
// os binários saíram de build local, onde só macOS e Windows são viáveis (o
// AppImage precisa compilar `node-pty` em Linux, e node-gyp não cross-compila).
// Lendo um release só, a linha de Linux simplesmente SUMIA da página: quem
// entrasse de Linux não achava nada para baixar. E o `FALLBACK` lá embaixo não
// salvava, porque ele só dispara quando NENHUM instalador é reconhecido.
//
// Daí a resolução por plataforma: percorremos os releases do mais novo para o
// mais antigo e, para cada plataforma, ficamos com a PRIMEIRA ocorrência. Assim
// macOS e Windows apontam para a v1.1.0 enquanto Linux continua na v1.0.0, em
// vez de a página mentir por omissão. Cada instalador carrega a própria
// `version` justamente para a interface poder dizer isso em voz alta.
//
// CONSEQUÊNCIA OPERACIONAL: enquanto uma plataforma depender de um release
// antigo, esse release NÃO pode ser apagado — é o único lugar de onde o binário
// dela sai.
//
// CUSTO: a API sem token permite 60 req/h por IP. O `revalidate` abaixo faz o
// Next guardar a resposta no Data Cache, então o site inteiro gasta ~4 req/h,
// não uma por visita. Continua sendo UMA requisição: pedimos a lista, não um
// release por plataforma.
//
// FALLBACK: se a API falhar (fora do ar, limite estourado, nenhuma release
// publicada), devolvemos os links da 0.3.1 fixos. A página de download nunca
// pode ficar sem um instalador.

// Nada aqui expõe a PÁGINA de releases do GitHub de propósito: de lá o
// visitante alcança versões antigas, que podem ter falhas já corrigidas. A
// página oferece apenas o binário mais recente de cada sistema.
const REPO = 'BryanLinocnl/AXIOMA-AI-releases'

/** Quantos releases olhamos para trás procurando uma plataforma ausente. */
const JANELA = 30

/** Cada instalável que a página oferece, na ordem em que aparece. */
export type Installer = {
  id: 'mac-arm64' | 'mac-x64' | 'win' | 'linux'
  os: 'mac' | 'win' | 'linux'
  label: string
  /** Detalhe curto ao lado do rótulo (arquitetura, formato). */
  detail: string
  url: string
  /** Tamanho em bytes; 0 quando veio do fallback. */
  size: number
  /** Versão DESTE binário — pode ser mais antiga que a `version` da página. */
  version: string
}

export type ReleaseInfo = {
  /** A versão mais recente publicada, mesmo que nem toda plataforma a tenha. */
  version: string
  /** ISO 8601, ou null no fallback. */
  publishedAt: string | null
  installers: Installer[]
  /** true quando a API não respondeu e estamos servindo os links fixos. */
  stale: boolean
}

// Como reconhecer cada instalador entre os assets da release. A ordem importa:
// `-arm64.dmg` tem que ser testado antes de `.dmg`, senão o x64 casaria errado.
//
// LINUX ESTÁ FORA, temporariamente. O AppImage exige compilar `node-pty` em
// Linux (node-gyp não cross-compila) e hoje isso depende do CI, que está
// bloqueado. Em vez de manter a linha apontando para um binário velho, a página
// simplesmente não oferece Linux — dizer "não temos ainda" é mais honesto do que
// entregar uma versão atrasada sem o usuário perceber.
//
// Para religar: devolver a linha do AppImage abaixo. O tipo `Installer` mantém
// 'linux' de propósito, então é essa única linha.
const MATCHERS: { id: Installer['id']; os: Installer['os']; label: string; detail: string; test: RegExp }[] = [
  { id: 'mac-arm64', os: 'mac', label: 'macOS', detail: 'Apple Silicon', test: /-arm64\.dmg$/i },
  { id: 'mac-x64', os: 'mac', label: 'macOS', detail: 'Intel', test: /-x64\.dmg$/i },
  { id: 'win', os: 'win', label: 'Windows', detail: '64-bit', test: /-setup\.exe$/i },
]

// Links fixos para quando a API não responder.
//
// PRECISA APONTAR PARA O RELEASE MAIS RECENTE, e a razão é operacional, não
// estética: o release anterior é APAGADO a cada publicação. O repositório de
// binários é público, e um build antigo continuando lá carrega falhas já
// corrigidas ao alcance de qualquer um. Foi o que se fez com tudo anterior à
// v1.1.0, e é o que se faz agora a cada versão.
//
// Consequência direta: um FALLBACK atrasado não fica "velho", fica QUEBRADO —
// aponta para um release que não existe mais, e são três links 404 justamente
// no momento em que o fallback é a única coisa de pé. Ele passou a v1.2.0
// inteira em 1.1.0 e só não quebrou porque a v1.1.0 ainda não tinha sido
// apagada.
//
// ATUALIZE ESTA CONSTANTE NO MESMO COMMIT em que o release novo sai.
const FALLBACK_VERSAO = '1.3.0'
const FALLBACK: ReleaseInfo = {
  version: FALLBACK_VERSAO,
  publishedAt: null,
  stale: true,
  installers: [
    {
      id: 'mac-arm64',
      os: 'mac',
      label: 'macOS',
      detail: 'Apple Silicon',
      url: `https://github.com/${REPO}/releases/download/v${FALLBACK_VERSAO}/AXYOMA.AI-${FALLBACK_VERSAO}-arm64.dmg`,
      size: 0,
      version: FALLBACK_VERSAO,
    },
    {
      id: 'mac-x64',
      os: 'mac',
      label: 'macOS',
      detail: 'Intel',
      url: `https://github.com/${REPO}/releases/download/v${FALLBACK_VERSAO}/AXYOMA.AI-${FALLBACK_VERSAO}-x64.dmg`,
      size: 0,
      version: FALLBACK_VERSAO,
    },
    {
      id: 'win',
      os: 'win',
      label: 'Windows',
      detail: '64-bit',
      url: `https://github.com/${REPO}/releases/download/v${FALLBACK_VERSAO}/AXYOMA.AI-${FALLBACK_VERSAO}-setup.exe`,
      size: 0,
      version: FALLBACK_VERSAO,
    },
  ],
}

type GhAsset = { name: string; browser_download_url: string; size: number }
type GhRelease = {
  tag_name?: string
  published_at?: string
  draft?: boolean
  prerelease?: boolean
  assets?: GhAsset[]
}

/** `v1.1.0` → `1.1.0`. */
function semVersao(tag: string | undefined): string {
  return (tag ?? '').replace(/^v/, '')
}

export async function getLatestRelease(): Promise<ReleaseInfo> {
  try {
    const res = await fetch(`https://api.github.com/repos/${REPO}/releases?per_page=${JANELA}`, {
      headers: { Accept: 'application/vnd.github+json' },
      next: { revalidate: 900 },
    })
    if (!res.ok) throw new Error(`GitHub respondeu ${res.status}`)

    const todas = (await res.json()) as GhRelease[]

    // Rascunho nunca; pré-release também não — é exatamente o estado em que
    // marcamos um release enquanto ele está incompleto, e trazê-lo para a página
    // por acidente anularia o motivo de tê-lo marcado.
    //
    // A API devolve do mais novo para o mais antigo (por data de criação), que é
    // a ordem que a busca abaixo assume.
    const publicadas = (Array.isArray(todas) ? todas : []).filter((r) => !r.draft && !r.prerelease)
    if (publicadas.length === 0) return FALLBACK

    const installers = MATCHERS.flatMap<Installer>((m) => {
      for (const rel of publicadas) {
        const hit = (rel.assets ?? []).find((a) => m.test.test(a.name))
        if (!hit) continue
        return [
          {
            id: m.id,
            os: m.os,
            label: m.label,
            detail: m.detail,
            url: hit.browser_download_url,
            size: hit.size,
            version: semVersao(rel.tag_name),
          },
        ]
      }
      return []
    })

    // Nenhuma plataforma reconhecida em release nenhuma — melhor o fallback,
    // que ao menos aponta para binários que sabemos existir.
    if (installers.length === 0) return FALLBACK

    return {
      version: semVersao(publicadas[0].tag_name) || FALLBACK.version,
      publishedAt: publicadas[0].published_at ?? null,
      installers,
      stale: false,
    }
  } catch (e) {
    console.error('[releases] não consegui resolver os instaladores:', e)
    return FALLBACK
  }
}

export function formatSize(bytes: number): string {
  if (!bytes) return ''
  return `${(bytes / 1024 / 1024).toFixed(0)} MB`
}
