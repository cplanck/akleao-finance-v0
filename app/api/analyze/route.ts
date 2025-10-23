import OpenAI from "openai";
import { NextResponse } from "next/server";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export async function POST(request: Request) {
  try {
    const { metric, value, context } = await request.json();

    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json(
        { error: "OpenAI API key not configured" },
        { status: 500 }
      );
    }

    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content:
            'You are a financial analyst providing brief, contextual assessments. Return ONLY a JSON object with three fields: "sentiment" (must be exactly "positive", "negative", or "neutral"), "brief" (3-5 words max using actual numbers where helpful), and "reason" (one short sentence explaining why with concrete details).',
        },
        {
          role: "user",
          content: `Analyze this stock metric: "${metric}" with value ${value}${
            context ? ` for ${context}` : ""
          }. Is this good, bad, or neutral for investors? Use the specific value in your brief assessment.`,
        },
      ],
      temperature: 0.3,
      max_tokens: 100,
      response_format: { type: "json_object" },
    });

    const result = JSON.parse(
      completion.choices[0]?.message?.content || '{"sentiment":"neutral","brief":"Average","reason":"Unable to analyze."}'
    );

    return NextResponse.json(result);
  } catch (error) {
    console.error("OpenAI API error:", error);
    return NextResponse.json(
      {
        sentiment: "neutral",
        brief: "Unable to analyze",
        reason: "Error analyzing metric",
      },
      { status: 200 }
    );
  }
}
