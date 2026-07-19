'use client'

import Link from 'next/link'
import { KeyRound } from 'lucide-react'
import { Card } from '@/components/ui/card'
import { buttonVariants } from '@/components/ui/button'
import { cn } from '@/lib/utils'

// Senha: fluxo padrão de recuperação por e-mail. O usuário vai para
// /recuperar-senha, informa o e-mail e recebe um link de redefinição.
export function SecurityForm(): React.JSX.Element {
  return (
    <Card className="p-6">
      <div className="mb-3 flex items-center gap-2 text-sm font-semibold">
        <KeyRound className="text-muted-foreground size-4" /> Senha
      </div>
      <p className="text-muted-foreground mb-4 text-sm">
        Para trocar sua senha, você recebe um link de redefinição no seu e-mail.
      </p>
      <Link href="/recuperar-senha" className={cn(buttonVariants())}>
        Trocar senha
      </Link>
    </Card>
  )
}
