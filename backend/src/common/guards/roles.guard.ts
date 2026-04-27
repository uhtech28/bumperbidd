import { CanActivate, ExecutionContext, ForbiddenException, Injectable, SetMetadata } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PrismaService } from '../../prisma/prisma.service';

export const ROLES_KEY = 'roles';
export const Roles = (...roles: string[]) => SetMetadata(ROLES_KEY, roles);

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector, private readonly prisma: PrismaService) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const required = this.reflector.getAllAndOverride<string[]>(ROLES_KEY, [ctx.getHandler(), ctx.getClass()]);
    if (!required || required.length === 0) return true;
    const req = ctx.switchToHttp().getRequest();
    const userId = req?.user?.sub;
    if (!userId) throw new ForbiddenException({ code: 'UNAUTHORIZED' });
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user || user.bannedAt) throw new ForbiddenException({ code: 'ACCOUNT_DISABLED' });
    if (!required.includes(user.role)) throw new ForbiddenException({ code: 'FORBIDDEN', message: `Requires role: ${required.join(' | ')}` });
    req.user.role = user.role;
    return true;
  }
}
