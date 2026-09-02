import { Controller, Get, Query } from '@nestjs/common';
/* eslint-disable @typescript-eslint/consistent-type-imports */
import { SearchService } from './search.service';
import { GlobalSearchQueryDto } from './search.dto';
/* eslint-enable @typescript-eslint/consistent-type-imports */
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { AuthUser } from '@recruitflow/contracts';

@Controller('search')
export class SearchController {
  constructor(private readonly searchService: SearchService) {}

  @Get()
  search(@CurrentUser() user: AuthUser, @Query() query: GlobalSearchQueryDto) {
    return this.searchService.search(user, query.q, query.limit);
  }
}
