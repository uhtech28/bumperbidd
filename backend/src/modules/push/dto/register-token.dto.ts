import { IsIn, IsString } from 'class-validator';
export class RegisterTokenDto {
  @IsIn(['fcm_android', 'fcm_ios', 'web_push']) channel!: 'fcm_android' | 'fcm_ios' | 'web_push';
  @IsString() token!: string;
}
