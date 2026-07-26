// BYOK — chave do PRÓPRIO usuário, trafegando por header a cada requisição.
//
// MODELO DE CUSTÓDIA: a chave mora na máquina do usuário (cifrada pelo keychain
// do SO, ver `secret-store` no desktop). O servidor a recebe no header, usa em
// memória e descarta. NÃO é gravada em lugar nenhum — nem banco, nem Vault, nem
// cache, nem KV. Guardar chave alheia nos tornaria custodiantes: um vazamento
// nosso viraria dinheiro do usuário, e é um dado que não precisamos ter.
//
// O que sobra de risco é o TRÂNSITO — e o risco real do trânsito não é o fio
// (HTTPS resolve), é o nosso próprio log. Daí o `scrubSecret` aqui embaixo, e a
// regra: nenhuma string derivada da requisição BYOK vai para `console.*` ou para
// o corpo de resposta sem passar por ele.

/** Header que carrega a chave do usuário. Minúsculo — `Headers` é case-insensitive. */
export const PROVIDER_KEY_HEADER = 'x-axyoma-provider-key'

/**
 * Formato aceito. Deliberadamente FROUXO em relação ao prefixo (`sk-or-v1-…`
 * hoje, mas o fornecedor pode mudar) e ESTRITO quanto ao que pode entrar num
 * header: sem espaço, sem controle, tamanho limitado.
 *
 * A validação não é sobre "é uma chave válida" — só a OpenRouter sabe disso. É
 * sobre não repassar lixo adiante e não deixar um header malformado virar
 * qualquer outra coisa no caminho.
 */
const SHAPE = /^[A-Za-z0-9_\-.]{20,300}$/

/**
 * Lê a chave BYOK do request. `null` = ausente ou malformada — nos dois casos a
 * requisição segue como não-BYOK (créditos AXYOMA), nunca como erro silencioso
 * de autenticação no upstream.
 */
export function readProviderKey(req: Request): string | null {
  const raw = req.headers.get(PROVIDER_KEY_HEADER)
  if (!raw) return null
  const key = raw.trim()
  return SHAPE.test(key) ? key : null
}

/**
 * Remove segredos de um texto ANTES de logar ou devolver ao cliente.
 *
 * Duas camadas de propósito:
 *  1. o valor exato que recebemos nesta requisição (o caso que importa);
 *  2. qualquer coisa com cara de chave (`sk-…`), que cobre o caso de o upstream
 *     ecoar de volta uma credencial que não é a que estamos segurando.
 *
 * A camada 2 sozinha não bastaria (uma chave sem o prefixo `sk-` passaria) e a
 * camada 1 sozinha também não (o upstream pode ecoar outra coisa). Juntas, o
 * caminho de erro deixa de ser um vazamento em potencial.
 */
export function scrubSecret(text: string, secret?: string | null): string {
  if (!text) return text
  let out = text
  if (secret && secret.length >= 8) out = out.split(secret).join('[REDACTED]')
  return out.replace(/\bsk-[A-Za-z0-9_\-.]{8,}/g, 'sk-[REDACTED]')
}
