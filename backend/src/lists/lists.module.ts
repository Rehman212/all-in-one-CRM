import { Module } from '@nestjs/common';
import { ListsController } from './lists.controller';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [AuthModule],
  controllers: [ListsController],
})
export class ListsModule {}
