export default function PrivacyPage() {
  return (
    <div className="mx-auto max-w-3xl px-6 py-12 text-sm text-foreground">
      <h1 className="text-2xl font-semibold tracking-tight">Privacy Policy</h1>
      <p className="mt-4 text-muted-foreground">
        We respect your privacy. This page summarizes how ep-0 collects and uses your data.
      </p>
      <ul className="mt-6 list-disc space-y-2 pl-5 text-muted-foreground">
        <li>We collect account info (email, profile details) to provide access.</li>
        <li>Chat content is stored to deliver memory and relationship features.</li>
        <li>We do not sell your data. Limited third-party services are used for auth and infrastructure.</li>
        <li>You can request deletion of your account and associated data by contacting support.</li>
      </ul>
      <p className="mt-6 text-muted-foreground">
        Questions? Reach us at privacy@fantazy.app.
      </p>
    </div>
  );
}
