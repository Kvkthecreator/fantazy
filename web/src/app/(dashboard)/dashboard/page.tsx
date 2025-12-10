'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { workspaces, type Workspace } from '@/lib/api'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { ArrowRight, FolderKanban, Library, Shield } from 'lucide-react'

export default function DashboardPage() {
  const [userWorkspaces, setWorkspaces] = useState<Workspace[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const supabase = createClient()

  useEffect(() => {
    async function loadData() {
      try {
        const { data: { session } } = await supabase.auth.getSession()
        if (!session) {
          setError('Not authenticated')
          setIsLoading(false)
          return
        }

        const data = await workspaces.list(session.access_token)
        setWorkspaces(data.workspaces)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load workspaces')
      } finally {
        setIsLoading(false)
      }
    }
    loadData()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div className="space-y-2">
            <Skeleton className="h-8 w-48" />
            <Skeleton className="h-4 w-80" />
          </div>
          <Skeleton className="h-10 w-36" />
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          {[1, 2, 3].map((item) => (
            <Skeleton key={item} className="h-32 rounded-2xl" />
          ))}
        </div>
        <Skeleton className="h-72 rounded-2xl" />
      </div>
    )
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-3">
            <Badge variant="outline">Overview</Badge>
            <p className="text-sm text-muted-foreground">AI-native IP control</p>
          </div>
          <h1 className="mt-2 text-3xl font-bold tracking-tight">Dashboard</h1>
          <p className="text-muted-foreground">
            Manage your catalogs, AI permissions, and licensing in one place.
          </p>
        </div>
        <Button asChild>
          <Link href="/dashboard/workspaces/new">Create workspace</Link>
        </Button>
      </div>

      {error && (
        <Card className="border-destructive/40 bg-destructive/5">
          <CardHeader>
            <CardTitle className="text-destructive">Unable to load data</CardTitle>
            <CardDescription className="text-destructive">
              {error}
            </CardDescription>
          </CardHeader>
        </Card>
      )}

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0">
            <div>
              <CardDescription>Workspaces</CardDescription>
              <CardTitle className="text-3xl">{userWorkspaces.length}</CardTitle>
            </div>
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <FolderKanban className="h-6 w-6" />
            </div>
          </CardHeader>
          <CardContent className="pt-2 text-sm text-muted-foreground">
            Multi-tenant containers with RLS and governance-first controls.
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0">
            <div>
              <CardDescription>Protected assets</CardDescription>
              <CardTitle className="text-3xl">—</CardTitle>
            </div>
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-500">
              <Shield className="h-6 w-6" />
            </div>
          </CardHeader>
          <CardContent className="pt-2 text-sm text-muted-foreground">
            Reference files, embeddings, and semantic metadata coverage.
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0">
            <div>
              <CardDescription>Active licenses</CardDescription>
              <CardTitle className="text-3xl">—</CardTitle>
            </div>
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-indigo-500/10 text-indigo-500">
              <Library className="h-6 w-6" />
            </div>
          </CardHeader>
          <CardContent className="pt-2 text-sm text-muted-foreground">
            Issue grants with AI permission templates and timeline tracking.
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <CardTitle>Your workspaces</CardTitle>
            <CardDescription>Catalogs, rights entities, proposals, and licenses per tenant.</CardDescription>
          </div>
          <Button variant="outline" asChild>
            <Link href="/dashboard/workspaces/new">New workspace</Link>
          </Button>
        </CardHeader>
        {userWorkspaces.length === 0 ? (
          <CardContent className="flex flex-col items-center justify-center gap-3 py-14 text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-muted">
              <FolderKanban className="h-6 w-6 text-muted-foreground" />
            </div>
            <div>
              <p className="text-lg font-semibold">No workspaces yet</p>
              <p className="text-sm text-muted-foreground">
                Create your first workspace to begin onboarding catalogs.
              </p>
            </div>
            <Button asChild>
              <Link href="/dashboard/workspaces/new">
                Create workspace
                <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
          </CardContent>
        ) : (
          <div className="divide-y divide-border">
            {userWorkspaces.map((workspace) => (
              <Link
                key={workspace.id}
                href={`/dashboard/workspaces/${workspace.id}`}
                className="flex items-center justify-between px-6 py-5 transition-colors hover:bg-muted/60"
              >
                <div>
                  <p className="text-base font-semibold">{workspace.name}</p>
                  <p className="text-sm text-muted-foreground">
                    {workspace.description || 'No description yet'}
                  </p>
                </div>
                <ArrowRight className="h-4 w-4 text-muted-foreground" />
              </Link>
            ))}
          </div>
        )}
      </Card>
    </div>
  )
}
