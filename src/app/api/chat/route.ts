import { NextResponse } from "next/server";

const MAX_TEXT_LENGTH = 12000;
const CHAT_TEMPERATURE = 0.3;

export async function POST(request: Request) {
  try {
    const { documentText, question, chatHistory = [] } = await request.json();

    if (!documentText || typeof documentText !== "string") {
      return NextResponse.json({ error: "Invalid or missing document text" }, { status: 400 });
    }

    if (!question || typeof question !== "string") {
      return NextResponse.json({ error: "Invalid or missing question" }, { status: 400 });
    }

    const processedText = documentText.length > MAX_TEXT_LENGTH 
      ? documentText.substring(0, MAX_TEXT_LENGTH) 
      : documentText;

    const apiKey = process.env.GROQ_API_KEY;
    if (!apiKey) {
      console.error("GROQ_API_KEY is not set.");
      return NextResponse.json({ error: "Server configuration error" }, { status: 500 });
    }

    const systemPrompt = `You are a Q&A assistant answering questions strictly about ONE document. You will be given the full extracted text of that document, followed by a conversation history, followed by the user's latest question.

Hard rules:
1. Answer ONLY using information present in the provided document text. Do not use outside knowledge, even if you know the answer from elsewhere.
2. If the answer is not in the document, respond honestly: state that the document doesn't contain that information. Do not guess or fabricate an answer.
3. Every factual claim in your answer must be traceable to the document. For each claim, include a short supporting excerpt copied VERBATIM from the document text — do not paraphrase the excerpt, do not invent an excerpt, and do not exceed roughly 20 words per excerpt.
4. If a question is ambiguous or could refer to multiple parts of the document, ask a brief clarifying question instead of guessing which part is meant.
5. Keep answers concise: 2-4 sentences by default. Only go longer if the question explicitly asks for detail or a list.
6. Use the conversation history for context on follow-up questions (e.g. "what about the second one" refers back to a prior answer), but every claim still must be grounded in the document text, not just prior chat turns.

Return ONLY a valid JSON object, no markdown, no commentary:

{
  "answer": "string",
  "citations": ["string"]
}

"citations" must be an array of verbatim excerpts from the document that directly support the answer. If the answer required no direct excerpt (e.g. "the document doesn't mention that"), return an empty array.`;

    // Map chatHistory to groq format, stripping citations which they don't need
    const formattedHistory = chatHistory.map((msg: { role: string; content: string }) => ({
      role: msg.role === "user" ? "user" : "assistant",
      content: msg.content
    }));

    const historyText = formattedHistory.length > 0 
      ? formattedHistory.map((m: { role: string; content: string }) => `${m.role === 'user' ? 'User' : 'Assistant'}: ${m.content}`).join("\n\n") 
      : "None";

    const userPrompt = `DOCUMENT TEXT:
"""
${processedText}
"""

CONVERSATION HISTORY:
${historyText}

QUESTION: ${question}`;

    const messages = [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt }
    ];

    const groqResponse = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: process.env.GROQ_TEXT_MODEL || "llama-3.3-70b-versatile",
        response_format: { type: "json_object" },
        messages: messages,
        temperature: CHAT_TEMPERATURE,
      }),
    });

    if (!groqResponse.ok) {
      const errorText = await groqResponse.text();
      console.error("Groq Chat API error:", errorText);
      return NextResponse.json({ error: "Failed to generate chat response" }, { status: 500 });
    }

    const data = await groqResponse.json();
    const content = data.choices?.[0]?.message?.content || "";
    
    try {
      const parsed = JSON.parse(content);
      return NextResponse.json({ 
        answer: parsed.answer || "I could not generate an answer.",
        citations: parsed.citations || []
      });
    } catch (parseError: unknown) {
      console.error("Failed to parse JSON from Groq chat:", content, parseError);
      return NextResponse.json({ error: "Failed to parse chat response" }, { status: 500 });
    }
  } catch (error: unknown) {
    console.error("Chat API error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
