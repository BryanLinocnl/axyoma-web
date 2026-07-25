/// <reference types="next/image-types/global" />

// Declara os módulos de imagem (`import shot from '@/public/app/x.png'`) para o
// TypeScript.
//
// POR QUE ESTE ARQUIVO EXISTE: essa mesma referência vive no `next-env.d.ts`,
// que é GERADO pelo `next build` e está no .gitignore (como no template oficial
// do Next). Num checkout limpo — CI — o type check roda antes de qualquer build
// e o arquivo ainda não existe, então todo import de PNG falha com TS2307. Foi
// exatamente isso que quebrou o workflow de smoke, enquanto localmente passava
// porque builds anteriores já tinham deixado o next-env.d.ts no disco.
//
// Manter a referência num arquivo NOSSO tira a checagem da ordem dos passos do
// CI. Referenciar o mesmo pacote duas vezes é inofensivo: o TypeScript resolve
// cada `types` uma única vez.
