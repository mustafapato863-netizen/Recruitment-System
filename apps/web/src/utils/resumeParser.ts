import type {
  ExtractedCandidate,
  CandidateWorkExperienceItem,
  CandidateEducationItem,
  CandidateProjectItem,
  CandidateEvidenceChunk,
} from '@recruitflow/contracts';
import { extractCandidateFromText } from '@recruitflow/validation';

export type {
  ExtractedCandidate,
  CandidateWorkExperienceItem,
  CandidateEducationItem,
  CandidateProjectItem,
  CandidateEvidenceChunk,
};

// Re-export all parsing constants, taxonomy, and functions from @recruitflow/validation
export * from '@recruitflow/validation';

/**
 * Extract raw text from PDF ArrayBuffer
 */
async function extractTextFromPdf(arrayBuffer: ArrayBuffer): Promise<string> {
  try {
    const pdfjsLib = await import('pdfjs-dist');
    if (!pdfjsLib.GlobalWorkerOptions.workerSrc) {
      try {
        pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
          'pdfjs-dist/build/pdf.worker.min.mjs',
          import.meta.url,
        ).toString();
      } catch {
        // Fallback
      }
    }
    const loadingTask = pdfjsLib.getDocument({ data: new Uint8Array(arrayBuffer) });
    const pdf = await loadingTask.promise;
    const textPieces: string[] = [];

    for (let pageNum = 1; pageNum <= pdf.numPages; pageNum += 1) {
      const page = await pdf.getPage(pageNum);
      const textContent = await page.getTextContent();
      let pageText = '';
      let lastY: number | null = null;

      for (const item of textContent.items) {
        if (!('str' in item) || typeof (item as { str: unknown }).str !== 'string') continue;
        const textItem = item as { str: string; transform?: number[]; hasEOL?: boolean };
        const currentY = textItem.transform ? textItem.transform[5] : null;

        if (lastY !== null && currentY !== null && Math.abs(currentY - lastY) > 3) {
          pageText += '\n';
        } else if (textItem.hasEOL) {
          pageText += '\n';
        } else if (
          pageText.length > 0 &&
          !pageText.endsWith('\n') &&
          !pageText.endsWith(' ') &&
          !textItem.str.startsWith(' ')
        ) {
          pageText += ' ';
        }

        pageText += textItem.str;
        if (textItem.hasEOL && !pageText.endsWith('\n')) {
          pageText += '\n';
        }

        if (currentY !== null) {
          lastY = currentY;
        }
      }

      textPieces.push(pageText);
    }

    return textPieces.join('\n\n');
  } catch (error) {
    console.warn('PDF.js extraction failed, attempting stream scan fallback:', error);
    const decoder = new TextDecoder('utf-8', { fatal: false });
    const text = decoder.decode(arrayBuffer);
    return text.replace(/[^\x20-\x7E\n\r]/g, ' ');
  }
}

/**
 * Extract raw text from Word (.docx) ArrayBuffer using JSZip with mammoth fallback
 */
async function extractTextFromDocx(arrayBuffer: ArrayBuffer): Promise<string> {
  try {
    const JSZipModule = await import('jszip');
    const JSZip = JSZipModule.default ?? JSZipModule;
    const zip = await JSZip.loadAsync(arrayBuffer);
    const docXmlFile = zip.file('word/document.xml');
    if (docXmlFile) {
      const xml = await docXmlFile.async('string');
      const formatted = xml
        .replace(/<w:tab\s*\/?>/g, '\t')
        .replace(/<w:br\s*\/?>/g, '\n')
        .replace(/<\/w:tc>\s*<w:tc[^>]*>/g, ': ')
        .replace(/<\/w:tr>/g, '\n')
        .replace(/<\/w:p>/g, '\n')
        .replace(/<[^>]+>/g, '')
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"')
        .replace(/&apos;/g, "'")
        .replace(/&#160;|&nbsp;/g, ' ')
        .replace(/\n\s*\n+/g, '\n\n')
        .trim();
      if (formatted.length > 50) {
        return formatted;
      }
    }
  } catch (error) {
    console.warn('JSZip docx extraction failed, trying mammoth fallback:', error);
  }

  try {
    const mammothModule = await import('mammoth');
    const mammoth = mammothModule.default ?? mammothModule;
    const result = await mammoth.extractRawText({ arrayBuffer });
    if (result.value?.trim()) {
      return result.value;
    }
  } catch (error) {
    console.warn('Mammoth docx extraction failed:', error);
  }

  const decoder = new TextDecoder('utf-8', { fatal: false });
  return decoder.decode(arrayBuffer).replace(/[^\x20-\x7E\n\r]/g, ' ');
}

/**
 * Main entrypoint to parse candidate files (PDF & Word)
 */
export async function parseResumeFile(file: File): Promise<ExtractedCandidate> {
  const arrayBuffer = await file.arrayBuffer();
  const fileNameLower = file.name.toLowerCase();
  let text: string;

  if (fileNameLower.endsWith('.pdf')) {
    text = await extractTextFromPdf(arrayBuffer);
  } else if (fileNameLower.endsWith('.docx') || fileNameLower.endsWith('.doc')) {
    text = await extractTextFromDocx(arrayBuffer);
  } else {
    const decoder = new TextDecoder('utf-8', { fatal: false });
    text = decoder.decode(arrayBuffer);
  }

  return extractCandidateFromText(text, file.name);
}
