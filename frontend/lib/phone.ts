import {
  AsYouType,
  parsePhoneNumberFromString,
  CountryCode,
} from 'libphonenumber-js';

export interface CountryOption {
  code: CountryCode;
  name: string;
  dial: string; // "+91"
  flag: string;
}

export const COUNTRIES: CountryOption[] = [
  { code: 'IN', name: 'India',         dial: '+91',  flag: '🇮🇳' },
  { code: 'US', name: 'United States', dial: '+1',   flag: '🇺🇸' },
  { code: 'GB', name: 'United Kingdom',dial: '+44',  flag: '🇬🇧' },
  { code: 'AE', name: 'UAE',           dial: '+971', flag: '🇦🇪' },
  { code: 'SG', name: 'Singapore',     dial: '+65',  flag: '🇸🇬' },
  { code: 'AU', name: 'Australia',     dial: '+61',  flag: '🇦🇺' },
  { code: 'CA', name: 'Canada',        dial: '+1',   flag: '🇨🇦' },
];

export function formatAsYouType(value: string, country: CountryCode): string {
  return new AsYouType(country).input(value);
}

export function isValidPhone(value: string, country: CountryCode): boolean {
  const p = parsePhoneNumberFromString(value, country);
  return !!p && p.isValid();
}

export function maskPhone(e164: string): string {
  // +91 98••• ••321
  const digits = e164.replace(/^\+?/, '');
  if (digits.length < 6) return e164;
  const head = digits.slice(0, 3);
  const tail = digits.slice(-3);
  const middle = '•'.repeat(Math.max(digits.length - 6, 3));
  return `+${head} ${middle} ${tail}`;
}
