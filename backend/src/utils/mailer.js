const nodemailer = require('nodemailer');

// Reads SMTP settings from .env. If they're not configured, emails are
// skipped (logged to the console) instead of crashing account creation —
// so setting up email is opt-in, not a hard requirement to run the app.
function getTransport() {
  const { SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS } = process.env;
  if (!SMTP_HOST || !SMTP_USER || !SMTP_PASS) return null;
  return nodemailer.createTransport({
    host: SMTP_HOST,
    port: Number(SMTP_PORT || 587),
    secure: Number(SMTP_PORT) === 465,
    auth: { user: SMTP_USER, pass: SMTP_PASS },
  });
}

/**
 * Emails a newly created (or reset) staff account their login credentials.
 * Never throws — a delivery failure is logged but must never block account
 * creation or a password reset from succeeding.
 */
async function sendCredentialsEmail({ to, name, email, password, role, isReset = false }) {
  const transport = getTransport();
  const loginUrl = process.env.APP_URL || 'http://localhost:3000/login';
  const roleLabel = role.charAt(0).toUpperCase() + role.slice(1);
  const subject = isReset ? 'Your Serene Spa password has been reset' : 'Your Serene Spa account is ready';
  const intro = isReset
    ? `Your password for Serene Spa has been reset by an administrator.`
    : `An administrator has created a Serene Spa account for you.`;

  const text = `Hi ${name},

${intro}

Role: ${roleLabel}
Login email: ${email}
Temporary password: ${password}

Sign in here: ${loginUrl}

For security, please sign in and change this password as soon as you can.

— Serene Spa`;

  const html = `
    <div style="font-family: Georgia, serif; color: #152625; max-width: 480px;">
      <p>Hi ${name},</p>
      <p>${intro}</p>
      <table style="margin: 16px 0; font-size: 14px;">
        <tr><td style="padding: 4px 12px 4px 0; color: #4f6b62;">Role</td><td><strong>${roleLabel}</strong></td></tr>
        <tr><td style="padding: 4px 12px 4px 0; color: #4f6b62;">Login email</td><td><strong>${email}</strong></td></tr>
        <tr><td style="padding: 4px 12px 4px 0; color: #4f6b62;">Temporary password</td><td><strong>${password}</strong></td></tr>
      </table>
      <p><a href="${loginUrl}" style="background:#122f27;color:#fdfcf9;padding:10px 18px;border-radius:6px;text-decoration:none;">Sign in</a></p>
      <p style="font-size: 13px; color: #4f6b62;">For security, please sign in and change this password as soon as you can.</p>
      <p style="font-size: 13px; color: #4f6b62;">— Serene Spa</p>
    </div>`;

  if (!transport) {
    console.warn(`[mailer] SMTP not configured — skipping credentials email to ${to}. Set SMTP_HOST/SMTP_USER/SMTP_PASS in .env to enable it.`);
    return { sent: false };
  }

  try {
    await transport.sendMail({
      from: process.env.SMTP_FROM || process.env.SMTP_USER,
      to,
      subject,
      text,
      html,
    });
    return { sent: true };
  } catch (err) {
    console.error('[mailer] Failed to send credentials email:', err.message);
    return { sent: false, error: err.message };
  }
}

module.exports = { sendCredentialsEmail };
