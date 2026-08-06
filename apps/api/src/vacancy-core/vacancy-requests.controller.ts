import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
} from '@nestjs/common';
// DTO classes must remain runtime imports so Nest can reflect their metadata.
/* eslint-disable @typescript-eslint/consistent-type-imports */
import { CreateVacancyRequestDto, VacancyRequestActionDto } from './vacancy-core.dto';
import { VacancyCoreService } from './vacancy-core.service';
/* eslint-enable @typescript-eslint/consistent-type-imports */

@Controller('vacancy-requests')
export class VacancyRequestsController {
  constructor(private readonly vacancyCoreService: VacancyCoreService) {}

  @Get('context')
  getContext() {
    return this.vacancyCoreService.getContext();
  }

  @Get()
  listRequests() {
    return this.vacancyCoreService.listRequests();
  }

  @Post()
  createRequest(@Body() body: CreateVacancyRequestDto) {
    return this.vacancyCoreService.createRequest(body);
  }

  @Post(':id/submit')
  @HttpCode(HttpStatus.OK)
  submitRequest(
    @Param('id') id: string,
    @Body() body: VacancyRequestActionDto,
  ) {
    return this.vacancyCoreService.submitRequest(id, body);
  }

  @Post(':id/approve')
  @HttpCode(HttpStatus.OK)
  approveRequest(
    @Param('id') id: string,
    @Body() body: VacancyRequestActionDto,
  ) {
    return this.vacancyCoreService.approveRequest(id, body);
  }

  @Post(':id/request-changes')
  @HttpCode(HttpStatus.OK)
  requestChanges(
    @Param('id') id: string,
    @Body() body: VacancyRequestActionDto,
  ) {
    return this.vacancyCoreService.requestChanges(id, body);
  }

  @Post(':id/reject')
  @HttpCode(HttpStatus.OK)
  rejectRequest(
    @Param('id') id: string,
    @Body() body: VacancyRequestActionDto,
  ) {
    return this.vacancyCoreService.rejectRequest(id, body);
  }

  @Post(':id/convert')
  @HttpCode(HttpStatus.OK)
  convertToVacancy(@Param('id') id: string) {
    return this.vacancyCoreService.convertToVacancy(id);
  }
}
