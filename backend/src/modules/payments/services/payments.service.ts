import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { PrismaService } from '../../../prisma/prisma.service';
import { WalletService } from '../../wallet/services/wallet.service';
import { AuditService } from '../../audit/services/audit.service';
import { EmailService } from '../../email/services/email.service';

/**
 * PaymentsService — QR-upload flow.
 *
 * 1. User requests topup of ₹X → system returns the platform's QR code URL + instructions
 * 2. User pays via UPI / bank transfer to your static QR
 * 3. User uploads screenshot + enters UTR reference → PaymentProof row created (pending)
 * 4. Admin reviews in admin panel → approve or reject
 * 5. On approve: wallet credited idempotently, user notified
 * 6. On reject: user notified with reason
 */
@Injectable()
export class PaymentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly wallet: WalletService,
    private readonly audit: AuditService,
    private readonly email: EmailService,
  ) {}

  async createProof(userId: string, dto: { amount: number; utrReference?: string; fileKey: string }) {
    if (!Number.isInteger(dto.amount) || dto.amount < 10000) {
      throw new BadRequestException({ code: 'INVALID_AMOUNT', message: 'Minimum top-up is ₹100.' });
    }
    return this.prisma.paymentProof.create({
      data: {
        userId,
        amount: dto.amount,
        utrReference: dto.utrReference,
        fileKey: dto.fileKey,
        status: 'pending',
      },
    });
  }

  async myProofs(userId: string, opts: { limit?: number; cursor?: string } = {}) {
    const limit = Math.min(Math.max(opts.limit ?? 20, 1), 100);
    const rows = await this.prisma.paymentProof.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: limit + 1,
      ...(opts.cursor ? { cursor: { id: opts.cursor }, skip: 1 } : {}),
    });
    const hasMore = rows.length > limit;
    return { items: hasMore ? rows.slice(0, -1) : rows, nextCursor: hasMore ? rows[limit - 1].id : null };
  }

  async listPending(opts: { limit?: number; cursor?: string } = {}) {
    const limit = Math.min(Math.max(opts.limit ?? 30, 1), 100);
    const rows = await this.prisma.paymentProof.findMany({
      where: { status: 'pending' },
      orderBy: { createdAt: 'asc' },
      take: limit + 1,
      ...(opts.cursor ? { cursor: { id: opts.cursor }, skip: 1 } : {}),
    });
    const hasMore = rows.length > limit;
    return { items: hasMore ? rows.slice(0, -1) : rows, nextCursor: hasMore ? rows[limit - 1].id : null };
  }

  async approve(adminId: string, proofId: string, meta: { ip?: string; userAgent?: string } = {}) {
    const proof = await this.prisma.paymentProof.findUnique({ where: { id: proofId } });
    if (!proof) throw new NotFoundException({ code: 'PROOF_NOT_FOUND' });
    if (proof.status !== 'pending') throw new BadRequestException({ code: 'ALREADY_REVIEWED' });
    // Credit wallet idempotently (idempotencyKey derived from proofId)
    const { entry } = await this.wallet.credit({
      userId: proof.userId,
      amount: proof.amount,
      idempotencyKey: `proof-${proofId}`,
      note: `QR top-up approved (UTR: ${proof.utrReference ?? 'n/a'})`,
      referenceType: 'payment_proof',
      referenceId: proofId,
    });
    const updated = await this.prisma.paymentProof.update({
      where: { id: proofId },
      data: {
        status: 'approved',
        reviewerId: adminId,
        reviewedAt: new Date(),
        creditedEntryId: entry.id,
      },
    });
    await this.audit.log({ adminId, action: 'payment.approve', targetType: 'payment_proof', targetId: proofId, diff: { amount: proof.amount }, ...meta });
    // Notify user
    const user = await this.prisma.user.findUnique({ where: { id: proof.userId } });
    if (user?.email) {
      await this.email.send({
        to: user.email,
        userId: user.id,
        template: 'payment_approved',
        subject: 'Your BumperBid wallet top-up was approved',
        html: `<p>Your top-up of ₹${(proof.amount / 100).toLocaleString('en-IN')} has been credited to your BumperBid wallet.</p>`,
      }).catch(() => undefined);
    }
    return updated;
  }

  async reject(adminId: string, proofId: string, note: string, meta: { ip?: string; userAgent?: string } = {}) {
    if (!note?.trim()) throw new BadRequestException({ code: 'NOTE_REQUIRED' });
    const proof = await this.prisma.paymentProof.findUnique({ where: { id: proofId } });
    if (!proof) throw new NotFoundException({ code: 'PROOF_NOT_FOUND' });
    if (proof.status !== 'pending') throw new BadRequestException({ code: 'ALREADY_REVIEWED' });
    const updated = await this.prisma.paymentProof.update({
      where: { id: proofId },
      data: { status: 'rejected', reviewerId: adminId, reviewedAt: new Date(), rejectionNote: note },
    });
    await this.audit.log({ adminId, action: 'payment.reject', targetType: 'payment_proof', targetId: proofId, diff: { note }, ...meta });
    const user = await this.prisma.user.findUnique({ where: { id: proof.userId } });
    if (user?.email) {
      await this.email.send({
        to: user.email,
        userId: user.id,
        template: 'payment_rejected',
        subject: 'Your BumperBid top-up could not be verified',
        html: `<p>Your recent top-up request of ₹${(proof.amount / 100).toLocaleString('en-IN')} was rejected.</p><p><b>Reason:</b> ${escapeHtml(note)}</p>`,
      }).catch(() => undefined);
    }
    return updated;
  }

  getPaymentInstructions() {
    return {
      upiId: process.env.PLATFORM_UPI_ID ?? 'bumperbid@upi',
      displayName: process.env.PLATFORM_UPI_NAME ?? 'BumperBid Pvt. Ltd.',
      qrImageUrl: process.env.PLATFORM_QR_URL ?? '/assets/payment-qr.png',
      instructions: [
        'Open any UPI app (PhonePe, GPay, Paytm, BHIM)',
        'Scan the QR above OR pay to the UPI ID shown',
        'Enter the exact amount you want to top up',
        'After payment, copy the UTR / transaction reference number',
        'Upload the payment screenshot and enter the UTR below',
        'Funds will be credited within 15 minutes (auto-approved) or up to 2 hours (manual review)',
      ],
      supportEmail: process.env.SUPPORT_EMAIL ?? 'support@bumperbid.com',
    };
  }
}

function escapeHtml(s: string): string {
  return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] as string));
}
