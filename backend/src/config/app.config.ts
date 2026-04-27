/**
 * Centralised, typed configuration loader.
 * All env access in the app goes through this — never `process.env` directly
 * inside feature modules. This keeps configuration explicit and testable.
 */
export interface AppConfig {
  env: 'development' | 'production' | 'test';
  port: number;
  apiPrefix: string;
  corsOrigin: string;
  trustProxy: boolean;
  jwt: {
    secret: string;
    accessTtl: string;
    refreshTtl: string;
  };
  cookies: {
    // Parent domain for the auth cookies. Leave empty in dev so the browser
    // scopes to the server host automatically. In prod set e.g. ".bumperbid.com".
    domain?: string;
    secure: boolean;
    sameSite: 'lax' | 'strict' | 'none';
  };
  redis: {
    host: string;
    port: number;
    password?: string;
    tls: boolean;
    db?: number;
  };
  otp: {
    length: number;
    ttlSeconds: number;
    maxVerifyAttempts: number;
    resendCooldownSeconds: number;
    hourlyRequestLimit: number;
    hourlyWindowSeconds: number;
    ipHourlyLimit: number;
    devLog: boolean;
  };
  providers: {
    msg91: {
      enabled: boolean;
      authKey: string;
      senderId: string;
      templateId: string;
      route: string;
    };
    twilio: {
      enabled: boolean;
      accountSid: string;
      authToken: string;
      fromNumber: string;
    };
  };
}

const bool = (v: string | undefined, d = false): boolean =>
  v === undefined ? d : /^(1|true|yes)$/i.test(v);
const int = (v: string | undefined, d: number): number => {
  const n = Number(v);
  return Number.isFinite(n) ? n : d;
};
const sameSite = (v: string | undefined): 'lax' | 'strict' | 'none' => {
  const lo = (v ?? 'lax').toLowerCase();
  return lo === 'strict' || lo === 'none' ? lo : 'lax';
};

export const appConfig = (): AppConfig => {
  const isProd = process.env.NODE_ENV === 'production';
  return {
    env: (process.env.NODE_ENV as AppConfig['env']) ?? 'development',
    port: int(process.env.PORT, 4000),
    apiPrefix: process.env.API_PREFIX ?? 'api/v1',
    corsOrigin: process.env.CORS_ORIGIN ?? 'http://localhost:3000',
    trustProxy: bool(process.env.TRUST_PROXY, isProd),
    jwt: {
      secret: process.env.JWT_SECRET ?? 'dev-only-secret-change-me',
      accessTtl: process.env.JWT_ACCESS_TTL ?? '15m',
      refreshTtl: process.env.JWT_REFRESH_TTL ?? '30d',
    },
    cookies: {
      domain: process.env.COOKIE_DOMAIN || undefined,
      secure: bool(process.env.COOKIE_SECURE, isProd),
      sameSite: sameSite(process.env.COOKIE_SAMESITE),
    },
    redis: {
      host: process.env.REDIS_HOST ?? '127.0.0.1',
      port: int(process.env.REDIS_PORT, 6379),
      password: process.env.REDIS_PASSWORD || undefined,
      tls: bool(process.env.REDIS_TLS, false),
      db: process.env.REDIS_DB ? int(process.env.REDIS_DB, 0) : undefined,
    },
    otp: {
      length: int(process.env.OTP_LENGTH, 6),
      ttlSeconds: int(process.env.OTP_TTL_SECONDS, 300),
      maxVerifyAttempts: int(process.env.OTP_MAX_VERIFY_ATTEMPTS, 5),
      resendCooldownSeconds: int(process.env.OTP_RESEND_COOLDOWN_SECONDS, 30),
      hourlyRequestLimit: int(process.env.OTP_HOURLY_REQUEST_LIMIT, 3),
      hourlyWindowSeconds: int(process.env.OTP_HOURLY_WINDOW_SECONDS, 600),
      ipHourlyLimit: int(process.env.OTP_IP_HOURLY_LIMIT, 20),
      devLog: bool(process.env.OTP_DEV_LOG, false),
    },
    providers: {
      msg91: {
        enabled: bool(process.env.MSG91_ENABLED, false),
        authKey: process.env.MSG91_AUTH_KEY ?? '',
        senderId: process.env.MSG91_SENDER_ID ?? 'BMPRBD',
        templateId: process.env.MSG91_TEMPLATE_ID ?? '',
        route: process.env.MSG91_ROUTE ?? '4',
      },
      twilio: {
        enabled: bool(process.env.TWILIO_ENABLED, false),
        accountSid: process.env.TWILIO_ACCOUNT_SID ?? '',
        authToken: process.env.TWILIO_AUTH_TOKEN ?? '',
        fromNumber: process.env.TWILIO_FROM_NUMBER ?? '',
      },
    },
  };
};
