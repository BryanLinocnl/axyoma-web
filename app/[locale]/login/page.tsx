import type { Metadata } from 'next'
import { setRequestLocale } from 'next-intl/server'
import { AuthForm } from '@/components/AuthForm'
import { RedirectIfAuthed } from '@/components/RedirectIfAuthed'
import { alternatesFor } from '@/i18n/alternates'
import type { Locale } from '@/i18n/routing'

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: Locale }>
}): Promise<Metadata> {
  const { locale } = await params
  return { alternates: alternatesFor('/login', locale) }
}

export default async function LoginPage({
  params,
}: {
  params: Promise<{ locale: Locale }>
}): Promise<React.JSX.Element> {
  const { locale } = await params
  setRequestLocale(locale)

  return (
    <div className="glass-site">
      <main className="gb-desk flex min-h-screen items-center justify-center px-6 py-12">
        <RedirectIfAuthed>
          <AuthForm initialMode="signin" />
        </RedirectIfAuthed>
      </main>
    </div>
  )
}
