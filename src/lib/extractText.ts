// eslint-disable-next-line @typescript-eslint/no-require-imports
const pdfParse = require("pdf-parse/lib/pdf-parse.js");

/**
 * Extracts text from a File object containing a PDF.
 * This function should only be called on the server side (e.g., inside Next.js API Routes).
 * 
 * @param file The PDF File object from FormData
 * @returns A promise that resolves to the extracted text
 */
export async function extractFromPdf(file: File): Promise<string> {
  try {
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const data = await pdfParse(buffer);
    return data.text;
  } catch (error) {
    console.error("Error extracting text from PDF:", error);
    throw new Error("Failed to extract text from PDF");
  }
}
