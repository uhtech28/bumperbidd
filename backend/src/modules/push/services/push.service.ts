import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as admin from 'firebase-admin';
import webpush from 'web-push';
import { PrismaService } from '../../../prisma/prisma.service';

type PushChannel = 'fcm_android' | 'fcm_ios' | 'web_push';

@Injectable()
export class PushService {
  private readonly logger = new Logger(PushService.name);
  private fcmReady = false;
  private webReady = false;

  constructor(config: ConfigService, private readonly prisma: PrismaService) {
    const saJson = config.get<string>('FCM_SERVICE_ACCOUNT_JSON');
    if (saJson) {
      try {
        admin.initializeApp({ credential: admin.credential.cert(JSON.parse(saJson)) });
        this.fcmReady = true;
      } catch (e: any) {
        this.logger.error(`FCM init failed: ${e.message}`);
      }
    }
    const vapidPub = config.get<string>('VAPID_PUBLIC_KEY');
    const vapidPriv = config.get<string>('VAPID_PRIVATE_KEY');
    const vapidSubject = config.get<string>('VAPID_SUBJECT') ?? 'mailto:ops@bumperbid.com';
    if (vapidPub && vapidPriv) {
      webpush.setVapidDetails(vapidSubject, vapidPub, vapidPriv);
      this.webReady = true;
    }
  }

  async registerToken(userId: string, channel: PushChannel, token: string) {
    return this.prisma.pushToken.upsert({
      where: { token },
      create: { userId, channel, token },
      update: { userId, channel, lastSeenAt: new Date() },
    });
  }

  async unregister(token: string) {
    await this.prisma.pushToken.deleteMany({ where: { token } });
  }

  async sendToUser(userId: string, payload: { title: string; body: string; url?: string; data?: Record<string, string> }) {
    const tokens = await this.prisma.pushToken.findMany({ where: { userId } });
    await Promise.allSettled(tokens.map((t: any) => this.dispatch(t.channel, t.token, payload)));
    return { sent: tokens.length };
  }

  private async dispatch(channel: PushChannel, token: string, payload: { title: string; body: string; url?: string; data?: Record<string, string> }) {
    if (channel === 'fcm_android' || channel === 'fcm_ios') {
      if (!this.fcmReady) return;
      await admin.messaging().send({
        token,
        notification: { title: payload.title, body: payload.body },
        data: { ...(payload.data ?? {}), url: payload.url ?? '' },
        android: { priority: 'high' },
        apns: { headers: { 'apns-priority': '10' } },
      });
    } else if (channel === 'web_push') {
      if (!this.webReady) return;
      try {
        await webpush.sendNotification(JSON.parse(token), JSON.stringify(payload));
      } catch (err: any) {
        if (err.statusCode === 410 || err.statusCode === 404) {
          await this.unregister(token); // subscription expired
        }
      }
    }
  }
}
