![Next.js](https://img.shields.io/badge/Next.js-black?style=flat&logo=next.js)
![TypeScript](https://img.shields.io/badge/TypeScript-007ACC?style=flat&logo=typescript&logoColor=white)
![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-38B2AC?style=flat&logo=tailwind-css&logoColor=white)
![Groq](https://img.shields.io/badge/Groq-F55036?style=flat)
![Vercel](https://img.shields.io/badge/Vercel-000000?style=flat&logo=vercel&logoColor=white)

Extracts text from documents and provides length-adjustable summaries alongside a document-grounded Q&A assistant.

## What it does

- Accepts PDF and image file uploads via a full-screen drag-and-drop interface.
- Extracts raw text using native PDF parsing or Vision-based OCR for images.
- Generates a structured summary based on user-selected length (short, medium, or long).
- Identifies and lists distinct key points from the text.
- Analyzes the document to provide structural or contextual improvement suggestions.
- Includes a dedicated Q&A chatbot that answers questions based solely on the extracted document, featuring auto-generated suggested questions and verbatim text citations.

## Tech Stack

| Layer | Tech |
|---|---|
| Frontend | Next.js 14 (App Router) |
| Language | TypeScript |
| Styling | Tailwind CSS |
| PDF Extraction | `pdf-parse` |
| AI / OCR | Groq API |
| Deployment | Vercel |

## Features Checklist

| Feature | Status |
|---|---|
| PDF parsing | ✅ |
| Image OCR extraction | ✅ |
| Full-screen drag-and-drop upload | ✅ |
| Adjustable summary lengths | ✅ |
| Key points extraction | ✅ |
| Improvement suggestions | ✅ |
| Suggested chatbot questions | ✅ |
| Document-grounded Q&A | ✅ |
| Inline text citations | ✅ |

## How the chat works

The Q&A assistant is strictly constrained to the extracted document text. It is instructed to answer questions using only the information present in the current file, ignoring outside knowledge. If a user asks a question about information not found in the document, the model honestly states that the document does not contain the answer. Every factual claim is backed by a short, verbatim citation pulled directly from the source text. 

## Approach & Design Notes

- **Architecture**: Built as a single Next.js application utilizing Next.js API routes, eliminating the need for a separate backend service. All text extraction and LLM interactions occur server-side.
- **LLM Provider**: Groq was chosen for OCR, summarization, and chat due to its fast inference speed, minimizing wait times during multi-step text analysis.
- **UI Layout**: The results view utilizes a two-zone layout. The summary and chat history share a dynamic, scrollable upper zone, while the chat input form remains persistently pinned to the bottom of the screen.
- **Known Limitation**: The application relies entirely on React state for data management. Uploaded files, extracted text, and chat history are stored in memory and do not persist across page refreshes.

---
Built for the Unthinkable Solutions technical assessment.
