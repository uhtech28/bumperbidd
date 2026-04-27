import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { S3Client, PutObjectCommand, HeadObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { RekognitionClient, DetectModerationLabelsCommand } from '@aws-sdk/client-rekognition';
import { randomUUID } from 'crypto';
import { PrismaService } from '../../../prisma/prisma.service';

const MAX_IMAGE_BYTES = 10 * 1024 * 1024; // 10 MB
const ALLOWED_MIME = ['image/jpeg', 'image/png', 'image/webp'];

/**
 * UploadsService — issues presigned PUT URLs for direct-to-R2 uploads,
 * then runs AWS Rekognition moderation on the fetched object before the
 * image is allowed to be shown publicly.
 *
 * Flow:
 *   1. Client calls POST /uploads/presign — backend returns signed URL + key
 *   2. Client PUTs the image bytes directly to R2 (no backend bandwidth)
 *   3. Client calls POST /uploads/confirm — backend HEADs the object,
 *      checks size, queues a Rekognition scan, marks as "pending"
 *   4. Rekognition verdict updates VehicleImage.moderation to approved/rejected
 */
@Injectable()
export class UploadsService {
  private readonly logger = new Logger(UploadsService.name);
  private readonly s3: S3Client;
  private readonly rek: RekognitionClient | null;
  private readonly bucket: string;
  private readonly publicBase: string;
  private readonly rekEnabled: boolean;

  constructor(
    config: ConfigService,
    private readonly prisma: PrismaService,
  ) {
    // Accept both S3_* (matches AWS doc naming, MinIO/R2 examples) and
    // UPLOADS_* (the original naming) so existing deployments don't break.
    // S3_* takes precedence when both are set.
    const pick = <T = string>(...keys: string[]): T | undefined => {
      for (const k of keys) {
        const v = config.get<T>(k);
        if (v !== undefined && v !== null && (v as unknown) !== '') return v;
      }
      return undefined;
    };

    const region = pick<string>('S3_REGION', 'UPLOADS_REGION') ?? 'us-east-1';
    const endpoint = pick<string>('S3_ENDPOINT', 'UPLOADS_ENDPOINT');
    const accessKeyId = pick<string>('S3_ACCESS_KEY', 'UPLOADS_ACCESS_KEY') ?? '';
    const secretAccessKey = pick<string>('S3_SECRET_KEY', 'UPLOADS_SECRET_KEY') ?? '';
    this.bucket = pick<string>('S3_BUCKET', 'UPLOADS_BUCKET') ?? 'bumperbid-uploads';
    this.publicBase = pick<string>('S3_PUBLIC_BASE', 'UPLOADS_PUBLIC_BASE') ?? '';

    if (!endpoint || !accessKeyId || !secretAccessKey) {
      this.logger.warn(
        '[uploads] S3 not fully configured - presigned PUTs will fail. ' +
          'Set S3_ENDPOINT / S3_ACCESS_KEY / S3_SECRET_KEY / S3_BUCKET / ' +
          'S3_PUBLIC_BASE in backend/.env (MinIO recommended for dev).',
      );
    } else {
      this.logger.log(
        `[uploads] using endpoint=${endpoint} bucket=${this.bucket} region=${region}`,
      );
    }

    this.s3 = new S3Client({
      region,
      endpoint,
      credentials: { accessKeyId, secretAccessKey },
      // Custom endpoints (MinIO, R2, Wasabi, LocalStack) require path-style
      // addressing. AWS itself supports both; path-style is the safer default
      // when an explicit endpoint is set.
      forcePathStyle: !!endpoint,
    });
    this.rekEnabled = config.get<string>('REKOGNITION_ENABLED') === 'true';
    this.rek = this.rekEnabled
      ? new RekognitionClient({
          region: config.get<string>('AWS_REGION') ?? 'ap-south-1',
          credentials: {
            accessKeyId: config.get<string>('AWS_ACCESS_KEY_ID') ?? '',
            secretAccessKey: config.get<string>('AWS_SECRET_ACCESS_KEY') ?? '',
          },
        })
      : null;
  }

  async presign(params: {
    userId: string;
    mimeType: string;
    sizeBytes: number;
    purpose: 'auction' | 'kyc' | 'payment';
  }) {
    if (!ALLOWED_MIME.includes(params.mimeType)) {
      throw new BadRequestException({ code: 'INVALID_MIME', message: 'Only JPEG / PNG / WebP allowed.' });
    }
    if (params.sizeBytes > MAX_IMAGE_BYTES) {
      throw new BadRequestException({ code: 'FILE_TOO_LARGE', message: 'Max 10 MB per image.' });
    }
    const ext = params.mimeType.split('/')[1] === 'jpeg' ? 'jpg' : params.mimeType.split('/')[1];
    const key = `${params.purpose}/${params.userId}/${Date.now()}-${randomUUID()}.${ext}`;
    const cmd = new PutObjectCommand({
      Bucket: this.bucket,
      Key: key,
      ContentType: params.mimeType,
      ContentLength: params.sizeBytes,
    });
    const url = await getSignedUrl(this.s3, cmd, { expiresIn: 300 });
    return { uploadUrl: url, key, publicUrl: `${this.publicBase}/${key}`, expiresIn: 300 };
  }

  async confirm(params: {
    key: string;
    auctionId?: string;
    uploaderId: string;
    mimeType: string;
    sizeBytes: number;
    sortOrder?: number;
  }) {
    // Verify the object actually arrived in R2 before we record it
    try {
      await this.s3.send(new HeadObjectCommand({ Bucket: this.bucket, Key: params.key }));
    } catch {
      throw new NotFoundException({ code: 'OBJECT_NOT_FOUND', message: 'Upload not completed.' });
    }
    if (!params.auctionId) {
      return { key: params.key, publicUrl: `${this.publicBase}/${params.key}` };
    }
    const image = await this.prisma.vehicleImage.create({
      data: {
        auctionId: params.auctionId,
        uploaderId: params.uploaderId,
        fileKey: params.key,
        publicUrl: `${this.publicBase}/${params.key}`,
        mimeType: params.mimeType,
        sizeBytes: params.sizeBytes,
        sortOrder: params.sortOrder ?? 0,
        moderation: this.rekEnabled ? 'pending' : 'approved',
      },
    });
    if (this.rekEnabled) this.moderate(image.id, params.key).catch(() => undefined);
    return image;
  }

  async delete(key: string) {
    await this.s3.send(new DeleteObjectCommand({ Bucket: this.bucket, Key: key }));
    return { deleted: true };
  }

  /**
   * Run Rekognition DetectModerationLabels. Any label with confidence > 85
   * and in the "ExplicitNudity" / "Violence" / "VisuallyDisturbing" tree
   * rejects the image.
   */
  private async moderate(imageId: string, key: string) {
    if (!this.rek) return;
    try {
      const out = await this.rek.send(
        new DetectModerationLabelsCommand({
          Image: { S3Object: { Bucket: this.bucket, Name: key } },
          MinConfidence: 85,
        }),
      );
      const flagged = (out.ModerationLabels ?? []).filter((l: any) =>
        ['Explicit Nudity', 'Violence', 'Visually Disturbing', 'Drugs', 'Gambling'].includes(l.Name ?? ''),
      );
      const verdict = flagged.length > 0 ? 'rejected' : 'approved';
      const note = flagged.map((l: any) => `${l.Name} (${l.Confidence?.toFixed(0)}%)`).join(', ') || null;
      await this.prisma.vehicleImage.update({
        where: { id: imageId },
        data: { moderation: verdict, moderationNote: note },
      });
      this.logger.log(`moderation ${verdict} for ${key}: ${note ?? 'clean'}`);
    } catch (err: any) {
      await this.prisma.vehicleImage.update({
        where: { id: imageId },
        data: { moderation: 'errored', moderationNote: err?.message ?? 'unknown' },
      });
      this.logger.error(`moderation error for ${key}: ${err?.message}`);
    }
  }
}
