// Resolve os instaladores da ÚLTIMA release direto da API do GitHub.
//
// POR QUE NÃO LINK FIXO: o nome do artefato carrega a versão
// (`AXYOMA.AI-0.3.1-arm64.dmg`), então todo lançamento invalidaria os links da
// página e alguém teria que lembrar de editá-los à mão. Já
// `/releases/latest/download/<nome>` também não resolve pelo mesmo motivo — o
// <nome> muda. Perguntar à API é o único caminho que sobrevive a um release
// sem intervenção.
//
// CUSTO: a API sem token permite 60 req/h por IP. O `revalidate` abaixo faz o
// Next guardar a resposta no Data Cache, então o site inteiro gasta ~4 req/h,
// não uma por visita.
//
// FALLBACK: se a API falhar (fora do ar, limite estourado, release ainda não
// publicada), devolvemos os links da 0.3.1 fixos. A página de download nunca
// pode ficar sem um instalador.

// Nada aqui expõe a PÁGINA de releases do GitHub de propósito: de lá o
// visitante alcança versões antigas, que podem ter falhas já corrigidas. A
// página de download oferece apenas os binários da release mais recente.
const REPO = 'BryanLinocnl/AXIOMA-AI-releases'

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
}

export type ReleaseInfo = {
  version: string
  /** ISO 8601, ou null no fallback. */
  publishedAt: string | null
  installers: Installer[]
  /** true quando a API não respondeu e estamos servindo os links fixos. */
  stale: boolean
}

// Como reconhecer cada instalador entre os assets da release. A ordem importa:
// `-arm64.dmg` tem que ser testado antes de `.dmg`, senão o x64 casaria errado.
const MATCHERS: { id: Installer['id']; os: Installer['os']; label: string; detail: string; test: RegExp }[] = [
  { id: 'mac-arm64', os: 'mac', label: 'macOS', detail: 'Apple Silicon', test: /-arm64\.dmg$/i },
  { id: 'mac-x64', os: 'mac', label: 'macOS', detail: 'Intel', test: /-x64\.dmg$/i },
  { id: 'win', os: 'win', label: 'Windows', detail: '64-bit', test: /-setup\.exe$/i },
  { id: 'linux', os: 'linux', label: 'Linux', detail: 'AppImage', test: /\.AppImage$/i },
]

const FALLBACK: ReleaseInfo = {
  version: '0.3.1',
  publishedAt: null,
  stale: true,
  installers: [
    {
      id: 'mac-arm64',
      os: 'mac',
      label: 'macOS',
      detail: 'Apple Silicon',
      url: `https://github.com/${REPO}/releases/download/v0.3.1/AXYOMA.AI-0.3.1-arm64.dmg`,
      size: 0,
    },
    {
      id: 'mac-x64',
      os: 'mac',
      label: 'macOS',
      detail: 'Intel',
      url: `https://github.com/${REPO}/releases/download/v0.3.1/AXYOMA.AI-0.3.1-x64.dmg`,
      size: 0,
    },
    {
      id: 'win',
      os: 'win',
      label: 'Windows',
      detail: '64-bit',
      url: `https://github.com/${REPO}/releases/download/v0.3.1/AXYOMA.AI-0.3.1-setup.exe`,
      size: 0,
    },
    {
      id: 'linux',
      os: 'linux',
      label: 'Linux',
      detail: 'AppImage',
      url: `https://github.com/${REPO}/releases/download/v0.3.1/AXYOMA.AI-0.3.1.AppImage`,
      size: 0,
    },
  ],
}

type GhAsset = { name: string; browser_download_url: string; size: number }
type GhRelease = { tag_name?: string; published_at?: string; assets?: GhAsset[] }

export async function getLatestRelease(): Promise<ReleaseInfo> {
  try {
    const res = await fetch(`https://api.github.com/repos/${REPO}/releases/latest`, {
      headers: { Accept: 'application/vnd.github+json' },
      next: { revalidate: 900 },
    })
    if (!res.ok) throw new Error(`GitHub respondeu ${res.status}`)

    const data = (await res.json()) as GhRelease
    const assets = data.assets ?? []

    const installers = MATCHERS.flatMap<Installer>((m) => {
      const hit = assets.find((a) => m.test.test(a.name))
      if (!hit) return []
      return [
        {
          id: m.id,
          os: m.os,
          label: m.label,
          detail: m.detail,
          url: hit.browser_download_url,
          size: hit.size,
        },
      ]
    })

    // Release sem nenhum instalável reconhecido não serve — melhor o fallback,
    // que ao menos aponta para binários que sabemos existir.
    if (installers.length === 0) return FALLBACK

    return {
      version: (data.tag_name ?? '').replace(/^v/, '') || FALLBACK.version,
      publishedAt: data.published_at ?? null,
      installers,
      stale: false,
    }
  } catch (e) {
    console.error('[releases] não consegui resolver a última release:', e)
    return FALLBACK
  }
}

export function formatSize(bytes: number): string {
  if (!bytes) return ''
  return `${(bytes / 1024 / 1024).toFixed(0)} MB`
}
