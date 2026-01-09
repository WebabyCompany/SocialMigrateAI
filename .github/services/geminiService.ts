
import { GoogleGenAI, Type } from "@google/genai";
import { Post } from "../types";

// Always use exactly this initialization format as per guidelines.
const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

export const filterPostsWithGemini = async (posts: Post[], topic: string): Promise<string[]> => {
  // Guidelines: Assume API_KEY is valid and accessible.
  try {
    const postData = posts.map(p => ({ id: p.id, content: p.content }));
    
    // Using gemini-3-flash-preview for fast and accurate basic text filtering tasks.
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: `
        You are a content filtering agent. 
        The user wants to find posts related to the topic: "${topic}".
        
        Here is the list of posts:
        ${JSON.stringify(postData)}
        
        Return a JSON object containing an array of "ids" for the posts that are semantically related to the topic.
        Be generous with the filtering (fuzzy match). If the topic is 'concerts', include things about 'tickets', 'festivals', 'live music', 'gigs', etc.
      `,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            ids: {
              type: Type.ARRAY,
              items: { type: Type.STRING }
            }
          }
        }
      }
    });

    // Access the text property directly (not as a method).
    const jsonStr = response.text?.trim();
    if (!jsonStr) return [];

    const result = JSON.parse(jsonStr);
    return result.ids || [];

  } catch (error) {
    console.error("Gemini filtering error:", error);
    return [];
  }
};
