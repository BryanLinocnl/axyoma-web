import { AuthForm } from '@/components/AuthForm'
import { RedirectIfAuthed } from '@/components/RedirectIfAuthed'

export default function SignupPage(): React.JSX.Element {
  return (
    <div className="glass-site">
      <main className="gb-desk flex min-h-screen items-center justify-center px-6 py-12">
        <RedirectIfAuthed>
          <AuthForm initialMode="signup" />
        </RedirectIfAuthed>
      </main>
    </div>
  )
}
