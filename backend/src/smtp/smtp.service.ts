import { Injectable, BadRequestException } from '@nestjs/common';
import { SESClient, SendEmailCommand, GetSendQuotaCommand, GetSendStatisticsCommand } from '@aws-sdk/client-ses';
import { PrismaService } from '../prisma.service';

@Injectable()
export class SmtpService {
  constructor(private prisma: PrismaService) {}

  async get() {
    const row = await this.prisma.smtpSetting.findFirst();
    if (!row) return null;
    return { ...row, password: row.password ? '********' : '' };
  }

  async save(data: {
    host: string;
    port: number;
    username: string;
    password?: string;
    fromEmail: string;
    fromName: string;
  }) {
    const existing = await this.prisma.smtpSetting.findFirst();
    const incoming = (data.password || '').trim();
    if (!incoming || incoming === '********') {
      throw new BadRequestException(
        'Secret Access Key paste karo. SMTP password mat dalo — IAM wala Secret Access Key chahiye.',
      );
    }
    const payload = {
      host: 'ap-south-1',
      port: 587,
      username: data.username.trim(),
      password: incoming,
      fromEmail: data.fromEmail.trim(),
      fromName: data.fromName.trim(),
    };
    if (existing) {
      return this.prisma.smtpSetting.update({ where: { id: existing.id }, data: payload });
    }
    return this.prisma.smtpSetting.create({ data: payload });
  }

  private client(row: { username: string; password: string }) {
    return new SESClient({
      region: 'ap-south-1',
      credentials: {
        accessKeyId: row.username,
        secretAccessKey: row.password,
      },
    });
  }

  private textFromHtml(html: string) {
    const plain = html
      .replace(/<style[\s\S]*?<\/style>/gi, ' ')
      .replace(/<script[\s\S]*?<\/script>/gi, ' ')
      .replace(/<[^>]+>/g, ' ')
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/\s+/g, ' ')
      .trim();
    return plain.slice(0, 4000) || 'Open this email in Gmail to view the HTML version.';
  }

  private async sendViaSes(row: { username: string; password: string; fromEmail: string; fromName: string }, to: string, subject: string, html: string) {
    const client = this.client(row);
    try {
      const out = await client.send(
        new SendEmailCommand({
          Source: `${row.fromName} <${row.fromEmail}>`,
          ReplyToAddresses: [row.fromEmail],
          Destination: { ToAddresses: [to] },
          Message: {
            Subject: { Data: subject, Charset: 'UTF-8' },
            Body: {
              Html: { Data: html, Charset: 'UTF-8' },
              Text: { Data: this.textFromHtml(html), Charset: 'UTF-8' },
            },
          },
        }),
      );
      return out.MessageId || '';
    } catch (err) {
      const raw = err instanceof Error ? err.message : 'SES send failed';
      throw new BadRequestException(raw);
    }
  }

  async sendTest(to: string) {
    const row = await this.prisma.smtpSetting.findFirst();
    if (!row?.username || !row.password) {
      throw new BadRequestException('AWS keys missing.');
    }
    await this.sendViaSes(
      row,
      to,
      'Social Velocityy — SES test',
      '<p>Amazon SES API is working for <b>socialvelocityy.com</b>.</p>',
    );
    return { ok: true };
  }

  async sendHtml(to: string, subject: string, html: string) {
    const row = await this.prisma.smtpSetting.findFirst();
    if (!row?.username || !row.password) {
      throw new BadRequestException('AWS keys missing.');
    }
    return this.sendViaSes(row, to, subject, html);
  }

  async quota() {
    const row = await this.prisma.smtpSetting.findFirst();
    if (!row?.username || !row.password) {
      throw new BadRequestException('AWS keys missing.');
    }
    const client = this.client(row);
    const [quota, stats] = await Promise.all([
      client.send(new GetSendQuotaCommand({})),
      client.send(new GetSendStatisticsCommand({})),
    ]);
    const max24h = quota.Max24HourSend ?? 0;
    const sent24h = quota.SentLast24Hours ?? 0;
    const remaining24h = Math.max(0, max24h - sent24h);
    const maxRate = quota.MaxSendRate ?? 0;
    const points = (stats.SendDataPoints || []).reduce(
      (acc, p) => {
        acc.attempts += p.DeliveryAttempts ?? 0;
        acc.bounces += p.Bounces ?? 0;
        acc.complaints += p.Complaints ?? 0;
        acc.rejects += p.Rejects ?? 0;
        return acc;
      },
      { attempts: 0, bounces: 0, complaints: 0, rejects: 0 },
    );
    return {
      region: 'ap-south-1',
      max24HourSend: max24h,
      sentLast24Hours: sent24h,
      remaining24Hours: remaining24h,
      maxSendRate: maxRate,
      estimatedMonthlyLimit: max24h * 30,
      usedPercent24h: max24h ? Math.round((sent24h / max24h) * 1000) / 10 : 0,
      stats2Weeks: points,
    };
  }
}
