import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { Sidebar } from '@/components/Sidebar'
import { ImmersiveLayoutWrapper } from '@/components/ImmersiveLayoutWrapper'

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
    <ImmersiveLayoutWrapper sidebar={<Sidebar user={user} />}>
      {children}
    </ImmersiveLayoutWrapper>
  )
}
