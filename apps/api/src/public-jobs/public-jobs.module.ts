import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { DatabaseModule } from '../database/database.module';
import { DocumentsModule } from '../documents/documents.module';
import { CandidatePortalController } from './candidate-portal.controller';
import { CandidatePortalService } from './candidate-portal.service';
import { PublicJobsController } from './public-jobs.controller';
import { PublicJobsService } from './public-jobs.service';

@Module({
  imports: [DatabaseModule, AuthModule, DocumentsModule],
  controllers: [PublicJobsController, CandidatePortalController],
  providers: [PublicJobsService, CandidatePortalService],
})
export class PublicJobsModule {}
