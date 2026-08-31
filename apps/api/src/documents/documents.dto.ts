import { IsDateString, IsIn, IsInt, IsOptional, IsString, IsUUID, Max, MaxLength, Min } from 'class-validator';

export class UploadCandidateDocumentDto {
  @IsUUID()
  candidateId!: string;

  @IsString()
  @MaxLength(60)
  documentType!: string;

  @IsString()
  @MaxLength(255)
  fileName!: string;

  @IsString()
  @MaxLength(100)
  mimeType!: string;

  @IsInt()
  @Min(1)
  @Max(10 * 1024 * 1024)
  fileSize!: number;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  storageKey?: string;

  @IsOptional()
  @IsString()
  extractionText?: string | null;
}

export class UploadCandidateFileDto {
  @IsUUID()
  candidateId!: string;

  @IsString()
  @MaxLength(60)
  documentType!: string;

  @IsOptional()
  @IsString()
  extractionText?: string | null;
}

export class UpdateDocumentRetentionDto {
  @IsOptional()
  @IsIn(['Unknown', 'Active', 'Expired', 'Withdrawn'])
  consentStatus?: string;

  @IsOptional()
  @IsDateString()
  retentionExpiresAt?: string | null;
}

export class ArchiveCandidateDocumentDto {
  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;
}
