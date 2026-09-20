import { Injectable, Logger } from '@nestjs/common';
/* eslint-disable @typescript-eslint/consistent-type-imports */
import { ConfigService } from '@nestjs/config';
/* eslint-enable @typescript-eslint/consistent-type-imports */

export interface UploadedResumeFile {
  buffer: Buffer;
  originalname: string;
  mimetype: string;
  size?: number;
}

@Injectable()
export class AffindaResumeParser {
  private readonly logger = new Logger(AffindaResumeParser.name);

  constructor(private readonly configService: ConfigService) {}

  /**
   * Upload and parse a resume file with the Affinda Resume Parser API:
   * POST /v1/resumes/parse
   *
   * Fully synchronous, stateless, no polling, no v3 document API, no required workspace.
   */
  async parse(file: UploadedResumeFile): Promise<Record<string, unknown>> {
    const apiKey = this.configService.get<string>('AFFINDA_API_KEY');
    if (!apiKey) {
      throw new Error('AFFINDA_API_KEY is not configured on the server.');
    }

    const apiUrl =
      this.configService.get<string>('AFFINDA_API_URL') ||
      'https://resume-parser.affinda.com/v1/resumes/parse';

    this.logger.log(
      `Sending file "${file.originalname}" (${file.buffer.length} bytes) to Affinda at ${apiUrl}`,
    );

    const formData = new FormData();
    const fileBlob = new Blob([new Uint8Array(file.buffer)], {
      type: file.mimetype || 'application/octet-stream',
    });
    formData.append('file', fileBlob, file.originalname);

    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
      },
      body: formData,
    });

    if (!response.ok) {
      let errorDetail: string;
      try {
        const errorJson = (await response.json()) as Record<string, unknown>;
        errorDetail = JSON.stringify(errorJson);
      } catch {
        errorDetail = await response.text().catch(() => '');
      }
      this.logger.error(`Affinda API returned status ${response.status}: ${errorDetail}`);
      throw new Error(
        `Affinda API failed with status ${response.status}: ${errorDetail || response.statusText}`,
      );
    }

    const result = (await response.json()) as Record<string, unknown>;
    return result;
  }
}
