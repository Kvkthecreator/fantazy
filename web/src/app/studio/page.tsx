import Link from 'next/link'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'

export default function StudioPage() {
  return (
    <div className="space-y-8">
      <div>
        <p className="text-sm font-medium uppercase tracking-wide text-muted-foreground">Studio (internal)</p>
        <h1 className="mt-2 text-3xl font-semibold">Create & iterate privately</h1>
        <p className="mt-2 max-w-2xl text-muted-foreground">
          Build characters, opening beats, and asset packs in a safe sandbox before we open creation publicly.
        </p>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Create Character</CardTitle>
            <CardDescription>
              Guided wizard to capture profile, detailed settings, opening, tags, assets, and review.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex items-center justify-between">
            <div className="space-y-2 text-sm text-muted-foreground">
              <p>• Minimal required fields with helper copy</p>
              <p>• Opening situation + first line required</p>
              <p>• Target: hero avatar + 5–7 expressions + 2 scenes</p>
            </div>
            <Button asChild>
              <Link href="/studio/create">Start wizard</Link>
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Notes</CardTitle>
            <CardDescription>
              Internal-only; locked behind allowlist and Supabase auth. More tools will land here later.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-2 text-sm text-muted-foreground">
            <p>• No production publishing yet—this is a scaffold.</p>
            <p>• Data is shown as JSON in the review step.</p>
            <p>• Add more internal emails via the allowlist env var.</p>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
