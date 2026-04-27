import {
  Body,
  Controller,
  Get,
  Patch,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { Request } from 'express';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { UsersService } from '../users.service';
import { UpdateProfileDto } from '../dto/update-profile.dto';

interface AuthedRequest extends Request {
  user: { sub: string };
}

/**
 * /users/me - self-service profile.
 *
 * GET   returns the authenticated user's profile (plus a few read-only
 *       identity fields like emailVerified / role for the UI).
 * PATCH updates whitelisted fields (displayName / bio / profilePhotoUrl).
 *
 * Phone, email, role, password are intentionally not mutable here -
 * those changes go through dedicated security flows (OTP verify, email
 * verify, admin role assignment, password reset).
 */
@Controller('users')
@UseGuards(JwtAuthGuard)
export class UsersController {
  constructor(private readonly users: UsersService) {}

  @Get('me')
  async me(@Req() req: AuthedRequest) {
    return this.users.getProfile(req.user.sub);
  }

  @Patch('me')
  async update(@Req() req: AuthedRequest, @Body() dto: UpdateProfileDto) {
    return this.users.updateProfile(req.user.sub, dto);
  }

  // -------- DPDP Act 2023 -------- //

  /**
   * GET /users/me/export-data - return everything we hold about the
   * caller as a single JSON payload. Frontend can stream this to a
   * file download; consumers can also pipe it through `jq` etc.
   */
  @Get('me/export-data')
  async exportData(@Req() req: AuthedRequest) {
    return this.users.exportUserData(req.user.sub);
  }

  /**
   * POST /users/me/delete - right-to-erasure soft delete. Anonymises
   * PII, revokes all sessions, retains transactional records per Indian
   * tax law. Caller's cookies will start failing JwtAuthGuard on the
   * next request because the user is now flagged bannedAt.
   */
  @Post('me/delete')
  async deleteSelf(@Req() req: AuthedRequest) {
    return this.users.softDeleteSelf(req.user.sub);
  }
}
