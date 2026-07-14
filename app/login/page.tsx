import { AuthForm } from '@/components/AuthForm'

export default function LoginPage(): React.JSX.Element {
  return (
    <main className="flex min-h-screen items-center justify-center bg-neutral-950 px-6 py-12">
      <AuthForm initialMode="signin" />
    </main>
  )
}
