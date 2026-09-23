import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Post,
  UseGuards,
} from '@nestjs/common';
import { IsArray, IsEmail, IsOptional, IsString, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PrismaService } from '../prisma.service';
import { planContact, mxChecker, type CheckRow } from './check-emails';

class CreateListDto {
  @IsString()
  name: string;
}

class CreateContactDto {
  @IsEmail()
  email: string;

  @IsOptional()
  @IsString()
  name?: string;
}

class ImportRowDto {
  @IsString()
  email: string;

  @IsOptional()
  @IsString()
  name?: string;
}

class ImportDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ImportRowDto)
  rows: ImportRowDto[];
}

@Controller('lists')
@UseGuards(JwtAuthGuard)
export class ListsController {
  constructor(private prisma: PrismaService) {}

  @Get()
  list() {
    return this.prisma.contactList.findMany({
      orderBy: { id: 'desc' },
      include: { _count: { select: { contacts: true } } },
    });
  }

  @Post()
  create(@Body() body: CreateListDto) {
    return this.prisma.contactList.create({ data: { name: body.name } });
  }

  @Delete(':id')
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.prisma.contactList.delete({ where: { id } });
  }

  @Get(':id/contacts')
  contacts(@Param('id', ParseIntPipe) id: number) {
    return this.prisma.contact.findMany({
      where: { listId: id },
      orderBy: { id: 'desc' },
    });
  }

  @Post(':id/contacts')
  addContact(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: CreateContactDto,
  ) {
    return this.prisma.contact.create({
      data: {
        listId: id,
        email: body.email.toLowerCase(),
        name: body.name || '',
      },
    });
  }

  @Post(':id/contacts/import')
  async importCsv(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: ImportDto,
  ) {
    let added = 0;
    let skipped = 0;
    for (const row of body.rows || []) {
      const email = String(row.email || '').trim().toLowerCase();
      if (!email.includes('@')) {
        skipped += 1;
        continue;
      }
      try {
        await this.prisma.contact.create({
          data: { listId: id, email, name: row.name || '' },
        });
        added += 1;
      } catch {
        skipped += 1;
      }
    }
    return { added, skipped };
  }

  @Post(':id/contacts/check')
  async check(@Param('id', ParseIntPipe) id: number) {
    const contacts = await this.prisma.contact.findMany({ where: { listId: id } });
    const hasMx = mxChecker();
    const results: CheckRow[] = [];
    let fixed = 0;
    let removed = 0;
    let ok = 0;

    for (const c of contacts) {
      const plan = await planContact(c.email, hasMx);
      if (plan.drop) {
        await this.prisma.contact.delete({ where: { id: c.id } }).catch(() => {});
        removed += 1;
        results.push({
          id: c.id,
          email: c.email,
          name: c.name,
          status: 'removed',
          reason: plan.reason,
        });
        continue;
      }
      if (plan.changed && plan.email !== c.email.toLowerCase()) {
        const clash = await this.prisma.contact.findFirst({
          where: { listId: id, email: plan.email, NOT: { id: c.id } },
        });
        if (clash) {
          await this.prisma.contact.delete({ where: { id: c.id } }).catch(() => {});
          removed += 1;
          results.push({
            id: c.id,
            email: c.email,
            name: c.name,
            status: 'removed',
            reason: `Duplicate after fix (${plan.email})`,
          });
          continue;
        }
        await this.prisma.contact.update({
          where: { id: c.id },
          data: { email: plan.email },
        });
        fixed += 1;
        results.push({
          id: c.id,
          email: plan.email,
          name: c.name,
          status: 'fixed',
          reason: plan.reason,
        });
        continue;
      }
      ok += 1;
      results.push({
        id: c.id,
        email: plan.email,
        name: c.name,
        status: 'ok',
        reason: plan.reason,
      });
    }

    return { total: contacts.length, ok, fixed, removed, results };
  }

  @Post(':id/contacts/remove-bad')
  async removeBad(@Param('id', ParseIntPipe) id: number, @Body() body: { ids?: number[] }) {
    const ids = (body.ids || []).filter((n) => Number.isFinite(n));
    if (!ids.length) return { removed: 0 };
    const res = await this.prisma.contact.deleteMany({
      where: { listId: id, id: { in: ids } },
    });
    return { removed: res.count };
  }

  @Delete(':id/contacts/:contactId')
  removeContact(
    @Param('id', ParseIntPipe) id: number,
    @Param('contactId', ParseIntPipe) contactId: number,
  ) {
    return this.prisma.contact.delete({ where: { id: contactId, listId: id } });
  }
}
