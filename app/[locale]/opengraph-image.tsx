import { ImageResponse } from 'next/og'
import ptBR from '@/messages/pt-BR.json'
import en from '@/messages/en.json'
import { DEFAULT_LOCALE, isLocale, type Locale } from '@/i18n/routing'

// Imagem de preview do link (Open Graph / Twitter). Gerada em tempo de build/edge
// pelo Next — sem asset manual. Aparece quando o domínio é colado no Google,
// WhatsApp, X, etc. 1200×630 é o tamanho canônico.
export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'

// O CATÁLOGO É LIDO DIRETO DO JSON, e não por `getTranslations`.
// `generateImageMetadata` roda fora do escopo de requisição do next-intl (o Next
// resolve metadata num caminho próprio, e de lá `getTranslations` estoura com
// "not supported in Client Components"). Ler o JSON não depende de contexto
// nenhum e mantém o texto no MESMO lugar das outras traduções — que é o ponto.
type OgMessages = { alt: string; eyebrow: string; title: string; body: string }
const OG: Record<Locale, OgMessages> = {
  'pt-BR': (ptBR as unknown as { og: OgMessages }).og,
  en: (en as unknown as { og: OgMessages }).og,
}

function og(locale: string): OgMessages {
  return OG[isLocale(locale) ? locale : DEFAULT_LOCALE]
}

export function generateImageMetadata({ params }: { params: { locale: string } }): {
  id: string
  alt: string
  size: typeof size
  contentType: string
}[] {
  return [{ id: 'og', alt: og(params.locale).alt, size, contentType }]
}

export default async function OgImage({
  params,
}: {
  params: Promise<{ locale: string }>
}): Promise<ImageResponse> {
  const { locale } = await params
  const t = og(locale)

  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          padding: '80px',
          background: '#050506',
          backgroundImage:
            'radial-gradient(circle at 85% 15%, rgba(251,134,10,0.25), transparent 45%), radial-gradient(circle at 15% 90%, rgba(246,64,14,0.18), transparent 40%)',
        }}
      >
        <div
          style={{
            fontSize: 30,
            letterSpacing: 6,
            textTransform: 'uppercase',
            color: '#fb860a',
            fontWeight: 600,
          }}
        >
          {t.eyebrow}
        </div>
        <div
          style={{
            marginTop: 24,
            fontSize: 84,
            lineHeight: 1.05,
            fontWeight: 700,
            color: '#ececf1',
            maxWidth: 900,
          }}
        >
          {t.title}
        </div>
        <div
          style={{
            marginTop: 32,
            fontSize: 34,
            lineHeight: 1.35,
            color: '#a1a1aa',
            maxWidth: 940,
          }}
        >
          {t.body}
        </div>
        <div style={{ marginTop: 44, fontSize: 28, color: '#6b6b74' }}>axyoma.ia.br</div>
      </div>
    ),
    { ...size },
  )
}
