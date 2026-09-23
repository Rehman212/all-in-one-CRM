import { Module } from '@nestjs/common';
import { InboxController } from './inbox.controller';
import { InboxService } from './inbox.service';
import { AuthModule } from '../auth/auth.module';
import { SmtpModule } from '../smtp/smtp.module';

import { InboxPollService } from './inbox-poll.service';

@Module({
  imports: [AuthModule, SmtpModule],
  controllers: [InboxController],
  providers: [InboxService, InboxPollService],
})
export class InboxModule {}
