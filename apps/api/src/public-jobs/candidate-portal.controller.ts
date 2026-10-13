import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
// DTO classes must remain runtime imports for Nest validation metadata.
/* eslint-disable @typescript-eslint/consistent-type-imports */
import { CandidatePortalService } from './candidate-portal.service';
import { PortalContactDto, PortalUploadDto } from './candidate-portal.dto';
/* eslint-enable @typescript-eslint/consistent-type-imports */
import { Public } from '../common/decorators/public.decorator';

type PortalFile = { buffer: Buffer; originalname: string; mimetype: string; size: number };

function decodeToken(token: string): string {
  try { return decodeURIComponent(token); } catch { return token; }
}

@Public()
@Controller('public/portal')
export class CandidatePortalController {
  constructor(private readonly portal: CandidatePortalService) {}

  @Post('contact')
  @HttpCode(HttpStatus.OK)
  contact(@Body() body: PortalContactDto) {
    return this.portal.contact(body.name, body.message);
  }

  @Get(':token')
  view(@Param('token') token: string) {
    return this.portal.view(decodeToken(token));
  }

  @Get(':token/documents/:documentId')
  fileStatus(
    @Param('token') token: string,
    @Param('documentId', ParseUUIDPipe) documentId: string,
  ) {
    return this.portal.fileStatus(decodeToken(token), documentId);
  }

  @Post(':token/revoke')
  @HttpCode(HttpStatus.OK)
  revoke(@Param('token') token: string) {
    return this.portal.revoke(decodeToken(token));
  }

  @Post(':token/documents')
  @HttpCode(HttpStatus.CREATED)
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: 2 * 1024 * 1024 } }))
  upload(
    @Param('token') token: string,
    @Body() body: PortalUploadDto,
    @UploadedFile() file: PortalFile | undefined,
  ) {
    return this.portal.upload(decodeToken(token), body.documentType, file);
  }
}
