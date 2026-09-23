import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { InboxService } from './inbox.service';
import { PrismaService } from '../prisma.service';

@Injectable()
export class InboxPollService implements OnModuleInit, OnModuleDestroy {
  private timer?: ReturnType<typeof setInterval>;

  constructor(
    private inbox: InboxService,
    private prisma: PrismaService,
  ) {}

  onModuleInit() {
    this.timer = setInterval(() => {
      void this.tick();
    }, 8000);
    setTimeout(() => void this.tick(), 2500);
  }

  onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
  }

  private async tick() {
    const row = await this.prisma.smtpSetting.findFirst();
    if (!row?.imapPassword || !row.imapUser) return;
    await this.inbox.sync().catch(() => {});
  }
}
