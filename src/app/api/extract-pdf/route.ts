import { NextResponse } from "next/server";
import { extractFromPdf } from "@/lib/extractText";

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return NextResponse.json({ error: "No file uploaded" }, { status: 400 });
    }

    if (file.type !== "application/pdf") {
      return NextResponse.json({ error: "Invalid file type" }, { status: 400 });
    }

    const text = await extractFromPdf(file);
    return NextResponse.json({ text });
  } catch (error) {
    console.error("PDF extraction error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
