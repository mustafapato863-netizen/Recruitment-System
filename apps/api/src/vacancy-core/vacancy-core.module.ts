import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../database/prisma.service';
import { InMemoryVacancyCoreRepository } from './in-memory-vacancy-core.repository';
import { PrismaVacancyCoreRepository } from './prisma-vacancy-core.repository';
import { VACANCY_CORE_REPOSITORY } from './vacancy-core.repository';
import { VacancyCoreService } from './vacancy-core.service';
import { VacancyRequestsController } from './vacancy-requests.controller';
import { VacanciesController } from './vacancies.controller';
import { NotificationsModule } from '../notifications/notifications.module';
import { DatabaseModule } from '../database/database.module';
import { AccessControlModule } from '../access-control/access-control.module';
import { MasterDataModule } from '../master-data/master-data.module';
import { DocumentsModule } from '../documents/documents.module';
import { ResumeModule } from '../resume/resume.module';
import { JdParserService } from './jd-parser.service';
import { VacancyDocumentsService } from './vacancy-documents.service';

@Module({
  imports: [DatabaseModule, NotificationsModule, AccessControlModule, MasterDataModule, DocumentsModule, ResumeModule],
  controllers: [VacancyRequestsController, VacanciesController],
  providers: [
    VacancyCoreService,
    VacancyDocumentsService,
    JdParserService,
    PrismaService,
    InMemoryVacancyCoreRepository,
    PrismaVacancyCoreRepository,
    {
      provide: VACANCY_CORE_REPOSITORY,
      inject: [
        ConfigService,
        InMemoryVacancyCoreRepository,
        PrismaVacancyCoreRepository,
      ],
      useFactory: (
        config: ConfigService,
        inMemoryRepository: InMemoryVacancyCoreRepository,
        prismaRepository: PrismaVacancyCoreRepository,
      ) => {
        const adapter = config.get<string>(
          'VACANCY_CORE_ADAPTER',
          'prisma',
        );

        if (adapter === 'in-memory') {
          return inMemoryRepository;
        }

        if (adapter === 'prisma') {
          return prismaRepository;
        }

        throw new Error(
          `Unsupported VACANCY_CORE_ADAPTER value: ${adapter}. Use in-memory or prisma.`,
        );
      },
    },
  ],
  exports: [VacancyCoreService, VacancyDocumentsService, JdParserService],
})
export class VacancyCoreModule {}
