export default function TermsPage() {
  return (
    <div className="mx-auto max-w-3xl px-6 py-12 text-sm text-foreground">
      <h1 className="text-2xl font-semibold tracking-tight">Terms of Service</h1>
      <p className="mt-4 text-muted-foreground">
        These terms outline how you may use ep-0. By signing in and using the service, you agree to abide by
        our acceptable use guidelines and any platform policies that apply.
      </p>
      <ul className="mt-6 list-disc space-y-2 pl-5 text-muted-foreground">
        <li>Use ep-0 for personal, non-commercial purposes unless otherwise approved.</li>
        <li>Do not share harmful, harassing, or illegal content.</li>
        <li>Respect age gates and content safety settings.</li>
        <li>We may update these terms; continued use means you accept the changes.</li>
      </ul>
      <p className="mt-6 text-muted-foreground">
        For questions, contact us at support@fantazy.app.
      </p>
    </div>
  );
}
