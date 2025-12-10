import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { Sidebar } from '@/components/Sidebar'

export const dynamic = 'force-dynamic'

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  return (
    <div className="flex min-h-screen bg-background text-foreground">
      <Sidebar user={user} />
      <main className="flex-1 overflow-y-auto px-6 py-8 lg:px-10">
        <div className="mx-auto max-w-6xl space-y-8">{children}</div>
      </main>
    </div>
  )
}
