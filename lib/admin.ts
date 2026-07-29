// Gate do painel developer.
//
// DUAS CAMADAS, de propósito.
//
//   ADMIN_EMAILS (env)   CONCESSÃO. Ninguém vira developer sem estar aqui, e
//                        mexer nisso exige acesso ao projeto na Vercel — não
//                        basta um UPDATE no banco.
//   profiles.role        ESPELHO, sincronizado a partir da env. É o que o SQL
//                        enxerga: bypass de cobrança, RLS de tabelas internas e
//                        qualquer relatório precisam do papel DENTRO do banco,
//                        e SQL não lê variável de ambiente.
//
// A env sozinha não bastava (o banco não a vê); a tabela sozinha seria uma
// superfície a mais de escrita. Juntas, a concessão continua fora do alcance de
// quem só tem o banco, e o papel fica disponível onde precisa ser aplicado.
//
// A escrita do espelho é só da service role: a policy `profiles_update_own`
// deixaria o próprio usuário escrever `role`, e é o trigger
// `profiles_protect_role` (migration 20260729) que fecha isso.

function adminEmails(): string[] {
  return (process.env.ADMIN_EMAILS ?? '')
    .split(',')
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean)
}

/** A env concede? É a fonte da verdade sobre QUEM pode ser developer. */
export function isAdminEmail(email: string | null): boolean {
  if (!email) return false
  return adminEmails().includes(email.toLowerCase())
}

export type Papel = 'user' | 'developer'

export function papelDoEmail(email: string | null): Papel {
  return isAdminEmail(email) ? 'developer' : 'user'
}

/**
 * Sincroniza `profiles.role` com o que a env diz, e devolve o papel efetivo.
 *
 * Roda no login. Só escreve quando há divergência: um UPDATE por carregamento
 * de página, para todo usuário, seria escrita à toa numa coluna que muda uma
 * vez por ano.
 *
 * REVOGA também, não só concede. Tirar um e-mail do `ADMIN_EMAILS` tem que
 * derrubar o acesso no próximo login — um espelho que só cresce deixaria
 * ex-membros da equipe com as páginas internas para sempre.
 *
 * Falha de rede não barra o login: o papel volta como o da env e a próxima
 * tentativa reconcilia. Nesse intervalo o banco fica um ciclo atrás, e é por
 * isso que a decisão de EXIBIR usa a env, não a tabela.
 */
export async function sincronizarPapel(
  userId: string,
  email: string | null,
  supabaseUrl: string,
  serviceRoleKey: string,
): Promise<Papel> {
  const papel = papelDoEmail(email)
  try {
    const base = `${supabaseUrl}/rest/v1/profiles?id=eq.${userId}`
    const headers = {
      apikey: serviceRoleKey,
      Authorization: `Bearer ${serviceRoleKey}`,
      'Content-Type': 'application/json',
    }

    const atual = await fetch(`${base}&select=role`, { headers })
    if (atual.ok) {
      const linhas = (await atual.json()) as { role?: string }[]
      if (linhas[0]?.role === papel) return papel
    }

    await fetch(base, {
      method: 'PATCH',
      headers: { ...headers, Prefer: 'return=minimal' },
      body: JSON.stringify({ role: papel }),
    })
  } catch (e) {
    console.error('sincronizarPapel falhou:', (e as Error).message)
  }
  return papel
}
