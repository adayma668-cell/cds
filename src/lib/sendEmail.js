import sgMail from "@sendgrid/mail";

function getSgMail() {
  sgMail.setApiKey(process.env.SENDGRID_API_KEY || "");
  return sgMail;
}

export async function sendInviteEmail({ to, name, inviteLink }) {
  const appName = "cSU — Continuous Status Updates";
  const firstName = name ? name.split(" ")[0] : "there";

  const msg = {
    to,
    from: {
      email: process.env.SENDGRID_FROM_EMAIL || "noreply@example.com",
      name: "cSU by xLM",
    },
    subject: `You've been invited to ${appName}`,
    html: `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 520px; margin: 0 auto; padding: 40px 24px;">
        <div style="text-align: center; margin-bottom: 32px;">
          <h1 style="font-size: 24px; font-weight: 700; color: #1a2332; margin: 0 0 4px 0;">
            <span style="color: #06c286;">c</span><span style="color: #003296;">SU</span>
          </h1>
          <p style="color: #5f7a6e; font-size: 12px; margin: 0; letter-spacing: 0.5px;">Continuous Status Updates</p>
        </div>
        <div style="background: #ffffff; border: 1px solid #d4e4dc; border-radius: 16px; padding: 32px; text-align: center;">
          <h2 style="font-size: 20px; font-weight: 700; color: #1a2332; margin: 0 0 12px 0;">
            Hi ${firstName}! 👋
          </h2>
          <p style="color: #5f7a6e; font-size: 14px; line-height: 1.6; margin: 0 0 28px 0;">
            You've been invited to join the team on <strong>cSU</strong>. Click the button below to set your password and get started.
          </p>
          <a href="${inviteLink}" style="display: inline-block; background: linear-gradient(135deg, #06c286, #003296); color: #ffffff; text-decoration: none; font-weight: 600; font-size: 14px; padding: 14px 32px; border-radius: 12px; letter-spacing: 0.3px;">
            Set Your Password
          </a>
          <p style="color: #5f7a6e; font-size: 12px; margin: 24px 0 0 0; line-height: 1.5;">
            This link will expire in 24 hours.<br/>
            If you didn't expect this invitation, you can safely ignore this email.
          </p>
        </div>
        <p style="color: #5f7a6e; font-size: 11px; text-align: center; margin-top: 24px;">
          Sent by cSU by xLM
        </p>
      </div>
    `,
  };

  await getSgMail().send(msg);
}
