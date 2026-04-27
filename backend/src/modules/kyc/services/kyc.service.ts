import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { UploadsService } from '../../uploads/services/uploads.service';
import { AuditService } from '../../audit/services/audit.service';

const PAN_RE = /^[A-Z]{5}\d{4}[A-Z]$/;
const PINCODE_RE = /^\d{6}$/;

@Injectable()
export class KycService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly uploads: UploadsService,
    private readonly audit: AuditService,
  ) {}

  async submit(userId: string, dto: {
    fullName: string;
    dob?: string;
    panNumber?: string;
    aadhaarLast4?: string;
    addressLine1?: string;
    addressLine2?: string;
    city?: string;
    state?: string;
    pincode?: string;
    documentKeys?: Array<{ docType: 'pan' | 'aadhaar' | 'driving_license' | 'passport'; fileKey: string; mimeType: string; sizeBytes: number }>;
  }) {
    if (dto.panNumber && !PAN_RE.test(dto.panNumber)) {
      throw new BadRequestException({ code: 'INVALID_PAN', message: 'PAN must match ABCDE1234F format.' });
    }
    if (dto.pincode && !PINCODE_RE.test(dto.pincode)) {
      throw new BadRequestException({ code: 'INVALID_PINCODE', message: 'Pincode must be 6 digits.' });
    }
    const profile = await this.prisma.kycProfile.upsert({
      where: { userId },
      create: {
        userId,
        fullName: dto.fullName,
        dob: dto.dob ? new Date(dto.dob) : null,
        panNumber: dto.panNumber,
        aadhaarLast4: dto.aadhaarLast4,
        addressLine1: dto.addressLine1,
        addressLine2: dto.addressLine2,
        city: dto.city,
        state: dto.state,
        pincode: dto.pincode,
        status: 'pending',
      },
      update: {
        fullName: dto.fullName,
        dob: dto.dob ? new Date(dto.dob) : null,
        panNumber: dto.panNumber,
        aadhaarLast4: dto.aadhaarLast4,
        addressLine1: dto.addressLine1,
        addressLine2: dto.addressLine2,
        city: dto.city,
        state: dto.state,
        pincode: dto.pincode,
        status: 'pending',
        rejectionNote: null,
      },
    });
    if (dto.documentKeys?.length) {
      await this.prisma.kycDocument.createMany({
        data: dto.documentKeys.map((d) => ({
          profileId: profile.id,
          docType: d.docType,
          fileKey: d.fileKey,
          mimeType: d.mimeType,
          sizeBytes: d.sizeBytes,
        })),
      });
    }
    return profile;
  }

  async mine(userId: string) {
    return this.prisma.kycProfile.findUnique({
      where: { userId },
      include: { documents: true },
    });
  }

  async approve(adminId: string, profileId: string, meta: { ip?: string; userAgent?: string } = {}) {
    const p = await this.prisma.kycProfile.findUnique({ where: { id: profileId } });
    if (!p) throw new NotFoundException({ code: 'KYC_NOT_FOUND' });
    const updated = await this.prisma.kycProfile.update({
      where: { id: profileId },
      data: { status: 'approved', reviewerId: adminId, reviewedAt: new Date(), rejectionNote: null },
    });
    await this.prisma.user.update({ where: { id: p.userId }, data: { role: 'seller' } });
    await this.audit.log({ adminId, action: 'kyc.approve', targetType: 'kyc', targetId: profileId, diff: { before: p, after: updated }, ...meta });
    return updated;
  }

  async reject(adminId: string, profileId: string, note: string, meta: { ip?: string; userAgent?: string } = {}) {
    if (!note?.trim()) throw new BadRequestException({ code: 'NOTE_REQUIRED' });
    const p = await this.prisma.kycProfile.findUnique({ where: { id: profileId } });
    if (!p) throw new NotFoundException({ code: 'KYC_NOT_FOUND' });
    const updated = await this.prisma.kycProfile.update({
      where: { id: profileId },
      data: { status: 'rejected', reviewerId: adminId, reviewedAt: new Date(), rejectionNote: note },
    });
    await this.audit.log({ adminId, action: 'kyc.reject', targetType: 'kyc', targetId: profileId, diff: { note }, ...meta });
    return updated;
  }

  async ensureSeller(userId: string) {
    const u = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!u) throw new NotFoundException({ code: 'USER_NOT_FOUND' });
    if (u.role !== 'seller' && u.role !== 'admin') {
      throw new ForbiddenException({ code: 'KYC_REQUIRED', message: 'Seller KYC must be approved before listing.' });
    }
  }
}
