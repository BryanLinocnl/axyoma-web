import { verifyUserWithEmail } from '@/lib/auth'
import { isAdminEmail } from '@/lib/admin'

// Único propósito: dizer ao cliente se o usuário logado é admin, pra
// mostrar/esconder o item "Dev" na sidebar. Não expõe nenhum dado.
export const runtime = 'edge'

export async function GET(req: Request): Promise<Response> {
  try {
    const { email } = await verifyUserWithEmail(req.headers.get('authorization'))
    return Response.json({ isAdmin: isAdminEmail(email) })
  } catch {
    return Response.json({ isAdmin: false })
  }
}
