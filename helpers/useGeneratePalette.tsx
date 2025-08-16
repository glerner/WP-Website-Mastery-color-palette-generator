import { useMutation } from "@tanstack/react-query";
import { postGeneratePalette, InputType, OutputType } from "../endpoints/generate-palette_POST.schema";
import { toast } from "sonner";

const categorizeError = (error: Error): { message: string; category: string } => {
  const errorMessage = error.message.toLowerCase();
  
  // Check for quota exceeded (429 status)
  if (errorMessage.includes('status 429') || errorMessage.includes('quota') || errorMessage.includes('rate limit')) {
    return {
      message: "OpenAI quota exceeded. Please check your billing details or try again later.",
      category: "quota_exceeded"
    };
  }
  
  // Check for invalid API key (401 status)
  if (errorMessage.includes('status 401') || errorMessage.includes('unauthorized') || errorMessage.includes('api key')) {
    return {
      message: "Invalid API key. Please check your OpenAI configuration.",
      category: "invalid_api_key"
    };
  }
  
  // Check for network/connection issues
  if (errorMessage.includes('fetch') || errorMessage.includes('network') || errorMessage.includes('connection')) {
    return {
      message: "Network connection issue. Please check your internet connection.",
      category: "network_error"
    };
  }
  
  // Check for service unavailable (5xx status)
  if (errorMessage.includes('status 5') || errorMessage.includes('service') || errorMessage.includes('unavailable')) {
    return {
      message: "AI service unavailable. Please try again in a few minutes.",
      category: "service_unavailable"
    };
  }
  
  // Check for AI response parsing issues
  if (errorMessage.includes('invalid data format') || errorMessage.includes('parse') || errorMessage.includes('json')) {
    return {
      message: "AI service returned invalid data. Please try again.",
      category: "parsing_error"
    };
  }
  
  // Check for server configuration errors
  if (errorMessage.includes('server configuration') || errorMessage.includes('missing api key')) {
    return {
      message: "Server configuration issue. Please contact support.",
      category: "server_config"
    };
  }
  
  // Default fallback
  return {
    message: error.message || "Failed to generate palette. Please try again.",
    category: "unknown_error"
  };
};

export const useGeneratePalette = () => {
  return useMutation<OutputType, Error, InputType>({
    mutationFn: (variables) => postGeneratePalette(variables),
    onSuccess: () => {
      toast.success("New palette generated successfully!");
    },
    onError: (error) => {
      const { message, category } = categorizeError(error);
      
      // Console logging for debugging
      console.error("Palette generation error:", {
        category,
        originalMessage: error.message,
        userMessage: message,
        error
      });
      
      // Show user-friendly error message
      toast.error(message);
    },
  });
};