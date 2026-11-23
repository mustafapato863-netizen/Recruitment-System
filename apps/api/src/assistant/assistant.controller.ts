import { Body, Controller, Get, Post, Query, UseGuards } from '@nestjs/common';
import type { AuthUser } from '@recruitflow/contracts';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { TenantScopedGuard } from '../common/guards/tenant-scoped.guard';
/* eslint-disable @typescript-eslint/consistent-type-imports */
import { AssistantAskDto, AssistantSuggestionsQueryDto } from './assistant.dto';
import { AssistantService } from './assistant.service';
/* eslint-enable @typescript-eslint/consistent-type-imports */

@Controller('assistant')
@UseGuards(TenantScopedGuard)
export class AssistantController {
  constructor(private readonly assistantService: AssistantService) {}

  @Get('suggestions')
  getSuggestions(
    @CurrentUser() user: AuthUser,
    @Query() query: AssistantSuggestionsQueryDto,
  ) {
    return this.assistantService.getSuggestions(user, query);
  }

  @Post('ask')
  ask(
    @CurrentUser() user: AuthUser,
    @Body() body: AssistantAskDto,
  ) {
    return this.assistantService.ask(user, body);
  }
}
