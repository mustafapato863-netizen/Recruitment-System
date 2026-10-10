import { ApplicationFileController } from './application-file.controller';
import { ApplicationFileService } from './application-file.service';
import { Module } from '@nestjs/common';
import { ApplicationsController } from './applications.controller';
import { ApplicationsService } from './applications.service';
import { DatabaseModule } from '../database/database.module';
import { EmailModule } from '../email/email.module';
import { EmailTemplatesModule } from '../email-templates/email-templates.module';
import { AccessControlModule } from '../access-control/access-control.module';

@Module({
  imports: [DatabaseModule, EmailModule, EmailTemplatesModule, AccessControlModule],
  controllers: [ApplicationsController, ApplicationFileController],
  providers: [ApplicationsService, ApplicationFileService],
  exports: [ApplicationsService],
})
export class ApplicationsModule {}
