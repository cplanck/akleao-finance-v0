import OpenAI from "openai";
import { NextResponse } from "next/server";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export async function POST(request: Request) {
  try {
    const { metric, value, context, detailed = false } = await request.json();

    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json(
        { error: "OpenAI API key not configured" },
        { status: 500 }
      );
    }

    const systemPrompt = detailed
      ? "You are a helpful financial advisor explaining stock metrics to beginners. Provide a comprehensive explanation (4-6 sentences) with examples and context. Explain how investors use this metric and what factors influence it."
      : "You are a helpful financial advisor explaining stock metrics to beginners. Keep explanations VERY concise (maximum 2 sentences). Be direct and practical.";

    const userPrompt = detailed
      ? `Provide a detailed explanation of "${metric}" in stock investing. The current value is ${value}${
          context ? `. Stock: ${context}` : ""
        }. Explain what this metric measures, what this specific value means, and how investors should interpret it.`
      : `Briefly explain "${metric}" in stock investing. The current value is ${value}. What does this mean in 2 sentences max?`;

    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: systemPrompt,
        },
        {
          role: "user",
          content: userPrompt,
        },
      ],
      temperature: 0.7,
      max_tokens: detailed ? 300 : 80,
    });

    const explanation = completion.choices[0]?.message?.content || "Unable to generate explanation.";

    return NextResponse.json({ explanation });
  } catch (error) {
    console.error("OpenAI API error:", error);
    return NextResponse.json(
      { error: "Failed to generate explanation" },
      { status: 500 }
    );
  }
}
