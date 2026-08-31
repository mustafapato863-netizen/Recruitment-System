import { Module } from '@nestjs/common';
import { AuthService } from './auth.service';
import { RateLimiterService } from './rate-limiter.service';
import { AuthController } from './auth.controller';
import { MeController } from './me.controller';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { JwtStrategy } from './strategies/jwt.strategy';
import { JwtRefreshStrategy } from './strategies/jwt-refresh.strategy';
import { DatabaseModule } from '../database/database.module';
import { EmailModule } from '../email/email.module';

@Module({
  imports: [
    DatabaseModule,
    PassportModule,
    JwtModule.register({}),
    EmailModule,
  ],
  controllers: [AuthController, MeController],
  providers: [AuthService, RateLimiterService, JwtStrategy, JwtRefreshStrategy],
  exports: [RateLimiterService, AuthService],
})
export class AuthModule {}
