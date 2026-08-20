import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export async function POST(req: NextRequest) {
  try {
    const { imageBase64, mediaType } = await req.json();

    if (!imageBase64) {
      return NextResponse.json({ error: "No image provided" }, { status: 400 });
    }

    const message = await client.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 2048,
      messages: [
        {
          role: "user",
          content: [
            {
              type: "image",
              source: {
                type: "base64",
                media_type: mediaType ?? "image/png",
                data: imageBase64,
              },
            },
            {
              type: "text",
              text: `Extract all business listings from this image. For each business found, extract:
- name (business name)
- phone (phone number, exactly as shown)
- address (full address)
- email (if visible, otherwise null)
- website (if visible, otherwise null)

Return ONLY a valid JSON array, no explanation, no markdown. Example:
[{"name":"ABC Plumbing","phone":"555-123-4567","address":"123 Main St, Houston TX 77001","email":null,"website":null}]

If no businesses are found, return an empty array: []`,
            },
          ],
        },
      ],
    });

    const raw = message.content[0].type === "text" ? message.content[0].text : "[]";

    // Strip markdown code blocks if Claude wraps in ```json
    const cleaned = raw.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();

    let leads: unknown[];
    try {
      leads = JSON.parse(cleaned);
    } catch {
      leads = [];
    }

    return NextResponse.json({ leads });
  } catch (err) {
    console.error("Image scrape error:", err);
    return NextResponse.json({ error: "Failed to process image" }, { status: 500 });
  }
}
