// =============================================================================
// Dados institucionais da empresa — FONTE ÚNICA.
//
// Usado no footer, páginas legais (privacidade/termos) e contato. Google for
// Startups (e qualquer revisor) exige identidade verificável da empresa: razão
// social, CNPJ, contato e domínio próprio. Preencha os campos marcados TODO.
// =============================================================================

export const EMPRESA = {
  // Marca pública.
  nome: 'Axyoma',
  produto: 'Axyoma AI',

  // Domínio de produção (o mesmo submetido ao Google).
  dominio: 'axyoma.ia.br',
  url: 'https://axyoma.ia.br',

  // Razão social do MEI (nome exato como consta no CNPJ).
  razaoSocial: '50.218.594 ABRAAO LYNCONL MARTINS TORQUATO',
  cnpj: '50.218.594/0001-80',
  // Cidade comercial (base atual). Obs: cadastro do MEI ainda consta
  // Juazeiro do Norte/CE — atualizar na Receita quando possível.
  cidade: 'Barueri/SP',

  // Contato público de suporte.
  email: 'contact@axyoma.ia.br',

  // Handles sociais — só liste os que EXISTEM (link morto tira credibilidade).
  // TODO: adicionar Instagram/X reais quando os perfis existirem.
  social: [] as ReadonlyArray<{ href: string; label: string }>,
} as const
