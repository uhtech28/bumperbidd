import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Resend } from 'resend';
import { PrismaService } from '../../../prisma/prisma.service';

interface SendOptions {
  to: string;
  userId?: string;
  template:
    | 'auction_ending'
    | 'outbid'
    | 'winner'
    | 'seller_new_bid'
    | 'kyc_approved'
    | 'kyc_rejected'
    | 'payment_approved'
    | 'payment_rejected'
    | 'welcome'
    | 'password_reset';
  subject: string;
  html: string;
  text?: string;
  meta?: Record<string, any>;
}

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);
  private readonly client: Resend | null;
  private readonly from: string;
  private readonly enabled: boolean;

  constructor(config: ConfigService, private readonly prisma: PrismaService) {
    const key = config.get<string>('RESEND_API_KEY');
    this.enabled = !!key;
    this.from = config.get<string>('EMAIL_FROM') ?? 'BumperBid <noreply@bumperbid.com>';
    this.client = this.enabled ? new Resend(key as string) : null;
  }

  async send(opts: SendOptions) {
    const ev = await this.prisma.emailEvent.create({
      data: {
        userId: opts.userId,
        toAddress: opts.to,
        template: opts.template,
        subject: opts.subject,
        status: 'queued',
        meta: opts.meta ?? {},
      },
    });
    if (!this.client) {
      this.logger.warn(`[dev] email skipped: ${opts.template} → ${opts.to}`);
      await this.prisma.emailEvent.update({ where: { id: ev.id }, data: { status: 'sent' } });
      return { dev: true, id: ev.id };
    }
    try {
      const resp = await this.client.emails.send({
        from: this.from,
        to: opts.to,
        subject: opts.subject,
        html: opts.html,
        text: opts.text,
      });
      await this.prisma.emailEvent.update({
        where: { id: ev.id },
        data: { status: 'sent', providerId: resp.data?.id ?? null },
      });
      return { id: ev.id, providerId: resp.data?.id };
    } catch (err: any) {
      await this.prisma.emailEvent.update({
        where: { id: ev.id },
        data: { status: 'failed', error: err?.message ?? 'unknown' },
      });
      this.logger.error(`email send failed ${opts.template}: ${err?.message}`);
      throw err;
    }
  }

  // ----- Template helpers -----

  outbidHtml(name: string, auctionTitle: string, newBid: number, auctionUrl: string) {
    return `<div style="font-family:system-ui;max-width:560px;margin:auto;padding:24px">
      <h2 style="color:#0f172a">You've been outbid</h2>
      <p>Hi ${escapeHtml(name)},</p>
      <p>Someone just outbid you on <b>${escapeHtml(auctionTitle)}</b>. The new high bid is <b>₹${(newBid / 100).toLocaleString('en-IN')}</b>.</p>
      <a href="${auctionUrl}" style="display:inline-block;padding:12px 20px;background:#f59e0b;color:#000;border-radius:8px;text-decoration:none;font-weight:600">Place a higher bid</a>
      <p style="color:#64748b;font-size:12px;margin-top:24px">You received this because you're bidding on BumperBid.</p>
    </div>`;
  }

  endingSoonHtml(name: string, auctionTitle: string, endsAtIso: string, auctionUrl: string) {
    return `<div style="font-family:system-ui;max-width:560px;margin:auto;padding:24px">
      <h2 style="color:#0f172a">Auction ending soon</h2>
      <p>Hi ${escapeHtml(name)},</p>
      <p><b>${escapeHtml(auctionTitle)}</b> is ending at ${new Date(endsAtIso).toLocaleString('en-IN')} (IST). Don't miss your chance.</p>
      <a href="${auctionUrl}" style="display:inline-block;padding:12px 20px;background:#f59e0b;color:#000;border-radius:8px;text-decoration:none;font-weight:600">View auction</a>
    </div>`;
  }

  winnerHtml(name: string, auctionTitle: string, finalPrice: number) {
    return `<div style="font-family:system-ui;max-width:560px;margin:auto;padding:24px">
      <h2 style="color:#059669">🎉 You won!</h2>
      <p>Hi ${escapeHtml(name)}, congratulations — you won <b>${escapeHtml(auctionTitle)}</b> for <b>₹${(finalPrice / 100).toLocaleString('en-IN')}</b>.</p>
      <p>Our team will reach out within 24 hours to coordinate delivery paperwork.</p>
    </div>`;
  }

  /**
   * Password reset email. The link must be the only path to the new
   * password — never include the raw token anywhere else (no SMS, no
   * server logs, no second email).
   */
  passwordResetHtml(name: string, resetUrl: string, expiresInMinutes: number) {
    return `<div style="font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;max-width:560px;margin:auto;padding:24px;color:#0f172a">
      <div style="text-align:center;margin-bottom:24px">
        <div style="font-size:22px;font-weight:700;letter-spacing:.18em;color:#0f172a">BUMPERBID</div>
        <div style="font-size:11px;letter-spacing:.32em;color:#b88923;margin-top:2px">AUCTIONS</div>
      </div>
      <h2 style="margin:0 0 12px 0">Reset your password</h2>
      <p style="line-height:1.55">Hi ${escapeHtml(name)},</p>
      <p style="line-height:1.55">We received a request to reset the password for your BumperBid account. Click the button below to choose a new one. The link expires in ${expiresInMinutes} minutes.</p>
      <p style="margin:28px 0">
        <a href="${resetUrl}" style="display:inline-block;padding:12px 22px;background:#0f172a;color:#fff;border-radius:8px;text-decoration:none;font-weight:600">Reset password</a>
      </p>
      <p style="line-height:1.55;color:#475569;font-size:13px">If the button doesn&rsquo;t work, paste this URL in your browser:<br>
      <span style="word-break:break-all;color:#0f172a">${resetUrl}</span></p>
      <hr style="border:none;border-top:1px solid #e2e8f0;margin:28px 0">
      <p style="color:#64748b;font-size:12px;line-height:1.5">If you didn&rsquo;t request this, you can safely ignore the email — your password won&rsquo;t change. For your security the reset link can only be used once.</p>
    </div>`;
  }

  sellerNewBidHtml(name: string, auctionTitle: string, bidAmount: number, auctionUrl: string) {
    return `<div style="font-family:system-ui;max-width:560px;margin:auto;padding:24px">
      <h2>New bid on your listing</h2>
      <p>Hi ${escapeHtml(name)}, <b>${escapeHtml(auctionTitle)}</b> just received a bid of <b>₹${(bidAmount / 100).toLocaleString('en-IN')}</b>.</p>
      <a href="${auctionUrl}">View auction</a>
    </div>`;
  }
}

function escapeHtml(s: string): string {
  return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] as string));
}
