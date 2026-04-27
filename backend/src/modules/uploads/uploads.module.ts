import { Module } from '@nestjs/common';
import { UploadsController } from './controllers/uploads.controller';
import { UploadsService } from './services/uploads.service';
import { PrismaModule } from '../../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [UploadsController],
  providers: [UploadsService],
  exports: [UploadsService],
})
export class UploadsModule {}
