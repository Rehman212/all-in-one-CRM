import { Module } from '@nestjs/common';
import { InboxController } from './inbox.controller';
import { InboxService } from './inbox.service';
import { AuthModule } from '../auth/auth.module';
import { SmtpModule } from '../smtp/smtp.module';

@Module({
  imports: [AuthModule, SmtpModule],
  controllers: [InboxController],
  providers: [InboxService],
})
export class InboxModule {}
