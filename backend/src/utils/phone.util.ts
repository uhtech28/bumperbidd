import { parsePhoneNumberFromString, CountryCode } from 'libphonenumber-js';

export interface NormalizedPhone {
  e164: string;         // +919876543210
  countryCode: string;  // 91
  national: string;     // 9876543210
  country: string;      // IN
}

/**
 * Parse and validate a phone number. Returns the canonical E.164 form.
 * Throws if the input is not a valid mobile number for the given region.
 */
export function normalizePhone(
  raw: string,
  defaultCountry: CountryCode = 'IN',
): NormalizedPhone {
  const trimmed = raw.trim().replace(/\s+/g, '');
  const parsed = parsePhoneNumberFromString(trimmed, defaultCountry);
  if (!parsed || !parsed.isValid()) {
    throw new Error('INVALID_PHONE');
  }
  const type = parsed.getType();
  // Only accept mobile / fixed-line-or-mobile numbers for OTP
  if (type && !['MOBILE', 'FIXED_LINE_OR_MOBILE'].includes(type)) {
    throw new Error('NON_MOBILE_PHONE');
  }
  return {
    e164: parsed.number,
    countryCode: String(parsed.countryCallingCode),
    national: parsed.nationalNumber,
    country: parsed.country ?? defaultCountry,
  };
}
