import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { SmtpService } from '../smtp/smtp.service';

const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));
const SEND_GAP_MS = 5000;

export type SendProgress = {
  campaignId: number;
  campaignName: string;
  status: 'idle' | 'sending' | 'done' | 'failed' | 'cancelled';
  total: number;
  sent: number;
  failed: number;
  remaining: number;
  skipped: number;
  currentEmail: string;
  delaySeconds: number;
  etaSeconds: number;
  lastError: string;
};

@Injectable()
export class CampaignsService {
  private jobs = new Map<number, SendProgress>();
  private running = new Set<number>();
  private cancelled = new Set<number>();

  constructor(
    private prisma: PrismaService,
    private smtp: SmtpService,
  ) {}

  list() {
    return this.prisma.campaign.findMany({
      orderBy: { id: 'desc' },
      include: {
        list: true,
        _count: { select: { sends: true } },
      },
    });
  }

  create(data: { name: string; subject: string; htmlBody: string; listId: number }) {
    return this.prisma.campaign.create({ data });
  }

  active() {
    return [...this.jobs.values()].filter((j) => j.status === 'sending');
  }

  async cancel(id: number) {
    this.cancelled.add(id);
    this.bump(id, { status: 'cancelled', currentEmail: '', lastError: 'Stopped by you' });
    await this.prisma.campaign.update({
      where: { id },
      data: { status: 'cancelled' },
    }).catch(() => {});
    return this.progress(id);
  }

  progress(id: number): SendProgress {
    const job = this.jobs.get(id);
    if (job) return job;
    return {
      campaignId: id,
      campaignName: '',
      status: 'idle',
      total: 0,
      sent: 0,
      failed: 0,
      remaining: 0,
      skipped: 0,
      currentEmail: '',
      delaySeconds: SEND_GAP_MS / 1000,
      etaSeconds: 0,
      lastError: '',
    };
  }

  async startSend(id: number) {
    if (this.running.has(id)) {
      return this.progress(id);
    }

    const campaign = await this.prisma.campaign.findUnique({
      where: { id },
      include: { list: { include: { contacts: true } }, sends: true },
    });
    if (!campaign) throw new BadRequestException('Campaign not found');

    const mailed = await this.prisma.campaignSend.findMany({
      where: { status: 'sent' },
      select: { contact: { select: { email: true } } },
    });
    const mailedEmails = new Set(mailed.map((s) => s.contact.email.toLowerCase()));
    const skipped = campaign.list.contacts.filter(
      (c) => !c.unsubscribed && mailedEmails.has(c.email.toLowerCase()),
    ).length;
    const contacts = campaign.list.contacts.filter(
      (c) => !c.unsubscribed && !mailedEmails.has(c.email.toLowerCase()),
    );
    if (!contacts.length) {
      throw new BadRequestException(
        skipped
          ? `Is list ki ${skipped} emails pe pehle se mail ja chuki hai. New campaign unhe skip karegi — koi naya contact nahi bacha.`
          : 'Is list ke remaining contacts pe pehle se send ho chuka hai.',
      );
    }

    const snapshot: SendProgress = {
      campaignId: id,
      campaignName: campaign.name,
      status: 'sending',
      total: contacts.length,
      sent: 0,
      failed: 0,
      remaining: contacts.length,
      skipped,
      currentEmail: contacts[0].email,
      delaySeconds: SEND_GAP_MS / 1000,
      etaSeconds: Math.max(0, (contacts.length - 1) * (SEND_GAP_MS / 1000)),
      lastError: '',
    };
    this.jobs.set(id, snapshot);
    this.running.add(id);
    this.cancelled.delete(id);

    await this.prisma.campaign.update({ where: { id }, data: { status: 'sending' } });
    void this.runSend(id, campaign.subject, campaign.htmlBody, contacts);
    return snapshot;
  }

  private bump(id: number, patch: Partial<SendProgress>) {
    const cur = this.jobs.get(id);
    if (!cur) return;
    const next = { ...cur, ...patch };
    next.remaining = Math.max(0, next.total - next.sent - next.failed);
    next.etaSeconds = next.remaining * (SEND_GAP_MS / 1000);
    this.jobs.set(id, next);
  }

  private async runSend(
    id: number,
    subject: string,
    htmlBody: string,
    contacts: { id: number; email: string; name: string }[],
  ) {
    try {
      for (let i = 0; i < contacts.length; i++) {
        if (this.cancelled.has(id)) break;
        const contact = contacts[i];
        this.bump(id, { currentEmail: contact.email });
        try {
          await this.smtp.sendHtml(
            contact.email,
            subject,
            htmlBody.replace(/\{\{name\}\}/g, contact.name || 'there'),
          );
          await this.prisma.campaignSend.create({
            data: { campaignId: id, contactId: contact.id, status: 'sent' },
          });
          this.bump(id, { sent: (this.jobs.get(id)?.sent || 0) + 1 });
        } catch (err) {
          const lastError = err instanceof Error ? err.message : 'send failed';
          await this.prisma.campaignSend.create({
            data: {
              campaignId: id,
              contactId: contact.id,
              status: 'failed',
              error: lastError,
            },
          });
          this.bump(id, {
            failed: (this.jobs.get(id)?.failed || 0) + 1,
            lastError,
          });
        }
        if (this.cancelled.has(id)) break;
        if (i < contacts.length - 1) {
          const end = Date.now() + SEND_GAP_MS;
          while (Date.now() < end) {
            if (this.cancelled.has(id)) break;
            await delay(200);
          }
        }
      }

      const job = this.jobs.get(id);
      const sent = job?.sent || 0;
      const failed = job?.failed || 0;
      const stopped = this.cancelled.has(id);
      await this.prisma.campaign.update({
        where: { id },
        data: {
          status: stopped ? 'cancelled' : sent > 0 && failed === 0 ? 'sent' : sent > 0 ? 'partial' : 'failed',
          sentAt: sent > 0 ? new Date() : null,
        },
      });
      this.bump(id, {
        status: stopped ? 'cancelled' : 'done',
        currentEmail: '',
        lastError: stopped ? 'Stopped by you' : job?.lastError || '',
      });
      this.cancelled.delete(id);
    } catch (err) {
      this.bump(id, {
        status: 'failed',
        lastError: err instanceof Error ? err.message : 'send failed',
      });
      await this.prisma.campaign.update({ where: { id }, data: { status: 'failed' } }).catch(() => {});
    } finally {
      this.running.delete(id);
    }
  }
}
