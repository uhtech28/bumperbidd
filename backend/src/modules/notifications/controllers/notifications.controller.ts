import {
  Controller,
  Get,
  Param,
  Patch,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { Request } from 'express';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { NotificationsService } from '../services/notifications.service';

interface AuthedRequest extends Request {
  user: { sub: string };
}

@Controller('notifications')
@UseGuards(JwtAuthGuard)
export class NotificationsController {
  constructor(private readonly svc: NotificationsService) {}

  @Get()
  async list(
    @Req() req: AuthedRequest,
    @Query('limit') limit?: string,
    @Query('cursor') cursor?: string,
    @Query('unread') unread?: string,
  ) {
    return this.svc.list(req.user.sub, {
      limit: limit ? Math.max(1, parseInt(limit, 10)) : 30,
      cursor,
      unreadOnly: unread === '1' || unread === 'true',
    });
  }

  @Get('unread-count')
  async unreadCount(@Req() req: AuthedRequest) {
    const count = await this.svc.unreadCount(req.user.sub);
    return { count };
  }

  @Patch(':id/read')
  async markRead(@Req() req: AuthedRequest, @Param('id') id: string) {
    await this.svc.markRead(req.user.sub, id);
    return { ok: true };
  }

  @Patch('read-all')
  async markAllRead(@Req() req: AuthedRequest) {
    return this.svc.markAllRead(req.user.sub);
  }
}
