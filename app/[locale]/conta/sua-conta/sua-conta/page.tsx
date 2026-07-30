import { ProfileForm } from '@/components/conta/profile-form'
import { SecurityForm } from '@/components/conta/security-form'

export default function SuaContaPage(): React.JSX.Element {
  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-5">
      <ProfileForm />
      <SecurityForm />
    </div>
  )
}
