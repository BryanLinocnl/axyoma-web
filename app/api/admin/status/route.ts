import { verifyUserWithEmail } from '@/lib/auth'
import { isAdminEmail, sincronizarPapel } from '@/lib/admin'

// Diz ao cliente se o usuário é developer, para mostrar/esconder o item "Dev" na
// sidebar — e, de passagem, sincroniza `profiles.role` com o que a env concede.
//
// A sincronização vive AQUI porque esta rota já roda uma vez por carregamento da
// conta, com o e-mail verificado em mãos. Um endpoint separado só para isso
// seria mais uma chamada no caminho crítico do login.
//
// O que volta ao cliente é decidido pela ENV, não pela tabela: se a escrita do
// espelho falhar, o acesso não pode ficar preso ao valor velho do banco.
//
// Isto NÃO é o gate. Esconder um item de menu não protege rota nenhuma — quem
// protege é o middleware, e ele checa por conta própria.
export const runtime = 'edge'

export async function GET(req: Request): Promise<Response> {
  try {
    const { userId, email } = await verifyUserWithEmail(req.headers.get('authorization'))
    const url = process.env.SUPABASE_URL
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY
    if (url && key && userId) {
      // Sem `await`: o espelho serve ao SQL depois, e segurar a resposta por
      // causa dele seria pagar latência no login por um efeito que ninguém está
      // esperando aqui.
      void sincronizarPapel(userId, email, url, key)
    }
    return Response.json({ isAdmin: isAdminEmail(email) })
  } catch {
    return Response.json({ isAdmin: false })
  }
}
