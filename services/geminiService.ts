import { GoogleGenAI, Type } from "@google/genai";
import { Post } from "../types";

// Initialize the client.
// NOTE: In a real production app, you should proxy these requests through a backend
// to avoid exposing the API key if this is a public client-side app.
const ai = new GoogleGenAI({ apiKey: process.env.API_KEY || '' });

export const filterPostsWithGemini = async (posts: Post[], topic: string): Promise<string[]> => {
  if (!process.env.API_KEY) {
    console.error("Missing API Key");
    // Fallback for demo if no key provided, just return everything or nothing
    return [];
  }

  try {
    const postData = posts.map(p => ({ id: p.id, content: p.content }));
    
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
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

    const jsonText = response.text;
    if (!jsonText) return [];

    const result = JSON.parse(jsonText);
    return result.ids || [];

  } catch (error) {
    console.error("Gemini filtering error:", error);
    return [];
  }
};