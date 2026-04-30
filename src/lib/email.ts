import { Resend } from "resend";

const FROM_FALLBACK = "MedQuiz <onboarding@resend.dev>";

export async function sendMagicLink(email: string, verifyUrl: string): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.RESEND_FROM ?? FROM_FALLBACK;

  if (!apiKey) {
    console.log("");
    console.log("================ MAGIC LINK (dev mode, no RESEND_API_KEY) ================");
    console.log(`  To:   ${email}`);
    console.log(`  Link: ${verifyUrl}`);
    console.log("==========================================================================");
    console.log("");
    return;
  }

  const resend = new Resend(apiKey);
  const { error } = await resend.emails.send({
    from,
    to: email,
    subject: "Your MedQuiz sign-in link",
    html: buildHtml(verifyUrl),
    text: buildText(verifyUrl),
  });

  if (error) {
    console.error("Resend error:", error);
    throw new Error(`Failed to send email: ${error.message}`);
  }
}

function buildText(url: string): string {
  return [
    "Hi!",
    "",
    "Click the link below to sign in to MedQuiz:",
    url,
    "",
    "This link expires in 15 minutes.",
    "If you didn't request this, you can ignore this email.",
  ].join("\n");
}

function buildHtml(url: string): string {
  return `<!doctype html>
<html><body style="font-family: -apple-system, Helvetica, Arial, sans-serif; max-width: 520px; margin: 0 auto; padding: 32px; color: #1a1d24; background: #faf7f2;">
  <h1 style="font-family: Georgia, serif; font-size: 28px; margin: 0 0 24px;">Sign in to MedQuiz</h1>
  <p style="font-size: 15px; line-height: 1.6; margin: 0 0 24px;">
    Click the button below to sign in. This link expires in 15 minutes.
  </p>
  <p style="margin: 0 0 32px;">
    <a href="${url}" style="display: inline-block; background: #1e6f5c; color: white; text-decoration: none; padding: 12px 24px; border-radius: 8px; font-weight: 500;">Sign in</a>
  </p>
  <p style="font-size: 13px; color: #6b7280; line-height: 1.5; margin: 0;">
    If the button doesn't work, copy and paste this URL into your browser:<br>
    <span style="word-break: break-all;">${url}</span>
  </p>
  <p style="font-size: 12px; color: #9ca3af; margin-top: 32px;">
    If you didn't request this, you can ignore this email.
  </p>
</body></html>`;
}
