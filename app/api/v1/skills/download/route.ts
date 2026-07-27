import { verifyUser } from '@/lib/auth'
import { getEntitlements, checkRateLimit } from '@/lib/supabase-admin'
import { corsHeaders } from '@/lib/cors'

// Emite o link de download de UMA skill, depois de conferir o plano.
//
// POR QUE ESTA ROTA EXISTE: o app pedia a signed URL direto ao Storage, e a
// policy do bucket (`skills objects read authenticated`, qual `bucket_id =
// 'skills'`) liberava para QUALQUER usuário autenticado. O gate de plano vivia
// só na UI — escondia os cards e nada mais. Uma conta Free com token válido
// baixava as 207 skills, incluindo as 41 de tier `teams`, que são justamente o
// que os planos pagos vendem. Esconder não é impedir.
//
// A decisão precisa acontecer aqui porque depende de dois fatos que o cliente
// não pode ser dono: o tier da skill (`public.skills.tier`) e a assinatura ativa
// do usuário (`getEntitlements`). Com os dois no servidor, quem assina a URL é
// a service role, e o bucket pode ficar fechado para o público autenticado.
export const runtime = 'edge'

const SUPABASE_URL = process.env.SUPABASE_URL
const SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE_KEY

/** Validade curta: o app usa o link na hora, num único fetch. */
const URL_TTL_SECONDS = 120

export function OPTIONS(req: Request): Response {
  return new Response(null, { status: 204, headers: corsHeaders(req, 'POST, OPTIONS') })
}

export async function POST(req: Request): Promise<Response> {
  const CORS = corsHeaders(req, 'POST, OPTIONS')
  const json = (status: number, body: unknown): Response =>
    new Response(JSON.stringify(body), {
      status,
      headers: { 'Content-Type': 'application/json', ...CORS },
    })

  if (!SUPABASE_URL || !SERVICE_ROLE) {
    return json(500, { error: { message: 'servidor mal configurado', type: 'server' } })
  }

  let userId: string
  try {
    userId = await verifyUser(req.headers.get('authorization'))
  } catch {
    return json(401, { error: { message: 'não autenticado', type: 'auth' } })
  }

  // `failOpen: false`: aqui negar por instabilidade é o lado certo do erro —
  // adiar um download é barato, liberar um que não devia não tem volta.
  const rl = await checkRateLimit({
    userId,
    bucket: 'skills_download',
    limit: Number(process.env.SKILLS_DOWNLOAD_RATE_LIMIT ?? 300),
    windowSeconds: 60,
    failOpen: false,
  })
  if (!rl.allowed) return json(429, { error: { message: 'muitos downloads', type: 'rate_limit' } })

  let slug = ''
  try {
    const body = (await req.json()) as { slug?: unknown }
    slug = typeof body.slug === 'string' ? body.slug.trim() : ''
  } catch {
    return json(400, { error: { message: 'corpo inválido', type: 'invalid_request' } })
  }
  // O slug vira caminho no Storage. Sem esta checagem, `../` no nome sairia do
  // bucket — e o valor vem do cliente, que não é fonte confiável de caminho.
  if (!slug || !/^[a-z0-9][a-z0-9._-]{0,99}$/i.test(slug)) {
    return json(400, { error: { message: 'slug inválido', type: 'invalid_request' } })
  }

  const rest = async (path: string, init?: RequestInit): Promise<Response> =>
    fetch(`${SUPABASE_URL}${path}`, {
      ...init,
      headers: {
        apikey: SERVICE_ROLE,
        Authorization: `Bearer ${SERVICE_ROLE}`,
        'Content-Type': 'application/json',
        ...(init?.headers ?? {}),
      },
    })

  // 1. Tier e caminho real do arquivo, do catálogo do SERVIDOR.
  let tier = ''
  let storagePath = ''
  try {
    const qs = new URLSearchParams({ select: 'tier,storage_path', slug: `eq.${slug}`, limit: '1' })
    const res = await rest(`/rest/v1/skills?${qs.toString()}`)
    if (!res.ok) throw new Error(`skills falhou (${res.status})`)
    const rows = (await res.json()) as { tier?: string; storage_path?: string }[]
    if (!rows[0]) return json(404, { error: { message: 'skill não encontrada', type: 'not_found' } })
    tier = String(rows[0].tier ?? '')
    storagePath = String(rows[0].storage_path ?? `${slug}.json`)
  } catch (e) {
    console.error('[skills/download] catálogo:', (e as Error).message)
    return json(503, { error: { message: 'catálogo indisponível', type: 'server' } })
  }

  // 2. O plano cobre esse tier? `getEntitlements` degrada para Free em qualquer
  //    falha, então a direção do erro é sempre "menos recursos".
  const ent = await getEntitlements(userId)
  if (!ent.features.skillsCatalog || !ent.features.skillTiers.includes(tier)) {
    return json(403, {
      error: {
        message: 'esta skill faz parte de um plano superior',
        type: 'plan',
        plan: ent.planId,
        tier,
      },
    })
  }

  // 3. Só agora a URL é assinada — pela service role, não pelo token do usuário.
  try {
    const res = await rest(`/storage/v1/object/sign/skills/${encodeURIComponent(storagePath)}`, {
      method: 'POST',
      body: JSON.stringify({ expiresIn: URL_TTL_SECONDS }),
    })
    if (!res.ok) throw new Error(`sign falhou (${res.status})`)
    const body = (await res.json()) as { signedURL?: string }
    if (!body.signedURL) throw new Error('resposta sem signedURL')
    // O Storage devolve caminho relativo ("/object/sign/..."); o app precisa do
    // absoluto para baixar.
    const url = `${SUPABASE_URL}/storage/v1${body.signedURL.replace(/^\/+/, '/')}`
    return json(200, { url, expiresIn: URL_TTL_SECONDS })
  } catch (e) {
    console.error('[skills/download] assinatura:', (e as Error).message)
    return json(503, { error: { message: 'não foi possível gerar o link', type: 'server' } })
  }
}
