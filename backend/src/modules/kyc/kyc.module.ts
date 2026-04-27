import { Module } from '@nestjs/common';
import { KycController } from './controllers/kyc.controller';
import { KycService } from './services/kyc.service';
import { PrismaModule } from '../../prisma/prisma.module';
import { UploadsModule } from '../uploads/uploads.module';
import { AuditModule } from '../audit/audit.module';

@Module({
  imports: [PrismaModule, UploadsModule, AuditModule],
  controllers: [KycController],
  providers: [KycService],
  exports: [KycService],
})
export class KycModule {}
