import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { IsEmail, IsInt, IsOptional, IsString, Min } from 'class-validator';
import { Type } from 'class-transformer';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { SmtpService } from './smtp.service';

class SaveSmtpDto {
  @IsString()
  host: string;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  port: number;

  @IsString()
  username: string;

  @IsOptional()
  @IsString()
  password?: string;

  @IsEmail()
  fromEmail: string;

  @IsString()
  fromName: string;
}

class TestDto {
  @IsEmail()
  to: string;
}

@Controller('smtp')
@UseGuards(JwtAuthGuard)
export class SmtpController {
  constructor(private smtp: SmtpService) {}

  @Get()
  get() {
    return this.smtp.get();
  }

  @Get('quota')
  quota() {
    return this.smtp.quota();
  }

  @Post()
  save(@Body() body: SaveSmtpDto) {
    return this.smtp.save(body);
  }

  @Post('test')
  test(@Body() body: TestDto) {
    return this.smtp.sendTest(body.to);
  }
}
