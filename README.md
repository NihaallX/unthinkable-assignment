# Document Summary Assistant

## Executive Summary
The Document Summary Assistant is an intelligent web application designed to streamline information extraction. By enabling users to upload PDF documents or image scans, the system instantly generates structured summaries and key takeaways, tailored to the user's preferred length.

## Technology Stack
- **Frontend Framework**: Next.js 14 (App Router)
- **Language**: TypeScript
- **Styling**: Tailwind CSS
- **PDF Processing**: `pdf-parse` (Server-side Buffer Parsing)
- **Artificial Intelligence**: Groq API
  - **Vision/OCR Engine**: `meta-llama/llama-4-scout-17b-16e-instruct`
  - **Summarization Engine**: `llama-3.3-70b-versatile`

## Architecture & Technical Approach
To optimize for speed and architectural separation of concerns, the text extraction and summarization workflows were decoupled into discrete backend API routes. 

For digital PDFs, extraction is handled entirely server-side using the `pdf-parse` library, providing robust, localized processing. Conversely, image-based documents are converted to base64 format and routed to Groq's high-performance `meta-llama/llama-4-scout-17b-16e-instruct` model, which functions as an intelligent OCR engine to accurately transcribe visually embedded text.

Once the raw text is secured, a secondary pipeline engages Groq's `llama-3.3-70b-versatile` model. Groq was strategically selected as the LLM provider over alternatives due to its specialized LPU (Language Processing Unit) architecture. This hardware advantage delivers ultra-low latency inference, which is critical for maintaining an immediate, responsive user experience during complex multi-stage AI operations.

Given the 8-hour development constraint, state management was kept entirely localized within React (`useState`), bypassing heavy global stores like Redux. Furthermore, persistent file storage was eschewed in favor of in-memory buffer processing during the Next.js API lifecycle. This tradeoff removes the overhead of managing cloud buckets (e.g., AWS S3) and orphaned files, though it intentionally limits the application to processing files small enough to fit in memory.

## Known Limitations
- **OCR Constraints**: Extracting text from highly stylized fonts, handwritten notes, or heavily degraded image scans may yield hallucinated or garbled outputs from the vision model.
- **Context Window Truncation**: To respect the LLM's context window limits and manage token overhead, extracted text exceeding ~12,000 characters is automatically truncated prior to summarization. Summaries for extremely large documents will only reflect the beginning portion of the text.
- **In-Memory Payloads**: The Next.js API routes impose memory limits on payloads. To ensure server stability, a strict 10MB file size limit is enforced on the client side.
