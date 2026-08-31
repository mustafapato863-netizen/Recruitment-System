import {
  Body,
  Controller,
  Get,
  Header,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Query,
  Req,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
// DTO classes must remain runtime imports for Nest validation metadata.
/* eslint-disable @typescript-eslint/consistent-type-imports */
import { PublicJobsService } from './public-jobs.service';
import { PublicApplicationDto, PublicJobQueryDto } from './public-jobs.dto';
/* eslint-enable @typescript-eslint/consistent-type-imports */
import { Public } from '../common/decorators/public.decorator';
import type { Request } from 'express';

type UploadedPublicFile = { buffer: Buffer; originalname: string; mimetype: string; size: number };

@Public()
@Controller('public/organizations/:organizationCode/jobs')
export class PublicJobsController {
  constructor(private readonly publicJobsService: PublicJobsService) {}

  @Get()
  @Header('Cache-Control', 'public, max-age=60, stale-while-revalidate=300')
  listJobs(
    @Param('organizationCode') organizationCode: string,
    @Query() query: PublicJobQueryDto,
  ) {
    return this.publicJobsService.listJobs(organizationCode, query);
  }

  @Get(':vacancyCode')
  @Header('Cache-Control', 'public, max-age=60, stale-while-revalidate=300')
  getJob(
    @Param('organizationCode') organizationCode: string,
    @Param('vacancyCode') vacancyCode: string,
  ) {
    return this.publicJobsService.getJob(organizationCode, vacancyCode);
  }

  @Post(':vacancyCode/apply')
  @HttpCode(HttpStatus.CREATED)
  @UseInterceptors(FileInterceptor('cv', { limits: { fileSize: 10 * 1024 * 1024 } }))
  apply(
    @Param('organizationCode') organizationCode: string,
    @Param('vacancyCode') vacancyCode: string,
    @Body() body: PublicApplicationDto,
    @UploadedFile() cv: UploadedPublicFile | undefined,
    @Req() request: Request,
  ) {
    return this.publicJobsService.apply(
      organizationCode,
      vacancyCode,
      body,
      clientIpOf(request),
      cv,
    );
  }
}

function clientIpOf(request: Request): string | undefined {
  return request.ip || request.socket?.remoteAddress || undefined;
}
