import { Body, Controller, Delete, Get, Param, ParseIntPipe, Patch, Post, UseGuards } from '@nestjs/common';
import { IsString, MinLength } from 'class-validator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PrismaService } from '../prisma.service';

class SaveTemplateDto {
  @IsString()
  @MinLength(1)
  name: string;

  @IsString()
  @MinLength(1)
  html: string;
}

@Controller('templates')
@UseGuards(JwtAuthGuard)
export class TemplatesController {
  constructor(private prisma: PrismaService) {}

  @Get()
  list() {
    return this.prisma.emailTemplate.findMany({ orderBy: { id: 'desc' } });
  }

  @Post()
  create(@Body() body: SaveTemplateDto) {
    return this.prisma.emailTemplate.create({ data: body });
  }

  @Patch(':id')
  update(@Param('id', ParseIntPipe) id: number, @Body() body: SaveTemplateDto) {
    return this.prisma.emailTemplate.update({ where: { id }, data: body });
  }

  @Delete(':id')
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.prisma.emailTemplate.delete({ where: { id } });
  }
}
