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
      ? "You are a helpful financial advisor explaining stock metrics to beginners. Provide a comprehensive explanation (4-6 sentences) with examples and context. Explain how investors use this metric and what factors influence it. Use specific numbers from the stock data to make it concrete and relatable."
      : "You are a helpful financial advisor explaining stock metrics to beginners. Keep explanations VERY concise (maximum 2 sentences). Be direct, practical, and use the actual numbers provided to make it human-readable. For example, instead of explaining P/E ratio abstractly, say 'this means you pay $X for every $1 of earnings'.";

    const userPrompt = detailed
      ? `Provide a detailed explanation of "${metric}" in stock investing. The current value is ${value}${
          context ? ` for ${context}` : ""
        }. Explain what this metric measures, what this specific value means, and how investors should interpret it. Use the actual numbers in your explanation.`
      : `Briefly explain what "${metric}" of ${value} means${
          context ? ` for ${context}` : ""
        }. Use the actual value to explain in concrete, human-readable terms. Maximum 2 sentences.`;

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
