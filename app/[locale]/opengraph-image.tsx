import { ImageResponse } from 'next/og'

// Imagem de preview do link (Open Graph / Twitter). Gerada em tempo de build/edge
// pelo Next — sem asset manual. Aparece quando o domínio é colado no Google,
// WhatsApp, X, etc. 1200×630 é o tamanho canônico.
export const alt = 'Axyoma — Crie sem limite de uso'
export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'

export default function OgImage(): ImageResponse {
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
          Axyoma AI
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
          Desenhe, planeje e code com IA
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
          Estúdio de engenharia com IA em app desktop. Os melhores modelos, com
          créditos que você controla. Sem chave de API.
        </div>
        <div style={{ marginTop: 44, fontSize: 28, color: '#6b6b74' }}>axyoma.ia.br</div>
      </div>
    ),
    { ...size },
  )
}
