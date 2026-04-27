import { IsOptional, IsString, IsUrl, MaxLength } from 'class-validator';

/**
 * Self-service profile patch.
 *
 * All fields optional; the service treats `null` and empty string as
 * "clear this field". Phone, email, role, and password are NOT
 * patchable via this endpoint - changes to those go through the
 * dedicated security flows.
 */
export class UpdateProfileDto {
  @IsOptional()
  @IsString()
  @MaxLength(80)
  displayName?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  bio?: string | null;

  @IsOptional()
  @IsString()
  @IsUrl({ require_protocol: true })
  @MaxLength(500)
  profilePhotoUrl?: string | null;
}
