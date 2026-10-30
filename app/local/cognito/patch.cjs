// Build step: make cognito-local's console sender also deliver each code (deliver.cjs).
// Fails the build if the code it patches has changed.
const fs = require('node:fs');
const file = '/app/start.js';
const src = fs.readFileSync(file, 'utf8');
const before = `  sendEmail(ctx, user, destination, message) {
    return this.sendToConsole(ctx, user, destination, message);
  }
  sendSms(ctx, user, destination, message) {
    return this.sendToConsole(ctx, user, destination, message);
  }`;
const after = `  async sendEmail(ctx, user, destination, message) {
    await require("/app/deliver.cjs").email(ctx, destination, message);
    return this.sendToConsole(ctx, user, destination, message);
  }
  async sendSms(ctx, user, destination, message) {
    await require("/app/deliver.cjs").sms(ctx, destination, message);
    return this.sendToConsole(ctx, user, destination, message);
  }`;
// cognito-local has no ResendConfirmationCode ("Send a new code"). Add it, built like SignUp's
// own delivery: a new code, sent by text or email as at sign-up, replaces the old one.
const targets = 'var Targets = {\n';
const resend = `var ResendConfirmationCode = ({ cognito, clock, messages, otp: otp2 }) => async (ctx, req) => {
  const userPool = await cognito.getUserPoolForClientId(ctx, req.ClientId);
  const user = await userPool.getUserByUsername(ctx, req.Username);
  if (!user) throw new UserNotFoundError();
  if (user.UserStatus === "CONFIRMED") throw new InvalidParameterError("User is already confirmed.");
  const code = otp2();
  const deliveryDetails = await deliverWelcomeMessage2(ctx, code, req.ClientId, user, userPool, messages, req.ClientMetadata);
  await userPool.saveUser(ctx, { ...user, UserLastModifiedDate: clock.get(), ConfirmationCode: code });
  return { CodeDeliveryDetails: deliveryDetails };
};
${targets}  ResendConfirmationCode,
`;
const once = (text, what) => {
  if (src.split(text).length !== 2) throw new Error(`cognito-local ${what} not found exactly once: the patch needs updating`);
};
once(before, 'sender');
once(targets, 'target list');
once('var deliverWelcomeMessage2 = ', 'sign-up delivery');
fs.writeFileSync(file, src.replace(before, after).replace(targets, resend));
console.log('cognito-local now delivers codes and can send a new one');
