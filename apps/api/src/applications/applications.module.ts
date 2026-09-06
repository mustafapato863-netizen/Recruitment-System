import { Module } from '@nestjs/common';
import { ApplicationsController } from './applications.controller';
import { ApplicationsService } from './applications.service';
import { DatabaseModule } from '../database/database.module';
import { EmailModule } from '../email/email.module';
import { EmailTemplatesModule } from '../email-templates/email-templates.module';

@Module({
  imports: [DatabaseModule, EmailModule, EmailTemplatesModule],
  controllers: [ApplicationsController],
  providers: [ApplicationsService],
  exports: [ApplicationsService],
})
export class ApplicationsModule {}
