#!/usr/bin/env node
/**
 * Verifica se as traduções estão completas.
 *
 * POR QUE ISTO EXISTE. O modo mais comum de um app multilíngue virar um app
 * bilíngue quebrado não é alguém traduzir mal — é alguém acrescentar uma string
 * no idioma base e esquecer do outro. A tela então mostra a chave crua
 * (`config.language.title`) ou cai no português no meio de uma interface em
 * inglês, e ninguém percebe até um usuário reclamar. Falha de tradução é
 * silenciosa por natureza; só um verificador a torna barulhenta.
 *
 * Compara o idioma BASE com cada outro e falha quando:
 *   • falta chave      → a tela vai mostrar a chave crua ou o texto do base;
 *   • sobra chave      → tradução de algo que não existe mais (lixo que cresce);
 *   • valor vazio      → pior que faltar, porque passa despercebido na tela.
 *
 * Uso: node scripts/check-i18n.mjs <pasta-dos-json> [idioma-base]
 * Sem os arquivos, PASSA — o projeto pode ainda não ter i18n, e o CI não deve
 * quebrar por causa de uma etapa que ainda não chegou.
 */

import { readFileSync, existsSync, readdirSync } from 'node:fs'
import { join } from 'node:path'

const pasta = process.argv[2]
const base = process.argv[3] ?? 'pt-BR'

if (!pasta || !existsSync(pasta)) {
  console.log(`i18n: ${pasta ?? '(sem pasta)'} não existe — nada a verificar.`)
  process.exit(0)
}

const arquivos = readdirSync(pasta).filter((f) => f.endsWith('.json'))
if (arquivos.length < 2) {
  console.log(`i18n: ${arquivos.length} catálogo(s) em ${pasta} — nada a comparar.`)
  process.exit(0)
}

/** Achata `{a:{b:'x'}}` em `{'a.b':'x'}` para comparar chave a chave. */
function achatar(obj, prefixo = '', saida = {}) {
  for (const [k, v] of Object.entries(obj)) {
    const chave = prefixo ? `${prefixo}.${k}` : k
    if (v && typeof v === 'object' && !Array.isArray(v)) achatar(v, chave, saida)
    else saida[chave] = v
  }
  return saida
}

function carregar(nome) {
  try {
    return achatar(JSON.parse(readFileSync(join(pasta, nome), 'utf8')))
  } catch (e) {
    console.error(`i18n: ${nome} não é JSON válido — ${e.message}`)
    process.exit(1)
  }
}

const arquivoBase = `${base}.json`
if (!arquivos.includes(arquivoBase)) {
  console.error(`i18n: idioma base ${arquivoBase} não encontrado em ${pasta}`)
  process.exit(1)
}

const chavesBase = carregar(arquivoBase)
const totalBase = Object.keys(chavesBase).length
let falhou = false

for (const arq of arquivos) {
  if (arq === arquivoBase) continue
  const idioma = arq.replace(/\.json$/, '')
  const alvo = carregar(arq)

  const faltando = Object.keys(chavesBase).filter((k) => !(k in alvo))
  const sobrando = Object.keys(alvo).filter((k) => !(k in chavesBase))
  // Vazio é pior que faltar: não aparece como chave crua na tela, aparece como
  // espaço em branco, e ninguém abre um bug para um rótulo que sumiu.
  const vazias = Object.keys(alvo).filter((k) => alvo[k] === '' || alvo[k] == null)

  if (faltando.length || sobrando.length || vazias.length) {
    falhou = true
    console.error(`\n✗ ${idioma} (${Object.keys(alvo).length}/${totalBase} chaves)`)
    const listar = (rotulo, lista) => {
      if (!lista.length) return
      console.error(`   ${rotulo}: ${lista.length}`)
      // Só as primeiras: uma lista de 300 chaves no log do CI não ajuda ninguém
      // a achar o problema, e esconde o resumo.
      for (const k of lista.slice(0, 15)) console.error(`     ${k}`)
      if (lista.length > 15) console.error(`     … e mais ${lista.length - 15}`)
    }
    listar('faltando', faltando)
    listar('sobrando (não existe no base)', sobrando)
    listar('valor vazio', vazias)
  } else {
    console.log(`✓ ${idioma} — ${totalBase} chaves, completo`)
  }
}

if (falhou) {
  console.error('\ni18n: tradução incompleta. Toda chave do idioma base precisa existir e ter valor nos demais.')
  process.exit(1)
}
console.log(`\ni18n: ${arquivos.length} idiomas, ${totalBase} chaves, tudo completo.`)
