import {
  Controller,
  Post,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RequirePermissions } from '../common/decorators/require-permissions.decorator';
import { AuditAction } from '../common/decorators/audit-action.decorator';
import { fileInvalid } from '../common/errors/api-error';
/* eslint-disable @typescript-eslint/consistent-type-imports */
import { ResumeParsingService } from './resume-parsing.service';
/* eslint-enable @typescript-eslint/consistent-type-imports */
import type { ExtractedCandidate } from '@recruitflow/contracts';

type UploadedFileParam = {
  buffer: Buffer;
  originalname: string;
  mimetype: string;
  size: number;
};

const ALLOWED_EXTENSIONS = ['.pdf', '.doc', '.docx'];

@UseGuards(JwtAuthGuard)
@Controller('resume')
export class ResumeController {
  constructor(private readonly resumeParsingService: ResumeParsingService) {}

  @Post('parse')
  @RequirePermissions('CANDIDATE_EDIT')
  @AuditAction('RESUME_PARSE')
  @UseInterceptors(
    FileInterceptor('file', {
      limits: { fileSize: 10 * 1024 * 1024 }, // 10 MB
    }),
  )
  async parseResume(
    @UploadedFile() file: UploadedFileParam | undefined,
  ): Promise<ExtractedCandidate> {
    if (!file?.buffer?.length) {
      throw fileInvalid('Please attach a CV file in the file field.');
    }

    const lowerName = file.originalname.toLowerCase();
    const isAllowed = ALLOWED_EXTENSIONS.some((ext) => lowerName.endsWith(ext));
    if (!isAllowed) {
      throw fileInvalid(
        'Invalid document format. Please upload a PDF (.pdf) or Word (.doc, .docx) document.',
      );
    }

    return this.resumeParsingService.parseResume(file);
  }
}
