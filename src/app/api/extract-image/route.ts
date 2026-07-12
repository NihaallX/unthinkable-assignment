import { NextResponse } from "next/server";

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return NextResponse.json({ error: "No file uploaded" }, { status: 400 });
    }

    if (!file.type.startsWith("image/")) {
      return NextResponse.json({ error: "Invalid file type. Expected an image." }, { status: 400 });
    }

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const base64Image = buffer.toString("base64");
    const dataUrl = `data:${file.type};base64,${base64Image}`;

    const apiKey = process.env.GROQ_API_KEY;
    const model = process.env.GROQ_VISION_MODEL || "meta-llama/llama-4-scout-17b-16e-instruct";
    const OCR_TEMPERATURE = 0.1;

    if (!apiKey) {
      console.error("GROQ_API_KEY is not set.");
      return NextResponse.json({ error: "Server configuration error" }, { status: 500 });
    }

    const groqResponse = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: model,
        messages: [
          {
            role: "user",
            content: [
              {
                type: "text",
                text: "Extract all readable text from this image exactly as it appears. Return only the extracted text, no commentary."
              },
              {
                type: "image_url",
                image_url: {
                  url: dataUrl
                }
              }
            ]
          }
        ],
        temperature: OCR_TEMPERATURE, // low temperature for more deterministic output
      }),
    });

    if (!groqResponse.ok) {
      const errorText = await groqResponse.text();
      console.error("Groq API error:", errorText);
      return NextResponse.json({ error: "Failed to extract text from image" }, { status: 500 });
    }

    const data = await groqResponse.json();
    const text = data.choices?.[0]?.message?.content || "";

    return NextResponse.json({ text });
  } catch (error: unknown) {
    console.error("Image extraction error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
