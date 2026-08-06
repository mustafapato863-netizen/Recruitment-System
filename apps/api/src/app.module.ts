import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { HealthController } from './health.controller';
import { VacancyCoreModule } from './vacancy-core/vacancy-core.module';

@Module({
  imports: [ConfigModule.forRoot({ isGlobal: true }), VacancyCoreModule],
  controllers: [HealthController],
})
export class AppModule {}
