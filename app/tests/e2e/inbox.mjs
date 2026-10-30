// Read the sign-up codes cognito-local delivered: emails from Mailpit, text messages from
// LocalStack SNS. Polls, because delivery can take a moment.
const MAILPIT = 'http://localhost:8026';
const SMS = 'http://localhost:4568/_aws/sns/sms-messages?region=eu-west-2';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const CODE = /code is (\d{6})/;

async function poll(find, what) {
  for (let i = 0; i < 60; i++) {
    const found = await find().catch(() => null);
    if (found) return found;
    await sleep(500);
  }
  throw new Error(`no ${what} arrived within 30 seconds`);
}

/** The newest email to `to`: { code, subject, from }. */
export function mailTo(to) {
  return poll(async () => {
    const list = await (await fetch(`${MAILPIT}/api/v1/search?query=${encodeURIComponent(`to:"${to}"`)}`)).json();
    const m = list.messages?.[0];
    if (!m) return null;
    const full = await (await fetch(`${MAILPIT}/api/v1/message/${m.ID}`)).json();
    const code = full.Text?.match(CODE)?.[1];
    return code ? { code, subject: full.Subject, from: full.From?.Address, html: full.HTML } : null;
  }, `email to ${to}`);
}

/** How many emails went to `to` (no waiting). */
export async function mailCount(to) {
  const list = await (await fetch(`${MAILPIT}/api/v1/search?query=${encodeURIComponent(`to:"${to}"`)}`)).json();
  return list.messages_count ?? list.messages?.length ?? 0;
}

/** The newest text message to `phone`: { code, message }. */
export function smsTo(phone) {
  return poll(async () => {
    const body = await (await fetch(SMS)).json();
    const messages = body.sms_messages?.[phone] ?? [];
    const last = messages[messages.length - 1];
    const code = last?.Message?.match(CODE)?.[1];
    return code ? { code, message: last.Message } : null;
  }, `text message to ${phone}`);
}
