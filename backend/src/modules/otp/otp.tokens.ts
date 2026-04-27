/**
 * DI tokens for SMS providers. Using symbols here lets us swap concrete
 * classes in tests without touching consumers.
 */
export const MSG91 = Symbol('SmsProvider.MSG91');
export const TWILIO = Symbol('SmsProvider.Twilio');
export const DEV_LOG = Symbol('SmsProvider.DevLog');
