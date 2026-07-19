'use client'

import { useEffect, useRef, useState } from 'react'
import { supabase } from '@/lib/supabase-browser'
import { useConta } from '@/lib/conta-context'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

// Página "Sua conta" — coluna única.
//   Card 1 (Perfil): foto (upload) + Nome + E-mail (DESABILITADO — não muda).
//   Card 2 (Empresa e cargo).
//   Botão "Salvar alterações" FORA dos cards (salva tudo de uma vez).
export function ProfileForm(): React.JSX.Element {
  const { userId, name: ctxName, email, reload } = useConta()
  const [name, setName] = useState(ctxName)
  const [company, setCompany] = useState('')
  const [role, setRole] = useState('')
  const [avatarUrl, setAvatarUrl] = useState('')
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [feedback, setFeedback] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!userId) return
    let cancelled = false
    void supabase
      .from('profiles')
      .select('full_name, company, role, avatar_url')
      .eq('id', userId)
      .maybeSingle()
      .then(({ data }) => {
        if (cancelled || !data) return
        const p = data as { full_name?: string; company?: string; role?: string; avatar_url?: string }
        setName(p.full_name ?? ctxName ?? '')
        setCompany(p.company ?? '')
        setRole(p.role ?? '')
        setAvatarUrl(p.avatar_url ?? '')
      })
    return () => {
      cancelled = true
    }
  }, [userId, ctxName])

  async function onPickFile(e: React.ChangeEvent<HTMLInputElement>): Promise<void> {
    const file = e.target.files?.[0]
    if (!file || !userId) return
    setUploading(true)
    setFeedback(null)
    const ext = (file.name.split('.').pop() || 'png').toLowerCase()
    const path = `${userId}/avatar-${Date.now()}.${ext}`
    const { error } = await supabase.storage.from('avatars').upload(path, file, { upsert: true, contentType: file.type })
    if (error) {
      setFeedback({ kind: 'err', text: 'Não foi possível enviar a foto.' })
    } else {
      const { data } = supabase.storage.from('avatars').getPublicUrl(path)
      setAvatarUrl(data.publicUrl)
    }
    setUploading(false)
    if (fileRef.current) fileRef.current.value = ''
  }

  async function save(): Promise<void> {
    if (!userId) return
    setSaving(true)
    setFeedback(null)
    const { error } = await supabase
      .from('profiles')
      .update({
        full_name: name.trim(),
        company: company.trim() || null,
        role: role.trim() || null,
        avatar_url: avatarUrl || null,
      })
      .eq('id', userId)
    setSaving(false)
    if (error) {
      setFeedback({ kind: 'err', text: 'Não foi possível salvar. Tente novamente.' })
      return
    }
    setFeedback({ kind: 'ok', text: 'Alterações salvas.' })
    void reload()
  }

  const initial = (name || email || 'U').trim().charAt(0).toUpperCase()

  return (
    <div className="flex flex-col gap-5">
      {/* Card 1 — Perfil */}
      <Card className="p-6">
        <p className="text-base font-semibold">Perfil</p>
        <p className="text-muted-foreground mt-1 text-sm">Como seu perfil aparece na plataforma.</p>

        <div className="mt-5 flex items-center gap-4">
          <div className="bg-muted size-16 shrink-0 overflow-hidden rounded-full">
            {avatarUrl ? (
              // eslint-disable-next-line @next/next/no-img-element -- avatar remoto; sem next/image
              <img src={avatarUrl} alt="" className="size-full object-cover" />
            ) : (
              <div className="text-muted-foreground flex size-full items-center justify-center text-xl font-medium">
                {initial}
              </div>
            )}
          </div>
          <div>
            <Button type="button" variant="outline" onClick={() => fileRef.current?.click()} disabled={uploading}>
              {uploading ? 'Enviando…' : 'Alterar foto'}
            </Button>
            <input ref={fileRef} type="file" accept="image/*" onChange={onPickFile} className="hidden" />
          </div>
        </div>

        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          <div>
            <Label htmlFor="acc-name" className="mb-2">
              Nome
            </Label>
            <Input id="acc-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Seu nome" />
          </div>
          <div>
            <Label htmlFor="acc-email" className="text-muted-foreground mb-2">
              E-mail <span className="text-muted-foreground/70">· não editável</span>
            </Label>
            <Input id="acc-email" value={email} disabled readOnly />
          </div>
        </div>
      </Card>

      {/* Card 2 — Empresa e cargo */}
      <Card className="p-6">
        <p className="text-base font-semibold">Empresa e cargo</p>
        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          <div>
            <Label htmlFor="acc-company" className="mb-2">
              Empresa
            </Label>
            <Input id="acc-company" value={company} onChange={(e) => setCompany(e.target.value)} placeholder="Nome da empresa" />
          </div>
          <div>
            <Label htmlFor="acc-role" className="mb-2">
              Cargo
            </Label>
            <Input id="acc-role" value={role} onChange={(e) => setRole(e.target.value)} placeholder="Seu cargo" />
          </div>
        </div>
      </Card>

      {/* Botão FORA dos cards — salva tudo. */}
      <div className="flex items-center justify-end gap-3">
        {feedback && (
          <span className={`text-xs ${feedback.kind === 'ok' ? 'text-green-500' : 'text-destructive'}`}>{feedback.text}</span>
        )}
        <Button onClick={save} disabled={saving || uploading}>
          {saving ? 'Salvando…' : 'Salvar alterações'}
        </Button>
      </div>
    </div>
  )
}
