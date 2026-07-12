import { NextResponse } from "next/server";

export async function POST(request: Request) {
  try {
    const { text, length } = await request.json();

    if (!text || typeof text !== "string") {
      return NextResponse.json({ error: "Invalid or missing text" }, { status: 400 });
    }

    if (!length || !["short", "medium", "long"].includes(length.toLowerCase())) {
      return NextResponse.json({ error: "Invalid length" }, { status: 400 });
    }

    // Truncate to ~12000 characters
    const MAX_TEXT_LENGTH = 12000;
    let processedText = text;
    let truncatedNote = "";
    const wasTruncated = text.length > MAX_TEXT_LENGTH;
    if (wasTruncated) {
      processedText = text.substring(0, MAX_TEXT_LENGTH);
      truncatedNote = "\n\n[NOTE: The document text was truncated due to length limits. Please summarize based on the provided text.]";
    }

    const apiKey = process.env.GROQ_API_KEY;
    if (!apiKey) {
      console.error("GROQ_API_KEY is not set.");
      return NextResponse.json({ error: "Server configuration error" }, { status: 500 });
    }

    const systemPrompt = `You are a document analysis assistant. You will be given the extracted text of a document. Your job is to analyze it accurately and return ONLY a valid JSON object — no markdown formatting, no code fences, no commentary before or after.

Base everything strictly on the provided text. Do not invent facts, statistics, names, or details not present in the document. If the document is too short or unclear to summarize meaningfully, say so honestly in the summary field rather than fabricating content.

Return a JSON object with exactly these fields:

{
  "summary": "string",
  "keyPoints": ["string"],
  "improvements": ["string"],
  "suggestedQuestions": ["string"]
}

Field requirements:

- "summary": A summary of the document at ${length.toLowerCase()} length.
  - short: 2-3 sentences capturing only the core point.
  - medium: one focused paragraph (roughly 100-150 words).
  - long: 3-4 paragraphs, covering context, main content, and conclusion, with more detail than medium.
  Write in clear, neutral, plain language. No filler phrases like "This document discusses..." — get straight to the content.

- "keyPoints": 3-5 bullet points, each one distinct fact or idea from the document, written as a short standalone sentence (not a fragment). Do not repeat the same idea across multiple bullets.

- "improvements": 2-3 concrete, specific suggestions for how the document itself could be improved — e.g. missing context, unclear structure, gaps in explanation, formatting issues. Base these only on what's actually present or missing in the given text. If the document is genuinely clear and complete, say so in one item rather than inventing weak criticism.

- "suggestedQuestions": 2-3 questions a reader would plausibly want answered about THIS specific document, phrased naturally (as a person would type them), directly answerable using the document's content. Do not suggest generic questions unrelated to what's actually in the text.

If the input text was truncated before reaching you, you will be told so — factor that into your summary but do not mention the truncation yourself; that is handled separately by the application.`;

    const SUMMARIZATION_TEMPERATURE = 0.3;

    const groqResponse = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: process.env.GROQ_TEXT_MODEL || "llama-3.3-70b-versatile",
        response_format: { type: "json_object" },
        messages: [
          {
            role: "system",
            content: systemPrompt
          },
          {
            role: "user",
            content: processedText + truncatedNote
          }
        ],
        temperature: SUMMARIZATION_TEMPERATURE,
      }),
    });

    if (!groqResponse.ok) {
      const errorText = await groqResponse.text();
      console.error("Groq API error:", errorText);
      return NextResponse.json({ error: "Failed to generate summary from Groq" }, { status: 500 });
    }

    const data = await groqResponse.json();
    const content = data.choices?.[0]?.message?.content || "";
    
    try {
      const parsed = JSON.parse(content);
      return NextResponse.json({ 
        summary: parsed.summary || "No summary generated.",
        keyPoints: parsed.keyPoints || [],
        improvements: parsed.improvements || [],
        suggestedQuestions: parsed.suggestedQuestions || [],
        truncated: wasTruncated
      });
    } catch (parseError: unknown) {
      console.error("Failed to parse JSON from Groq:", content, parseError);
      return NextResponse.json({ error: "Failed to parse summarization response" }, { status: 500 });
    }
  } catch (error: unknown) {
    console.error("Summarization error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
