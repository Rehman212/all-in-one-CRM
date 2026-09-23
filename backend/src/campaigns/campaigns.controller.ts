import { Body, Controller, Get, Param, ParseIntPipe, Post, UseGuards } from '@nestjs/common';
import { IsInt, IsString, Min } from 'class-validator';
import { Type } from 'class-transformer';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CampaignsService } from './campaigns.service';

class CreateCampaignDto {
  @IsString()
  name: string;

  @IsString()
  subject: string;

  @IsString()
  htmlBody: string;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  listId: number;
}

@Controller('campaigns')
@UseGuards(JwtAuthGuard)
export class CampaignsController {
  constructor(private campaigns: CampaignsService) {}

  @Get()
  list() {
    return this.campaigns.list();
  }

  @Post()
  create(@Body() body: CreateCampaignDto) {
    return this.campaigns.create(body);
  }

  @Get('active')
  active() {
    return this.campaigns.active();
  }

  @Get(':id/progress')
  progress(@Param('id', ParseIntPipe) id: number) {
    return this.campaigns.progress(id);
  }

  @Post(':id/send')
  send(@Param('id', ParseIntPipe) id: number) {
    return this.campaigns.startSend(id);
  }

  @Post(':id/cancel')
  cancel(@Param('id', ParseIntPipe) id: number) {
    return this.campaigns.cancel(id);
  }
}
