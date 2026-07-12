import { PDFParse } from "pdf-parse";

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
    
    // pdf-parse v2.4.5 usage
    const parser = new PDFParse({ data: buffer });
    const textResult = await parser.getText();
    
    return textResult.text;
  } catch (error) {
    console.error("Error extracting text from PDF:", error);
    throw new Error("Failed to extract text from PDF");
  }
}
