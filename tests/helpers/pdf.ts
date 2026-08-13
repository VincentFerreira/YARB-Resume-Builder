import { PDFParse } from 'pdf-parse';

export interface ParsedPdf {
  text: string;
  numPages: number;
}

const PDF_MAGIC_BYTES = '%PDF';

export function hasPdfMagicBytes(buffer: Buffer): boolean {
  return buffer.subarray(0, 4).toString('latin1') === PDF_MAGIC_BYTES;
}

export async function readPdf(buffer: Buffer): Promise<ParsedPdf> {
  if (!hasPdfMagicBytes(buffer)) {
    throw new Error('Not a valid PDF: missing %PDF magic bytes');
  }
  const parser = new PDFParse({ data: buffer });
  try {
    const result = await parser.getText();
    return { text: result.text, numPages: result.total };
  } finally {
    await parser.destroy();
  }
}
