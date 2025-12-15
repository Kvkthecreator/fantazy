import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { isInternalEmail } from '@/lib/internal-access'

export const dynamic = 'force-dynamic'

export default async function StudioLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  if (!isInternalEmail(user.email)) {
    redirect('/')
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="mx-auto flex max-w-5xl flex-col gap-8 px-6 py-10">
        {children}
      </div>
    </div>
  )
}
