// Gate de acesso ao painel developer. Lista fechada por e-mail — sem tabela de
// roles ainda (poucos admins, mudar via env é suficiente por ora).

function adminEmails(): string[] {
  return (process.env.ADMIN_EMAILS ?? '')
    .split(',')
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean)
}

export function isAdminEmail(email: string | null): boolean {
  if (!email) return false
  return adminEmails().includes(email.toLowerCase())
}
