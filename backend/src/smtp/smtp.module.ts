import { Module } from '@nestjs/common';
import { SmtpController } from './smtp.controller';
import { SmtpService } from './smtp.service';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [AuthModule],
  controllers: [SmtpController],
  providers: [SmtpService],
  exports: [SmtpService],
})
export class SmtpModule {}
