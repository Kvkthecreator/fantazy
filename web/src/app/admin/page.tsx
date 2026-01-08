'use client'

import { useEffect, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { api } from '@/lib/api/client'
import type { AdminStatsResponse, AdminUserEngagement, AdminSignupDay } from '@/types'
import { Users, DollarSign, MessageSquare, Sparkles, TrendingUp, Calendar } from 'lucide-react'

function formatCurrency(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`
}

function formatDate(dateStr: string): string {
  const date = new Date(dateStr)
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

function formatDateTime(dateStr: string): string {
  const date = new Date(dateStr)
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit'
  })
}

function SimpleBarChart({ data }: { data: AdminSignupDay[] }) {
  if (data.length === 0) {
    return <div className="text-muted-foreground text-sm">No signup data yet</div>
  }

  const maxCount = Math.max(...data.map(d => d.count), 1)

  return (
    <div className="flex items-end gap-1 h-32">
      {data.map((day, i) => (
        <div key={i} className="flex-1 flex flex-col items-center gap-1">
          <div
            className="w-full bg-primary/80 rounded-t min-h-[4px] transition-all"
            style={{ height: `${(day.count / maxCount) * 100}%` }}
            title={`${day.date}: ${day.count} signups`}
          />
          <span className="text-[10px] text-muted-foreground rotate-45 origin-left whitespace-nowrap">
            {formatDate(day.date)}
          </span>
        </div>
      ))}
    </div>
  )
}

export default function AdminPage() {
  const [stats, setStats] = useState<AdminStatsResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetchStats()
  }, [])

  const fetchStats = async () => {
    try {
      setLoading(true)
      setError(null)
      const data = await api.admin.stats()
      setStats(data)
    } catch (err) {
      console.error('Failed to fetch admin stats:', err)
      setError(err instanceof Error ? err.message : 'Failed to load stats')
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="space-y-8">
        <div>
          <p className="text-sm font-medium uppercase tracking-wide text-muted-foreground">Admin</p>
          <h1 className="mt-2 text-3xl font-semibold">Analytics Dashboard</h1>
        </div>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {[1, 2, 3, 4].map(i => (
            <Card key={i}>
              <CardHeader className="pb-2">
                <Skeleton className="h-4 w-24" />
              </CardHeader>
              <CardContent>
                <Skeleton className="h-8 w-16" />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="space-y-8">
        <div>
          <p className="text-sm font-medium uppercase tracking-wide text-muted-foreground">Admin</p>
          <h1 className="mt-2 text-3xl font-semibold">Analytics Dashboard</h1>
        </div>
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-destructive">{error}</p>
            <button
              onClick={fetchStats}
              className="mt-4 text-sm text-primary hover:underline"
            >
              Try again
            </button>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (!stats) return null

  const { overview, signups_by_day, users, purchases } = stats

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <p className="text-sm font-medium uppercase tracking-wide text-muted-foreground">Admin</p>
        <h1 className="mt-2 text-3xl font-semibold">Analytics Dashboard</h1>
        <p className="mt-2 text-muted-foreground">
          Product metrics and user engagement
        </p>
      </div>

      {/* Overview Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Users</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{overview.total_users}</div>
            <p className="text-xs text-muted-foreground">
              +{overview.users_7d} this week
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Premium Users</CardTitle>
            <Sparkles className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{overview.premium_users}</div>
            <p className="text-xs text-muted-foreground">
              {overview.total_users > 0
                ? `${((overview.premium_users / overview.total_users) * 100).toFixed(1)}% conversion`
                : '0% conversion'}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Revenue</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(overview.total_revenue_cents)}</div>
            <p className="text-xs text-muted-foreground">
              From top-up purchases
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Messages</CardTitle>
            <MessageSquare className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{overview.total_messages.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">
              {overview.total_sessions} sessions
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Signup Trends */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-4 w-4" />
            Signups (Last 30 Days)
          </CardTitle>
        </CardHeader>
        <CardContent>
          <SimpleBarChart data={signups_by_day} />
        </CardContent>
      </Card>

      {/* Users Table */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-4 w-4" />
            User Engagement
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-2 px-2 font-medium">User</th>
                  <th className="text-left py-2 px-2 font-medium">Status</th>
                  <th className="text-right py-2 px-2 font-medium">Messages</th>
                  <th className="text-right py-2 px-2 font-medium">Images</th>
                  <th className="text-right py-2 px-2 font-medium">Sparks</th>
                  <th className="text-right py-2 px-2 font-medium">Sessions</th>
                  <th className="text-left py-2 px-2 font-medium">Signed Up</th>
                  <th className="text-left py-2 px-2 font-medium">Last Active</th>
                </tr>
              </thead>
              <tbody>
                {users.map((user) => (
                  <tr key={user.id} className="border-b border-border/50 hover:bg-muted/50">
                    <td className="py-2 px-2">
                      <div className="font-medium">{user.display_name}</div>
                    </td>
                    <td className="py-2 px-2">
                      <Badge variant={user.subscription_status === 'premium' ? 'default' : 'secondary'}>
                        {user.subscription_status}
                      </Badge>
                    </td>
                    <td className="text-right py-2 px-2 tabular-nums">
                      {user.messages_sent_count}
                    </td>
                    <td className="text-right py-2 px-2 tabular-nums">
                      {user.flux_generations_used}
                    </td>
                    <td className="text-right py-2 px-2 tabular-nums">
                      {user.spark_balance}
                    </td>
                    <td className="text-right py-2 px-2 tabular-nums">
                      {user.session_count}
                    </td>
                    <td className="py-2 px-2 text-muted-foreground">
                      {formatDate(user.created_at)}
                    </td>
                    <td className="py-2 px-2 text-muted-foreground">
                      {user.last_active ? formatDateTime(user.last_active) : '-'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Recent Purchases */}
      {purchases.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <DollarSign className="h-4 w-4" />
              Recent Purchases
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-2 px-2 font-medium">User</th>
                    <th className="text-left py-2 px-2 font-medium">Pack</th>
                    <th className="text-right py-2 px-2 font-medium">Sparks</th>
                    <th className="text-right py-2 px-2 font-medium">Amount</th>
                    <th className="text-left py-2 px-2 font-medium">Status</th>
                    <th className="text-left py-2 px-2 font-medium">Date</th>
                  </tr>
                </thead>
                <tbody>
                  {purchases.map((purchase) => (
                    <tr key={purchase.id} className="border-b border-border/50 hover:bg-muted/50">
                      <td className="py-2 px-2">{purchase.user_name}</td>
                      <td className="py-2 px-2 capitalize">{purchase.pack_name.replace('_', ' ')}</td>
                      <td className="text-right py-2 px-2 tabular-nums">{purchase.sparks_amount}</td>
                      <td className="text-right py-2 px-2 tabular-nums">{formatCurrency(purchase.price_cents)}</td>
                      <td className="py-2 px-2">
                        <Badge variant={purchase.status === 'completed' ? 'default' : 'secondary'}>
                          {purchase.status}
                        </Badge>
                      </td>
                      <td className="py-2 px-2 text-muted-foreground">
                        {formatDateTime(purchase.created_at)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
