import Link from "next/link";

export default function TermsPage() {
  return (
    <div className="mx-auto max-w-3xl px-6 py-12 text-sm text-foreground">
      <h1 className="text-2xl font-semibold tracking-tight">Terms of Service</h1>
      <p className="mt-4 text-muted-foreground">
        These terms outline how you may use ep-0. By signing in and using the service, you agree to abide by
        our acceptable use guidelines and any platform policies that apply.
      </p>

      <h2 className="mt-8 text-lg font-medium">General Use</h2>
      <ul className="mt-4 list-disc space-y-2 pl-5 text-muted-foreground">
        <li>Use ep-0 for personal, non-commercial purposes unless otherwise approved.</li>
        <li>Do not share harmful, harassing, or illegal content.</li>
        <li>Respect age gates and content safety settings.</li>
        <li>We may update these terms; continued use means you accept the changes.</li>
      </ul>

      <h2 className="mt-8 text-lg font-medium">User-Uploaded Content</h2>
      <p className="mt-4 text-muted-foreground">
        When you upload images or other content to ep-0 (such as custom character avatars), you represent and
        warrant that:
      </p>
      <ul className="mt-4 list-disc space-y-2 pl-5 text-muted-foreground">
        <li>You own the content or have obtained all necessary rights, licenses, and permissions to use it.</li>
        <li>Your content does not infringe any third-party intellectual property rights, including copyrights, trademarks, or rights of publicity.</li>
        <li>You accept full responsibility for any claims, damages, or liabilities arising from your uploaded content.</li>
      </ul>
      <p className="mt-4 text-muted-foreground">
        We reserve the right to remove any content that we believe, in our sole discretion, violates these terms
        or any applicable laws. We may also suspend or terminate accounts that repeatedly infringe on the rights of others.
      </p>

      <h2 className="mt-8 text-lg font-medium">DMCA and Copyright</h2>
      <p className="mt-4 text-muted-foreground">
        We respect intellectual property rights and comply with the Digital Millennium Copyright Act (DMCA).
        If you believe that content on ep-0 infringes your copyright, please see our{" "}
        <Link href="/dmca" className="text-primary underline underline-offset-2 hover:text-primary/80">
          DMCA Policy
        </Link>{" "}
        for information on how to submit a takedown notice.
      </p>

      <h2 className="mt-8 text-lg font-medium">Contact</h2>
      <p className="mt-4 text-muted-foreground">
        For questions, contact us at support@fantazy.app.
      </p>
    </div>
  );
}
