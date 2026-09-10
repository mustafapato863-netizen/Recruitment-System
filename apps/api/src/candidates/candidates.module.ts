import { Module } from '@nestjs/common';
import { CandidatesController } from './candidates.controller';
import { CandidatesService } from './candidates.service';
import { DatabaseModule } from '../database/database.module';
import { CommonModule } from '../common/common.module';
import { AccessControlModule } from '../access-control/access-control.module';
import { CandidateActivityService } from './candidate-activity.service';
import { DocumentsModule } from '../documents/documents.module';

@Module({
  imports: [DatabaseModule, CommonModule, AccessControlModule, DocumentsModule],
  controllers: [CandidatesController],
  providers: [CandidatesService, CandidateActivityService],
  exports: [CandidatesService],
})
export class CandidatesModule {}
