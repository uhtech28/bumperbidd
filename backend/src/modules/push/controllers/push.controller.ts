import { Body, Controller, Delete, Post, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { PushService } from '../services/push.service';
import { RegisterTokenDto } from '../dto/register-token.dto';

interface AuthedRequest { user: { sub: string } }

@Controller('push')
@UseGuards(JwtAuthGuard)
export class PushController {
  constructor(private readonly svc: PushService) {}

  @Post('register')
  register(@Req() req: AuthedRequest, @Body() dto: RegisterTokenDto) {
    return this.svc.registerToken(req.user.sub, dto.channel, dto.token);
  }

  @Delete('register')
  unregister(@Body() dto: { token: string }) {
    return this.svc.unregister(dto.token);
  }
}
