import { Module } from '@nestjs/common';
import { UsersService } from './users.service';
import { UsersController } from './users.controller';
import { DatabaseModule } from '../database/database.module';
import { AuthModule } from '../auth/auth.module';
import { RolesModule } from '../roles/roles.module';

@Module({
  imports: [DatabaseModule, AuthModule, RolesModule],
  controllers: [UsersController],
  providers: [UsersService],
})
export class UsersModule {}
