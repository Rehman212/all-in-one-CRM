import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { ImapFlow } from 'imapflow';
import { simpleParser, type ParsedMail } from 'mailparser';
import { PrismaService } from '../prisma.service';
import { SmtpService } from '../smtp/smtp.service';

@Injectable()
export class InboxService {
  private syncing = false;

  constructor(
    private prisma: PrismaService,
    private smtp: SmtpService,
  ) {}

  list() {
    return this.prisma.inboxMessage.findMany({ orderBy: { receivedAt: 'desc' }, take: 150 });
  }

  unreadCount() {
    return this.prisma.inboxMessage.count({ where: { seen: false } });
  }

  async get(id: number) {
    const row = await this.prisma.inboxMessage.findUnique({ where: { id } });
    if (!row) throw new NotFoundException('Message not found');
    if (!row.seen) {
      await this.prisma.inboxMessage.update({ where: { id }, data: { seen: true } });
      return { ...row, seen: true };
    }
    return row;
  }

  async remove(id: number) {
    await this.prisma.inboxMessage.delete({ where: { id } }).catch(() => {
      throw new NotFoundException('Message not found');
    });
    return { ok: true };
  }

  async saveImap(data: { imapHost: string; imapPort: number; imapUser: string; imapPassword?: string }) {
    const existing = await this.prisma.smtpSetting.findFirst();
    if (!existing) throw new BadRequestException('Pehle Deliverability pe AWS keys save karo.');
    const incoming = (data.imapPassword || '').trim();
    const password = !incoming || incoming === '********' ? existing.imapPassword : incoming;
    if (!password) throw new BadRequestException('Hostinger mailbox password chahiye (email login wala).');
    return this.prisma.smtpSetting.update({
      where: { id: existing.id },
      data: {
        imapHost: data.imapHost.trim() || 'imap.hostinger.com',
        imapPort: data.imapPort || 993,
        imapUser: data.imapUser.trim(),
        imapPassword: password,
      },
    });
  }

  imapStatus() {
    return this.prisma.smtpSetting.findFirst().then((row) =>
      row
        ? {
            imapHost: row.imapHost,
            imapPort: row.imapPort,
            imapUser: row.imapUser,
            imapConfigured: Boolean(row.imapPassword),
          }
        : {
            imapHost: 'imap.hostinger.com',
            imapPort: 993,
            imapUser: 'hello@socialvelocityy.com',
            imapConfigured: false,
          },
    );
  }

  async sync() {
    if (this.syncing) {
      const total = await this.prisma.inboxMessage.count();
      return { imported: 0, total, bounced: 0, busy: true };
    }
    this.syncing = true;
    try {
      return await this.syncInner();
    } finally {
      this.syncing = false;
    }
  }

  private async syncInner() {
    const row = await this.prisma.smtpSetting.findFirst();
    if (!row?.imapPassword || !row.imapUser) {
      throw new BadRequestException('Inbox ke liye Hostinger IMAP save karo: Deliverability page.');
    }
    const client = new ImapFlow({
      host: row.imapHost || 'imap.hostinger.com',
      port: row.imapPort || 993,
      secure: true,
      auth: { user: row.imapUser, pass: row.imapPassword },
      logger: false,
    });
    await client.connect();
    const lock = await client.getMailboxLock('INBOX');
    let imported = 0;
    const fresh: { from: string; subject: string }[] = [];
    try {
      const uids = await client.search({ all: true }, { uid: true });
      const slice = (uids || []).slice(-80);
      if (!slice.length) {
        return { imported: 0, total: 0 };
      }
      for await (const msg of client.fetch(
        slice,
        { uid: true, envelope: true, source: true, internalDate: true },
        { uid: true },
      )) {
        const parsed = (await simpleParser(msg.source as Buffer)) as ParsedMail;
        const messageId =
          parsed.messageId ||
          msg.envelope?.messageId ||
          `${row.imapUser}-${msg.uid}`;
        const from = parsed.from?.value?.[0];
        const exists = await this.prisma.inboxMessage.findUnique({ where: { messageId } });
        if (exists) continue;
        const toField = parsed.to;
        const toText = Array.isArray(toField) ? toField.map((t) => t.text).join(', ') : toField?.text || '';
        await this.prisma.inboxMessage.create({
          data: {
            messageId,
            fromEmail: from?.address || 'unknown',
            fromName: from?.name || '',
            toEmail: toText || row.imapUser,
            subject: parsed.subject || '(no subject)',
            textBody: parsed.text || '',
            htmlBody: typeof parsed.html === 'string' ? parsed.html : '',
            receivedAt: parsed.date || msg.internalDate || new Date(),
            seen: false,
          },
        });
        imported += 1;
        const fromAddr = (from?.address || '').toLowerCase();
        if (!fromAddr.includes('amazonses.com') && !/mailer-daemon/i.test(from?.name || '')) {
          fresh.push({
            from: from?.name ? `${from.name} <${from.address}>` : from?.address || 'unknown',
            subject: parsed.subject || '(no subject)',
          });
        }
      }
    } finally {
      lock.release();
      await client.logout().catch(() => {});
    }
    const bounced = await this.applyBounces();
    if (fresh.length) {
      await this.sendAlert(fresh).catch(() => {});
    }
    const total = await this.prisma.inboxMessage.count();
    return { imported, total, bounced, alerted: fresh.length };
  }

  private async sendAlert(fresh: { from: string; subject: string }[]) {
    const to = (process.env.ALERT_EMAIL || 'rehmanwebs@gmail.com').trim();
    const rows = fresh
      .slice(0, 20)
      .map((m) => `<li><b>${m.from}</b> — ${m.subject}</li>`)
      .join('');
    await this.smtp.sendHtml(
      to,
      `SV Mailer: ${fresh.length} new email(s) on hello@`,
      `<p>New mail in Social Velocityy inbox.</p><ul>${rows}</ul><p>Open the Mailer Inbox to read/reply.</p>`,
    );
  }

  async applyBounces() {
    const notes = await this.prisma.inboxMessage.findMany({
      where: {
        OR: [
          { fromEmail: { contains: 'amazonses.com' } },
          { subject: { contains: 'Delivery Status Notification' } },
          { subject: { contains: 'Undeliverable' } },
        ],
      },
    });
    const emails = new Set<string>();
    for (const n of notes) {
      const blob = `${n.subject}\n${n.fromEmail}\n${n.textBody}\n${n.htmlBody}`;
      if (!/mailer-daemon|delivery status notification|undeliverable|no such user|550/i.test(blob)) continue;
      for (const m of blob.matchAll(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi)) {
        const e = m[0].toLowerCase();
        if (e.includes('amazonses.com') || e.includes('amazonaws.com')) continue;
        if (e === 'hello@socialvelocityy.com' || e.endsWith('@socialvelocityy.com')) continue;
        emails.add(e);
      }
    }
    if (!emails.size) return 0;
    const res = await this.prisma.contact.updateMany({
      where: { email: { in: [...emails] } },
      data: { unsubscribed: true },
    });
    return res.count;
  }

  async reply(id: number, body: string) {
    const msg = await this.prisma.inboxMessage.findUnique({ where: { id } });
    if (!msg) throw new NotFoundException('Message not found');
    if (msg.fromName === 'You') {
      throw new BadRequestException('Sent item pe reply nahi. Inbox se original mail kholo.');
    }
    const settings = await this.prisma.smtpSetting.findFirst();
    const subject = msg.subject.toLowerCase().startsWith('re:') ? msg.subject : `Re: ${msg.subject}`;
    const safe = body
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/\n/g, '<br/>');
    const html = `<p>${safe}</p>`;
    const messageId = await this.smtp.sendHtml(msg.fromEmail, subject, html);
    await this.prisma.inboxMessage.create({
      data: {
        messageId: messageId || `sent-${Date.now()}-${id}`,
        fromEmail: settings?.fromEmail || 'hello@socialvelocityy.com',
        fromName: 'You',
        toEmail: msg.fromEmail,
        subject,
        textBody: body,
        htmlBody: html,
        receivedAt: new Date(),
        seen: true,
      },
    });
    return { ok: true, to: msg.fromEmail, messageId, subject };
  }
}
