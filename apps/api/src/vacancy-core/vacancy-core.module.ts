import { Module } from '@nestjs/common';
import { InMemoryVacancyCoreRepository } from './in-memory-vacancy-core.repository';
import { VACANCY_CORE_REPOSITORY } from './vacancy-core.repository';
import { VacancyCoreService } from './vacancy-core.service';
import { VacancyRequestsController } from './vacancy-requests.controller';
import { VacanciesController } from './vacancies.controller';

@Module({
  controllers: [VacancyRequestsController, VacanciesController],
  providers: [
    VacancyCoreService,
    InMemoryVacancyCoreRepository,
    {
      provide: VACANCY_CORE_REPOSITORY,
      useExisting: InMemoryVacancyCoreRepository,
    },
  ],
})
export class VacancyCoreModule {}
