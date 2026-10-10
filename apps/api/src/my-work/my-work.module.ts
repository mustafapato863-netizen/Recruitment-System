import { Module } from '@nestjs/common';
import { DatabaseModule } from '../database/database.module';
import { MyWorkController } from './my-work.controller';
import { MyWorkService } from './my-work.service';

@Module({
  imports: [DatabaseModule],
  controllers: [MyWorkController],
  providers: [MyWorkService],
})
export class MyWorkModule {}
