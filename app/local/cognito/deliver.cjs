// Delivers cognito-local's codes: email to Mailpit (its send API), text messages to LocalStack
// SNS (Publish to a phone number). A failed delivery is logged, never thrown: the sign-up has
// already happened, and "Send a new code" can try again.
const MAILPIT_URL = process.env.MAILPIT_URL || 'http://atp-mailpit:8025';
const SNS_ENDPOINT = process.env.SNS_ENDPOINT || 'http://atp-localstack:4566';
const REGION = process.env.AWS_REGION || 'eu-west-2';
const FROM = process.env.MAIL_FROM || 'no-reply@airport-trip-planner.test';

const escape = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

async function email(ctx, to, message) {
  const code = message.__code;
  try {
    const res = await fetch(`${MAILPIT_URL}/api/v1/send`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        From: { Email: FROM, Name: 'Airport Trip Planner' },
        To: [{ Email: to }],
        Subject: message.emailSubject || 'Your Airport Trip Planner code',
        Text: `Your code is ${code}.\n\nEnter it in Airport Trip Planner to confirm your email. It expires in 24 hours.\n\nIf you didn't ask for this, you can ignore this email.`,
        HTML: `<div style="font-family:'Trebuchet MS',Arial,sans-serif;color:#121926;max-width:480px">`
          + `<div style="background:#121c40;color:#ffffff;padding:20px 24px;font-size:18px">Airport Trip Planner</div>`
          + `<div style="padding:24px"><p>Your code is</p>`
          + `<p style="font-size:32px;letter-spacing:6px;margin:8px 0 16px"><strong>${escape(code)}</strong></p>`
          + `<p>Enter it in Airport Trip Planner to confirm your email. It expires in 24 hours.</p>`
          + `<p style="color:#364152">If you didn't ask for this, you can ignore this email.</p></div></div>`,
      }),
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) throw new Error(`Mailpit answered ${res.status}`);
    ctx.logger.info(`code emailed to ${to} (Mailpit)`);
  } catch (e) {
    ctx.logger.error(`could not email the code to ${to}: ${e.message}`);
  }
}

async function sms(ctx, phone, message) {
  const code = message.__code;
  const body = new URLSearchParams({
    Action: 'Publish', Version: '2010-03-31', PhoneNumber: phone,
    Message: `Your Airport Trip Planner code is ${code}. It expires in 24 hours.`,
  });
  try {
    const res = await fetch(SNS_ENDPOINT, {
      method: 'POST',
      headers: {
        'content-type': 'application/x-www-form-urlencoded',
        // LocalStack reads the region from the credential scope and doesn't check the signature.
        authorization: `AWS4-HMAC-SHA256 Credential=test/20260101/${REGION}/sns/aws4_request, SignedHeaders=host, Signature=local`,
      },
      body,
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) throw new Error(`SNS answered ${res.status}: ${(await res.text()).slice(0, 200)}`);
    ctx.logger.info(`code texted to ${phone} (LocalStack SNS)`);
  } catch (e) {
    ctx.logger.error(`could not text the code to ${phone}: ${e.message}`);
  }
}

module.exports = { email, sms };
