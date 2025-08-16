import { schema, OutputType } from "./generate-palette_POST.schema";
import { Palette, PaletteWithVariations } from "../helpers/types";
import { generateShades } from "../helpers/colorUtils";
import superjson from 'superjson';
import { z } from "zod";

// This schema is for internal validation of the AI's response.
const aiResponseSchema = z.object({
  primary: z.object({ name: z.string(), hex: z.string().regex(/^#[0-9a-fA-F]{6}$/) }),
  secondary: z.object({ name: z.string(), hex: z.string().regex(/^#[0-9a-fA-F]{6}$/) }),
  tertiary: z.object({ name: z.string(), hex: z.string().regex(/^#[0-9a-fA-F]{6}$/) }),
  accent: z.object({ name: z.string(), hex: z.string().regex(/^#[0-9a-fA-F]{6}$/) }),
});

// Fixed semantic colors with high contrast for accessibility
const semanticColors = {
  error: { name: "Deep Red", hex: "#B91C1C" },
  warning: { name: "Dark Orange", hex: "#D97706" },
  success: { name: "Deep Green", hex: "#059669" }
};

export async function handle(request: Request): Promise<Response> {
  try {
    const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
    if (!OPENAI_API_KEY) {
      console.error("OPENAI_API_KEY environment variable not set.");
      throw new Error("Server configuration error: Missing API key.");
    }

    const json = superjson.parse(await request.text());
    const input = schema.parse(json);

    const prompt = `
      You are a professional brand and color designer. Your task is to generate a color palette for a brand based on the following information.
      Your response must be a valid JSON object and nothing else. Do not include any markdown formatting like \`\`\`json.

      Brand Information:
      - Industry: ${input.industry}
      - Target Audience: ${input.targetAudience}
      - Brand Personality: ${input.brandPersonality}
      ${input.avoidColors ? `- Colors to Avoid: ${input.avoidColors}` : ''}

      Generate a color palette with four colors: primary, secondary, tertiary, and accent.
      For each color, provide a descriptive name and its 6-digit hex code.
      The colors should be harmonious, accessible, and suitable for the brand context provided.

      Example JSON output format:
      {
        "primary": { "name": "Deep Ocean Blue", "hex": "#003366" },
        "secondary": { "name": "Sandy Beige", "hex": "#F4A460" },
        "tertiary": { "name": "Light Slate Gray", "hex": "#778899" },
        "accent": { "name": "Vibrant Coral", "hex": "#FF7F50" }
      }
    `;

    const openaiResponse = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [{ role: "user", content: prompt }],
        response_format: { type: "json_object" },
        temperature: 0.7,
      }),
    });

    if (!openaiResponse.ok) {
      const errorBody = await openaiResponse.text();
      console.error("OpenAI API error:", openaiResponse.status, errorBody);
      throw new Error(`Failed to generate palette. AI service returned status ${openaiResponse.status}.`);
    }

    const openaiResult = await openaiResponse.json();
    const content = openaiResult.choices[0]?.message?.content;

    if (!content) {
      console.error("OpenAI response content is empty", openaiResult);
      throw new Error("Failed to generate palette. AI returned an empty response.");
    }

    let aiBasePalette: z.infer<typeof aiResponseSchema>;
    try {
      const parsedContent = JSON.parse(content);
      aiBasePalette = aiResponseSchema.parse(parsedContent);
    } catch (error) {
      console.error("Failed to parse or validate AI response:", content, error);
      throw new Error("The AI returned an invalid data format. Please try again.");
    }

    // Combine AI-generated colors with fixed semantic colors
    const basePalette: Palette = {
      ...aiBasePalette,
      ...semanticColors
    };

    const paletteWithVariations: PaletteWithVariations = {
      primary: { ...basePalette.primary, variations: generateShades(basePalette.primary.hex, basePalette.primary.name) },
      secondary: { ...basePalette.secondary, variations: generateShades(basePalette.secondary.hex, basePalette.secondary.name) },
      tertiary: { ...basePalette.tertiary, variations: generateShades(basePalette.tertiary.hex, basePalette.tertiary.name) },
      accent: { ...basePalette.accent, variations: generateShades(basePalette.accent.hex, basePalette.accent.name) },
      error: { ...basePalette.error, variations: generateShades(basePalette.error.hex, basePalette.error.name) },
      warning: { ...basePalette.warning, variations: generateShades(basePalette.warning.hex, basePalette.warning.name) },
      success: { ...basePalette.success, variations: generateShades(basePalette.success.hex, basePalette.success.name) },
    };

    return new Response(superjson.stringify(paletteWithVariations satisfies OutputType), {
      headers: { "Content-Type": "application/json" },
    });

  } catch (error) {
    console.error("Error in generate-palette endpoint:", error);
    const errorMessage = error instanceof Error ? error.message : "An unknown error occurred.";
    return new Response(superjson.stringify({ error: errorMessage }), { status: 400 });
  }
}