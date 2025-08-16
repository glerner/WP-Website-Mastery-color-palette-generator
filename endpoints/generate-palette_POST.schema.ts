import { z } from "zod";
import { PaletteWithVariations } from "../helpers/types";

export const schema = z.object({
  industry: z.string().min(1, "Industry is required."),
  targetAudience: z.string().min(1, "Target audience is required."),
  brandPersonality: z.string().min(1, "Brand personality is required."),
  avoidColors: z.string().optional(),
});

export type InputType = z.infer<typeof schema>;

export type OutputType = PaletteWithVariations;

export const postGeneratePalette = async (body: InputType, init?: RequestInit): Promise<OutputType> => {
  const validatedInput = schema.parse(body);
  const result = await fetch(`/_api/generate-palette`, {
    method: "POST",
    body: JSON.stringify(validatedInput),
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
  });
  if (!result.ok) {
    try {
      const text = await result.text();
      const errorObject = JSON.parse(text);
      if (typeof errorObject === 'object' && errorObject !== null && 'error' in errorObject && typeof (errorObject as any).error === 'string') {
        throw new Error((errorObject as any).error);
      }
      throw new Error("An unknown error occurred");
    } catch (e) {
      // Fallback if the error response is not in the expected format
      throw new Error(`Request failed with status ${result.status}`);
    }
  }
  return JSON.parse(await result.text()) as OutputType;
};