# Document Summary Assistant

[![Vercel Deployment](https://img.shields.io/badge/Live_Demo-Vercel-000000?style=for-the-badge&logo=vercel)](https://unthinkable-assignment-eta.vercel.app/)

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

I built this as one Next.js app rather than splitting frontend and backend — didn't see the need for that separation at this scope. PDFs get parsed server-side with `pdf-parse`. Images go straight to Groq's vision model for OCR, which turned out cleaner than running Tesseract client-side and cuts out a dependency.

Summarization runs on Groq's `llama-3.3-70b-versatile` and returns strict JSON — summary, key points, improvement suggestions, and a couple of suggested questions, all from one call instead of four. Partly a design choice, partly to stay comfortable within Groq's free-tier limits.

Honestly the chat is where most of the time went. After summarizing, you can keep asking questions about the document and get answers grounded in the actual extracted text, with short quoted excerpts as citations. I cared more about it saying "not in this document" when it doesn't know, than about always having an answer ready.

Layout took a few passes too — chat input stays pinned at the bottom while everything else scrolls, closer to how Claude or ChatGPT do it. Beats burying the chat under a wall of summary text.

One thing I left out: no persistence. Refresh and you're starting over.

---
Built for the Unthinkable Solutions technical assessment.
