import { Module } from '@nestjs/common';
import { TemplatesController } from './templates.controller';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [AuthModule],
  controllers: [TemplatesController],
})
export class TemplatesModule {}
