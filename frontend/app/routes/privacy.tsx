export default function PrivacyPage() {
  return (
    <div style={{ maxWidth: 720, margin: "0 auto", padding: "2rem", lineHeight: 1.8 }}>
      <h1 style={{ fontSize: "1.75rem", fontWeight: 700, marginBottom: "1.5rem" }}>Privacy Policy</h1>
      <p style={{ color: "#6b7280", marginBottom: "2rem" }}>Last updated: March 25, 2026</p>

      <Section title="What is RiffNote">
        <p>
          RiffNote is a voice-to-note application. You record audio, and our service uses AI to
          transcribe and restructure your speech into clean, organized text.
        </p>
      </Section>

      <Section title="Information We Collect">
        <ul>
          <li><strong>Account information</strong> — email address and name, provided via our authentication provider (Clerk).</li>
          <li><strong>Audio recordings</strong> — temporarily uploaded for AI processing. See "Audio Data" below.</li>
          <li><strong>Notes</strong> — the structured text generated from your recordings, stored in our database.</li>
        </ul>
      </Section>

      <Section title="Audio Data">
        <p>
          When you record audio, it is sent to our server and forwarded to Google's Gemini API for
          transcription. After processing is complete:
        </p>
        <ul>
          <li>The audio file is <strong>permanently deleted</strong> from our server.</li>
          <li>We do not retain, archive, or back up your audio recordings.</li>
          <li>If processing fails, the audio is kept temporarily to allow you to retry, then deleted once processing succeeds.</li>
        </ul>
      </Section>

      <Section title="Third-Party Services">
        <p>We use the following third-party services to operate RiffNote:</p>
        <ul>
          <li><strong>Clerk</strong> (clerk.com) — authentication and user management.</li>
          <li><strong>Google Gemini API</strong> — audio transcription and text processing. Google's API terms state that data sent via the paid API is not used to train their models.</li>
          <li><strong>Cloudflare</strong> — frontend hosting and CDN.</li>
          <li><strong>Amazon Web Services</strong> — backend server hosting.</li>
        </ul>
        <p>Each service is subject to its own privacy policy.</p>
      </Section>

      <Section title="Data Storage & Security">
        <ul>
          <li>Your notes are stored in a PostgreSQL database on our server.</li>
          <li>All data is transmitted over HTTPS (TLS encryption).</li>
          <li>We do not sell, share, or provide your data to any third parties beyond the services listed above.</li>
        </ul>
      </Section>

      <Section title="Data Retention">
        <ul>
          <li>Your notes are kept as long as your account exists.</li>
          <li>You can delete individual notes or your entire account at any time.</li>
          <li>Audio recordings are deleted immediately after successful processing.</li>
        </ul>
      </Section>

      <Section title="Your Rights">
        <p>You may:</p>
        <ul>
          <li>Access, edit, or delete your notes at any time through the app.</li>
          <li>Request deletion of your account and all associated data by contacting us.</li>
        </ul>
      </Section>

      <Section title="Contact">
        <p>
          For privacy-related questions, please contact us at{" "}
          <a href="mailto:privacy@riffnote.app" style={{ color: "#2563eb" }}>privacy@riffnote.app</a>.
        </p>
      </Section>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section style={{ marginBottom: "1.5rem" }}>
      <h2 style={{ fontSize: "1.2rem", fontWeight: 600, marginBottom: "0.5rem" }}>{title}</h2>
      <div style={{ color: "#374151" }}>{children}</div>
    </section>
  );
}
