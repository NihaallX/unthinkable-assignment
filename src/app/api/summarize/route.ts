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
    let processedText = text;
    let truncatedNote = "";
    if (text.length > 12000) {
      processedText = text.substring(0, 12000);
      truncatedNote = "\n\n[NOTE: The document text was truncated due to length limits. Please summarize based on the provided text.]";
    }

    const apiKey = process.env.GROQ_API_KEY;
    if (!apiKey) {
      console.error("GROQ_API_KEY is not set.");
      return NextResponse.json({ error: "Server configuration error" }, { status: 500 });
    }

    let lengthInstruction = "";
    switch (length.toLowerCase()) {
      case "short":
        lengthInstruction = "Make the summary exactly 2-3 sentences.";
        break;
      case "medium":
        lengthInstruction = "Make the summary exactly 1 short paragraph.";
        break;
      case "long":
        lengthInstruction = "Make the summary 3-4 paragraphs.";
        break;
    }

    const systemPrompt = `You are a professional document summarizer. 
Your task is to summarize the provided document text. 
${lengthInstruction}
Also, extract 3-5 "Key Points" from the text. 

You MUST respond strictly in the following JSON format:
{
  "summary": "Your generated summary here",
  "keyPoints": [
    "Key point 1",
    "Key point 2",
    "Key point 3"
  ]
}

Return ONLY the JSON. Do not include markdown formatting like \`\`\`json or any other commentary.`;

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
        temperature: 0.3,
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
        keyPoints: parsed.keyPoints || []
      });
    } catch (parseError) {
      console.error("Failed to parse JSON from Groq:", content, parseError);
      return NextResponse.json({ error: "Failed to parse summarization response" }, { status: 500 });
    }
  } catch (error) {
    console.error("Summarization error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
