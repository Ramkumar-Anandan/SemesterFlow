
import { GoogleGenAI, Type } from "@google/genai";
import { Subject, SemesterConfig } from "../types";

// Always use process.env.API_KEY directly for initialization as per guidelines.
const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

// Fix: Replaced Course[] with Subject[] and removed non-existent ScheduleEvent[] type to resolve import errors.
export const optimizeSchedule = async (
  subjects: Subject[],
  config: SemesterConfig
) => {
  // Use ai.models.generateContent to query GenAI with model and prompt together.
  const response = await ai.models.generateContent({
    model: 'gemini-3-flash-preview',
    contents: `
      I am a university student planning my semester for ${config.name} (from ${config.startDate} to ${config.endDate}).
      My current subjects are: ${JSON.stringify(subjects)}.
      
      Based on this subject load, suggest 10 important study milestones (like major project checkpoints or mid-term prep blocks) 
      to add to my schedule. Return them as a JSON array of events.
    `,
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            id: { type: Type.STRING },
            courseName: { type: Type.STRING },
            date: { type: Type.STRING, description: "YYYY-MM-DD" },
            startTime: { type: Type.STRING, description: "HH:mm" },
            endTime: { type: Type.STRING, description: "HH:mm" },
            type: { type: Type.STRING, description: "Should be 'study' or 'assignment'" },
            courseId: { type: Type.STRING }
          },
          required: ["courseName", "date", "startTime", "endTime", "type"]
        }
      }
    }
  });

  // response.text is a property, not a method.
  const text = response.text || "[]";
  return JSON.parse(text);
};

// Fix: Replaced Course[] with Subject[] to resolve import error.
export const getSemesterInsights = async (subjects: Subject[]) => {
  // Use ai.models.generateContent to query GenAI with model and prompt together.
  const response = await ai.models.generateContent({
    model: 'gemini-3-flash-preview',
    contents: `
      Analyze this subject load and give me 3 brief pieces of advice for surviving the semester:
      ${subjects.map(s => s.name).join(', ')}
    `
  });
  // response.text is a property, not a method.
  return response.text;
};
