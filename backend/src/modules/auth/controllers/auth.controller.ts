import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Post,
  Get,
  UseGuards,
  Req,
  Res,
  UnauthorizedException,
} from '@nestjs/common';
import { Throttle, ThrottlerGuard } from '@nestjs/throttler';
import { ConfigService } from '@nestjs/config';
import { Request, Response, CookieOptions } from 'express';
import { SendOtpDto } from '../dto/send-otp.dto';
import { VerifyOtpDto } from '../dto/verify-otp.dto';
import { EmailSignupDto } from '../dto/email-signup.dto';
import { EmailLoginDto } from '../dto/email-login.dto';
import { ForgotPasswordDto } from '../dto/forgot-password.dto';
import { ResetPasswordDto } from '../dto/reset-password.dto';
import { AuthService, TokenPair } from '../services/auth.service';
import { PasswordResetService } from '../services/password-reset.service';
import { ClientIp } from '../../../common/decorators/client-ip.decorator';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { UsersService, User } from '../../users/users.service';
import { AppConfig } from '../../../config/app.config';

const ACCESS_COOKIE = 'bb_access';
const REFRESH_COOKIE = 'bb_refresh';

@Controller('auth')
@UseGuards(ThrottlerGuard)
export class AuthController {
  private readonly cookieCfg: AppConfig['cookies'];
  private readonly jwtCfg: AppConfig['jwt'];
  private readonly apiPrefix: string;

  constructor(
    private readonly auth: AuthService,
    private readonly users: UsersService,
    private readonly passwordReset: PasswordResetService,
    config: ConfigService,
  ) {
    this.cookieCfg = config.get<AppConfig['cookies']>('cookies')!;
    this.jwtCfg = config.get<AppConfig['jwt']>('jwt')!;
    this.apiPrefix = config.get<string>('apiPrefix') ?? 'api/v1';
  }

  // -------- OTP flow --------

  @Post('send-otp')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { ttl: 60_000, limit: 5 } })
  async sendOtp(@Body() dto: SendOtpDto, @ClientIp() ip: string) {
    const result = await this.auth.sendOtp(dto.phone, dto.countryCode, ip);
    return {
      message: 'OTP sent.',
      phone: result.phone,
      requestId: result.requestId,
      expiresInSec: result.expiresInSec,
      resendAvailableInSec: result.resendAvailableInSec,
      provider: result.provider,
    };
  }

  @Post('verify-otp')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { ttl: 60_000, limit: 10 } })
  async verifyOtp(
    @Body() dto: VerifyOtpDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const { user, tokens } = await this.auth.verifyAndLogin(
      dto.phone,
      dto.countryCode,
      dto.otp,
    );
    this.setAuthCookies(res, tokens);
    return {
      message: 'Verification successful.',
      user: this.users.publicView(user),
    };
  }

  // -------- Email + password --------

  @Post('email-signup')
  @HttpCode(HttpStatus.CREATED)
  @Throttle({ default: { ttl: 60_000, limit: 3 } })
  async emailSignup(
    @Body() dto: EmailSignupDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const { user, tokens } = await this.auth.emailSignup(dto.email, dto.password);
    this.setAuthCookies(res, tokens);
    return {
      message: 'Account created.',
      user: this.users.publicView(user),
    };
  }

  @Post('email-login')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { ttl: 60_000, limit: 5 } })
  async emailLogin(
    @Body() dto: EmailLoginDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const { user, tokens } = await this.auth.emailLogin(dto.email, dto.password);
    this.setAuthCookies(res, tokens);
    return {
      message: 'Login successful.',
      user: this.users.publicView(user),
    };
  }

  // -------- Password reset --------

  @Post('forgot-password')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { ttl: 60_000, limit: 5 } })
  async forgotPassword(
    @Body() dto: ForgotPasswordDto,
    @Req() req: Request,
    @ClientIp() ip: string,
  ) {
    await this.passwordReset.requestReset({
      email: dto.email,
      ip,
      userAgent: req.headers['user-agent'] ?? undefined,
    });
    return {
      message:
        "If that email is registered, we've sent a reset link. Check your inbox.",
    };
  }

  @Post('reset-password')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { ttl: 60_000, limit: 10 } })
  async resetPassword(@Body() dto: ResetPasswordDto) {
    await this.passwordReset.completeReset({
      token: dto.token,
      newPassword: dto.newPassword,
    });
    return {
      message:
        'Password updated. Sign in with your new password - all other devices have been signed out.',
    };
  }

  // -------- Session lifecycle --------

  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { ttl: 60_000, limit: 30 } })
  async refresh(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const token = this.readRefreshCookie(req);
    const { user, tokens } = await this.auth.rotateRefresh(token);
    this.setAuthCookies(res, tokens);
    return {
      message: 'Session refreshed.',
      user: this.users.publicView(user as unknown as User & { isNew?: boolean }),
    };
  }

  @Post('logout')
  @HttpCode(HttpStatus.OK)
  async logout(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const token = (req as Request & { cookies?: Record<string, string> }).cookies?.[REFRESH_COOKIE];
    await this.auth.revokeRefresh(token);
    this.clearAuthCookies(res);
    return { message: 'Signed out.' };
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  async me(@Req() req: Request) {
    const payload = (req as unknown as { user: { sub: string } }).user;
    const user = await this.users.findById(payload.sub);
    if (!user) {
      return { user: null };
    }
    return {
      user: this.users.publicView({ ...user, isNew: false }),
    };
  }

  // -------- Active sessions --------

  @Get('sessions')
  @UseGuards(JwtAuthGuard)
  async sessions(@Req() req: Request) {
    const payload = (req as unknown as { user: { sub: string; jti?: string } }).user;
    const items = await this.auth.listSessions(payload.sub, payload.jti ?? null);
    return { items };
  }

  @Post('sessions/:id/revoke')
  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtAuthGuard)
  async revokeOneSession(@Req() req: Request) {
    const payload = (req as unknown as { user: { sub: string } }).user;
    const sessionId = (req as unknown as { params: { id: string } }).params.id;
    if (!sessionId) {
      throw new UnauthorizedException({ code: 'SESSION_ID_REQUIRED' });
    }
    await this.auth.revokeSession(payload.sub, sessionId);
    return { ok: true };
  }

  // -------- Cookie helpers --------

  private setAuthCookies(res: Response, tokens: TokenPair): void {
    const baseOpts = this.baseCookieOpts();
    res.cookie(ACCESS_COOKIE, tokens.accessToken, {
      ...baseOpts,
      maxAge: this.ttlToMs(this.jwtCfg.accessTtl),
      path: '/',
    });
    res.cookie(REFRESH_COOKIE, tokens.refreshToken, {
      ...baseOpts,
      maxAge: this.ttlToMs(this.jwtCfg.refreshTtl),
      path: `/${this.apiPrefix}/auth`,
    });
  }

  private clearAuthCookies(res: Response): void {
    const baseOpts = this.baseCookieOpts();
    res.clearCookie(ACCESS_COOKIE, { ...baseOpts, path: '/' });
    res.clearCookie(REFRESH_COOKIE, { ...baseOpts, path: `/${this.apiPrefix}/auth` });
  }

  private baseCookieOpts(): CookieOptions {
    const opts: CookieOptions = {
      httpOnly: true,
      secure: this.cookieCfg.secure,
      sameSite: this.cookieCfg.sameSite,
    };
    if (this.cookieCfg.domain) opts.domain = this.cookieCfg.domain;
    return opts;
  }

  private readRefreshCookie(req: Request): string {
    const t = (req as Request & { cookies?: Record<string, string> })
      .cookies?.[REFRESH_COOKIE];
    if (!t) {
      throw new UnauthorizedException({
        code: 'MISSING_REFRESH_TOKEN',
        message: 'No active session.',
      });
    }
    return t;
  }

  private ttlToMs(ttl: string): number {
    const m = ttl.match(/^(\d+)([smhd])$/);
    if (!m) return 15 * 60_000;
    const v = Number(m[1]);
    const unit = m[2];
    const sec = unit === 's' ? v : unit === 'm' ? v * 60 : unit === 'h' ? v * 3600 : v * 86400;
    return sec * 1000;
  }
}
