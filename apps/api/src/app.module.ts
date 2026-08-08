import { Module } from '@nestjs/common';
import type { NestModule, MiddlewareConsumer } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { HealthController } from './health.controller';
import { DatabaseModule } from './database/database.module';
import { VacancyCoreModule } from './vacancy-core/vacancy-core.module';
import { CommonModule } from './common/common.module';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { RolesModule } from './roles/roles.module';
import { MasterDataModule } from './master-data/master-data.module';
import { AuditModule } from './audit/audit.module';
import { CandidatesModule } from './candidates/candidates.module';
import { ApplicationsModule } from './applications/applications.module';
import { DocumentsModule } from './documents/documents.module';
import { ScreeningModule } from './screening/screening.module';
import { InterviewsModule } from './interviews/interviews.module';
import { OffersModule } from './offers/offers.module';
import { HiringModule } from './hiring/hiring.module';
import { TalentPoolModule } from './talent-pool/talent-pool.module';
import { ImportModule } from './import/import.module';
import { ReportsModule } from './reports/reports.module';
import { PipelineSettingsModule } from './pipeline-settings/pipeline-settings.module';
import { IntegrationsModule } from './integrations/integrations.module';
import { NotificationsModule } from './notifications/notifications.module';
import { TasksModule } from './tasks/tasks.module';
import { CorrelationIdMiddleware } from './common/middleware/correlation-id.middleware';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    DatabaseModule,
    VacancyCoreModule,
    CommonModule,
    AuthModule,
    UsersModule,
    RolesModule,
    MasterDataModule,
    AuditModule,
    CandidatesModule,
    ApplicationsModule,
    DocumentsModule,
    ScreeningModule,
    InterviewsModule,
    OffersModule,
    HiringModule,
    TalentPoolModule,
    ImportModule,
    ReportsModule,
    PipelineSettingsModule,
    IntegrationsModule,
    NotificationsModule,
    TasksModule,
  ],
  controllers: [HealthController],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(CorrelationIdMiddleware).forRoutes('*');
  }
}
