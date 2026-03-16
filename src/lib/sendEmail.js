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
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin: 0; padding: 0; background-color: #f0f7f4; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color: #f0f7f4; padding: 40px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" width="520" cellpadding="0" cellspacing="0" style="max-width: 520px; width: 100%;">
          <!-- Logo -->
          <tr>
            <td align="center" style="padding-bottom: 28px;">
              <h1 style="font-size: 28px; font-weight: 800; margin: 0; letter-spacing: -0.5px;">
                <span style="color: #06c286;">c</span><span style="color: #003296;">SU</span>
              </h1>
              <p style="color: #5f7a6e; font-size: 11px; margin: 4px 0 0 0; letter-spacing: 1.5px; text-transform: uppercase;">Continuous Status Updates</p>
            </td>
          </tr>
          <!-- Card -->
          <tr>
            <td style="background-color: #ffffff; border: 1px solid #d4e4dc; border-radius: 16px; padding: 40px 32px; text-align: center;">
              <!-- Greeting -->
              <p style="font-size: 36px; margin: 0 0 8px 0; line-height: 1;">&#x1F44B;</p>
              <h2 style="font-size: 22px; font-weight: 700; color: #1a2332; margin: 0 0 8px 0;">
                Hi ${firstName}!
              </h2>
              <p style="color: #5f7a6e; font-size: 15px; line-height: 1.6; margin: 0 0 32px 0;">
                You've been invited to join the team on <strong style="color: #1a2332;">cSU</strong>.<br/>
                Click below to set your password and get started.
              </p>
              <!-- Button -->
              <table role="presentation" cellpadding="0" cellspacing="0" style="margin: 0 auto;">
                <tr>
                  <td align="center" style="background-color: #06c286; border-radius: 12px;">
                    <a href="${inviteLink}" target="_blank" style="display: inline-block; background-color: #06c286; color: #ffffff; text-decoration: none; font-weight: 700; font-size: 15px; padding: 16px 40px; border-radius: 12px; letter-spacing: 0.3px; mso-padding-alt: 0; text-align: center;">
                      <!--[if mso]><i style="letter-spacing: 40px; mso-font-width: -100%; mso-text-raise: 30pt;">&nbsp;</i><![endif]-->
                      <span style="mso-text-raise: 15pt;">Set Your Password &rarr;</span>
                      <!--[if mso]><i style="letter-spacing: 40px; mso-font-width: -100%;">&nbsp;</i><![endif]-->
                    </a>
                  </td>
                </tr>
              </table>
              <!-- Divider -->
              <div style="border-top: 1px solid #e8f2f0; margin: 28px 0 20px 0;"></div>
              <p style="color: #8a9e95; font-size: 12px; margin: 0; line-height: 1.6;">
                This link expires in 24 hours.<br/>
                If you didn't expect this, you can safely ignore this email.
              </p>
            </td>
          </tr>
          <!-- Footer -->
          <tr>
            <td align="center" style="padding-top: 24px;">
              <p style="color: #8a9e95; font-size: 11px; margin: 0;">
                Sent by <strong style="color: #5f7a6e;">cSU</strong> by xLM
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
    `,
  };

  await getSgMail().send(msg);
}
