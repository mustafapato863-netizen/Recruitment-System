import {
  Body,
  Controller,
  Get,
  Header,
  HttpCode,
  HttpStatus,
  Param,
  Post,
} from '@nestjs/common';
/* eslint-disable @typescript-eslint/consistent-type-imports */
import { SelfScheduleService } from './self-schedule.service';
import { PublicBookScheduleDto } from './interviews.dto';
/* eslint-enable @typescript-eslint/consistent-type-imports */
import { Public } from '../common/decorators/public.decorator';

@Public()
@Controller('public/interviews')
export class PublicInterviewsController {
  constructor(private readonly selfScheduleService: SelfScheduleService) {}

  @Get('schedule/:token')
  @Header('Cache-Control', 'no-store, no-cache, must-revalidate')
  getInvitationView(@Param('token') token: string) {
    return this.selfScheduleService.getInvitationView(token);
  }

  @Post('schedule/:token')
  @HttpCode(HttpStatus.CREATED)
  bookSelfSchedule(
    @Param('token') token: string,
    @Body() body: PublicBookScheduleDto,
  ) {
    return this.selfScheduleService.bookSelfSchedule(token, {
      selectedSlot: body.selectedSlot,
      timezone: body.timezone || 'Asia/Riyadh',
      candidateNotes: body.candidateNotes,
    });
  }
}
