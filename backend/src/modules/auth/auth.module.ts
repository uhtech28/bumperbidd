import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { OtpModule } from '../otp/otp.module';
import { UsersModule } from '../users/users.module';
import { EmailModule } from '../email/email.module';
import { AuthController } from './controllers/auth.controller';
import { AuthService } from './services/auth.service';
import { PasswordResetService } from './services/password-reset.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { AppConfig } from '../../config/app.config';

@Module({
  imports: [
    OtpModule,
    UsersModule,
    EmailModule,
    JwtModule.registerAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const jwt = config.get<AppConfig['jwt']>('jwt')!;
        return {
          secret: jwt.secret,
          signOptions: { expiresIn: jwt.accessTtl, issuer: 'bumperbid' },
        };
      },
    }),
  ],
  controllers: [AuthController],
  providers: [AuthService, PasswordResetService, JwtAuthGuard],
  exports: [AuthService],
})
export class AuthModule {}
