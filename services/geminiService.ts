
import { GoogleGenAI, Modality } from "@google/genai";
import { LearningProfile } from "../types";

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

export interface AdaptationResult {
  text: string;
  sources: { title: string; uri: string }[];
}

export async function adaptContent(
  content: string, 
  profile: LearningProfile, 
  options?: {
    imageData?: { data: string; mimeType: string };
    isSearch?: boolean;
  }
): Promise<AdaptationResult> {
  // Upgraded to gemini-3-pro-preview for better reasoning and multimodal PDF handling
  const model = 'gemini-3-pro-preview';
  
  let profileInstruction = "";
  switch (profile) {
    case LearningProfile.ADHD:
      profileInstruction = "Rewrite this content for someone with ADHD. Focus on extreme brevity, use bullet points, bold the most important words, and provide an 'Executive Summary' at the top. Minimize fluff.";
      break;
    case LearningProfile.DYSLEXIA:
      profileInstruction = "Rewrite this content for someone with Dyslexia. Use short, clear sentences. Avoid complex jargon or double negatives. Break long paragraphs into very short ones (2-3 sentences max). Use a friendly, clear tone. Focus on high readability.";
      break;
    case LearningProfile.AUTISTIC_LOGIC:
      profileInstruction = "Rewrite this content for an autistic learner who prefers logical, step-by-step explanations. Remove metaphors, use direct language, and structure the information into a numbered sequence of logical steps. Maintain objectivity.";
      break;
  }

  const prompt = options?.isSearch 
    ? `Search for information about "${content}" and then: ${profileInstruction}`
    : `${profileInstruction}\n\nContent:\n${content}`;

  const parts: any[] = [{ text: prompt }];
  
  if (options?.imageData) {
    parts.push({
      inlineData: {
        data: options.imageData.data,
        mimeType: options.imageData.mimeType
      }
    });
  }

  const response = await ai.models.generateContent({
    model,
    contents: { parts },
    config: {
      temperature: 0.7,
      topP: 0.95,
      // If search is used, grounding chunks will be available in the metadata
      tools: options?.isSearch ? [{ googleSearch: {} }] : undefined,
    }
  });

  const text = response.text || "Failed to generate content.";
  const sources: { title: string; uri: string }[] = [];

  // Extract grounding chunks if they exist
  const chunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks;
  if (chunks) {
    chunks.forEach((chunk: any) => {
      if (chunk.web && chunk.web.uri && chunk.web.title) {
        sources.push({
          title: chunk.web.title,
          uri: chunk.web.uri
        });
      }
    });
  }

  return { text, sources };
}

export async function generateSpeech(text: string) {
  const response = await ai.models.generateContent({
    model: "gemini-2.5-flash-preview-tts",
    contents: [{ parts: [{ text: `Read this content clearly and at a moderate pace: ${text}` }] }],
    config: {
      responseModalities: [Modality.AUDIO],
      speechConfig: {
        voiceConfig: {
          prebuiltVoiceConfig: { voiceName: 'Kore' },
        },
      },
    },
  });

  return response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
}
