import { AuthForm } from '@/components/AuthForm'

export default function SignupPage(): React.JSX.Element {
  return (
    <div className="glass-site">
      <main className="gb-desk flex min-h-screen items-center justify-center px-6 py-12">
        <AuthForm initialMode="signup" />
      </main>
    </div>
  )
}
