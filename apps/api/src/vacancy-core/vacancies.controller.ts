import { Controller, Get } from '@nestjs/common';
// The service class is needed at runtime for Nest dependency metadata.
/* eslint-disable @typescript-eslint/consistent-type-imports */
import { VacancyCoreService } from './vacancy-core.service';
/* eslint-enable @typescript-eslint/consistent-type-imports */

@Controller('vacancies')
export class VacanciesController {
  constructor(private readonly vacancyCoreService: VacancyCoreService) {}

  @Get()
  listVacancies() {
    return this.vacancyCoreService.listVacancies();
  }
}
