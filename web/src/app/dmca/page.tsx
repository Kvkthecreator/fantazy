import Link from "next/link";

export default function DMCAPage() {
  return (
    <div className="mx-auto max-w-3xl px-6 py-12 text-sm text-foreground">
      <h1 className="text-2xl font-semibold tracking-tight">DMCA Policy</h1>
      <p className="mt-4 text-muted-foreground">
        ep-0 respects the intellectual property rights of others and expects our users to do the same.
        In accordance with the Digital Millennium Copyright Act (DMCA), we will respond promptly to
        claims of copyright infringement on our service.
      </p>

      <h2 className="mt-8 text-lg font-medium">Filing a DMCA Takedown Notice</h2>
      <p className="mt-4 text-muted-foreground">
        If you believe that content on ep-0 infringes your copyright, please send a written notice to
        our designated DMCA agent with the following information:
      </p>
      <ol className="mt-4 list-decimal space-y-2 pl-5 text-muted-foreground">
        <li>
          A physical or electronic signature of the copyright owner or a person authorized to act on
          their behalf.
        </li>
        <li>
          Identification of the copyrighted work claimed to have been infringed (e.g., a link to your
          original work).
        </li>
        <li>
          Identification of the material that is claimed to be infringing, including a URL or other
          specific location on our service where the material can be found.
        </li>
        <li>Your contact information, including address, telephone number, and email address.</li>
        <li>
          A statement that you have a good faith belief that the use of the material is not authorized
          by the copyright owner, its agent, or the law.
        </li>
        <li>
          A statement, made under penalty of perjury, that the information in your notice is accurate
          and that you are the copyright owner or authorized to act on the copyright owner&apos;s behalf.
        </li>
      </ol>

      <h2 className="mt-8 text-lg font-medium">DMCA Agent Contact</h2>
      <p className="mt-4 text-muted-foreground">
        Send your DMCA takedown notice to:
      </p>
      <div className="mt-4 rounded-lg border border-border bg-muted/30 p-4 text-muted-foreground">
        <p>
          <strong>Email:</strong> dmca@fantazy.app
        </p>
        <p className="mt-2">
          <strong>Subject line:</strong> DMCA Takedown Notice
        </p>
      </div>

      <h2 className="mt-8 text-lg font-medium">Counter-Notification</h2>
      <p className="mt-4 text-muted-foreground">
        If you believe your content was removed in error or that you have the right to use the material,
        you may submit a counter-notification. Your counter-notification must include:
      </p>
      <ol className="mt-4 list-decimal space-y-2 pl-5 text-muted-foreground">
        <li>Your physical or electronic signature.</li>
        <li>
          Identification of the material that was removed and the location where it appeared before
          removal.
        </li>
        <li>
          A statement under penalty of perjury that you have a good faith belief that the material was
          removed as a result of mistake or misidentification.
        </li>
        <li>Your name, address, and telephone number.</li>
        <li>
          A statement that you consent to the jurisdiction of the federal court in your district and
          that you will accept service of process from the person who submitted the original takedown
          notice.
        </li>
      </ol>
      <p className="mt-4 text-muted-foreground">
        Upon receiving a valid counter-notification, we may restore the removed content within 10-14
        business days unless the original complainant notifies us that they have filed a court action.
      </p>

      <h2 className="mt-8 text-lg font-medium">Repeat Infringers</h2>
      <p className="mt-4 text-muted-foreground">
        We maintain a policy of terminating accounts of users who are repeat infringers of copyright
        in appropriate circumstances.
      </p>

      <h2 className="mt-8 text-lg font-medium">Questions</h2>
      <p className="mt-4 text-muted-foreground">
        For general questions about our policies, please contact us at support@fantazy.app or see our{" "}
        <Link href="/terms" className="text-primary underline underline-offset-2 hover:text-primary/80">
          Terms of Service
        </Link>
        .
      </p>
    </div>
  );
}
