declare module 'pdf-parse' {
  interface PdfData {
    /** Number of pages in the PDF */
    numpages: number;
    /** Number of rendered pages */
    numrender: number;
    /** PDF info object (author, title, etc.) */
    info: Record<string, unknown>;
    /** PDF metadata */
    metadata: unknown;
    /** PDF version */
    version: string;
    /** Extracted text content */
    text: string;
  }

  type PdfParseOptions = Record<string, unknown>;

  function pdfParse(buffer: Buffer, options?: PdfParseOptions): Promise<PdfData>;

  export = pdfParse;
}
