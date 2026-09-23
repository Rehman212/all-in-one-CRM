import { Body, Controller, Delete, Get, Param, ParseIntPipe, Post, UseGuards } from '@nestjs/common';
import { IsInt, IsOptional, IsString, Min } from 'class-validator';
import { Type } from 'class-transformer';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { InboxService } from './inbox.service';

class SaveImapDto {
  @IsString()
  imapHost: string;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  imapPort: number;

  @IsString()
  imapUser: string;

  @IsOptional()
  @IsString()
  imapPassword?: string;
}

class ReplyDto {
  @IsString()
  body: string;
}

@Controller('inbox')
@UseGuards(JwtAuthGuard)
export class InboxController {
  constructor(private inbox: InboxService) {}

  @Get()
  list() {
    return this.inbox.list();
  }

  @Get('status')
  status() {
    return this.inbox.imapStatus();
  }

  @Get('unread')
  async unread() {
    return { count: await this.inbox.unreadCount() };
  }

  @Post('imap')
  saveImap(@Body() body: SaveImapDto) {
    return this.inbox.saveImap(body);
  }

  @Post('sync')
  sync() {
    return this.inbox.sync();
  }

  @Get(':id')
  get(@Param('id', ParseIntPipe) id: number) {
    return this.inbox.get(id);
  }

  @Post(':id/reply')
  reply(@Param('id', ParseIntPipe) id: number, @Body() body: ReplyDto) {
    return this.inbox.reply(id, body.body);
  }

  @Delete(':id')
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.inbox.remove(id);
  }
}
