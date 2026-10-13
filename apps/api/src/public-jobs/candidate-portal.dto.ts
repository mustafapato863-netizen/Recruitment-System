import { IsString, MaxLength, MinLength } from 'class-validator';

export class PortalContactDto {
  @IsString()
  @MinLength(2)
  @MaxLength(80)
  name!: string;

  @IsString()
  @MinLength(2)
  @MaxLength(500)
  message!: string;
}

export class PortalUploadDto {
  @IsString()
  @MinLength(2)
  @MaxLength(60)
  documentType!: string;
}
