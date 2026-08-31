import { Injectable } from '@nestjs/common';

export type DocumentScanResult = {
  status: 'Clean' | 'Rejected';
  provider: string;
  message: string;
};

const EICAR_SIGNATURE = Buffer.from('X5O!P%@AP[4\\PZX54(P^)7CC)7}$EICAR-STANDARD-ANTIVIRUS-TEST-FILE!$H+H*');

@Injectable()
export class DocumentScannerService {
  scan(file: Buffer, fileName: string, mimeType: string): DocumentScanResult {
    const extension = fileName.toLowerCase().split('.').pop();
    const signature = file.subarray(0, 8);
    const isPdf = extension === 'pdf' && mimeType === 'application/pdf' && signature.subarray(0, 5).toString() === '%PDF-';
    const isDoc = extension === 'doc' && mimeType === 'application/msword' && Buffer.from([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]).equals(signature);
    const isDocx = extension === 'docx'
      && mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
      && signature.subarray(0, 4).equals(Buffer.from([0x50, 0x4b, 0x03, 0x04]));

    if (!isPdf && !isDoc && !isDocx) {
      return { status: 'Rejected', provider: 'signature', message: 'The file extension, MIME type, and binary signature do not agree.' };
    }
    if (file.includes(EICAR_SIGNATURE)) {
      return { status: 'Rejected', provider: 'signature', message: 'The file matched the standard antivirus test signature.' };
    }
    if (isDocx && file.includes(Buffer.from('vbaProject.bin'))) {
      return { status: 'Rejected', provider: 'signature', message: 'Macro-enabled document content is not accepted.' };
    }

    return { status: 'Clean', provider: 'signature', message: 'Binary signature and malware test-signature checks passed.' };
  }
}
