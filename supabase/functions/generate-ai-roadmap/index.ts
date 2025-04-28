// supabase/functions/generate-ai-roadmap/index.ts

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { corsHeaders } from '../_shared/cors.ts' // Assuming a shared CORS config (see note below)

// --- Google AI Configuration ---
// NOTE: Ensure GOOGLE_API_KEY is set via `npx supabase secrets set GOOGLE_API_KEY=your_key`
const GOOGLE_API_KEY = Deno.env.get('GOOGLE_API_KEY');
const GOOGLE_AI_MODEL_NAME = 'gemini-1.5-flash-latest'; // Or your preferred model like 'gemini-1.5-flash-preview-0514'
const GOOGLE_API_URL = `https://generativelanguage.googleapis.com/v1beta/models/${GOOGLE_AI_MODEL_NAME}:generateContent?key=${GOOGLE_API_KEY}`;

// --- Request Handler ---
serve(async (req: Request) => {
  // --- Handle CORS Preflight (OPTIONS) Request ---
  // This is essential for browsers to allow the actual POST request from your frontend.
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  // --- Handle POST Request ---
  try {
    // 1. Check Method and Content Type
    if (req.method !== 'POST') {
      return new Response(JSON.stringify({ error: 'Method Not Allowed' }), {
        status: 405,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }
    if (!req.headers.get('content-type')?.includes('application/json')) {
       return new Response(JSON.stringify({ error: 'Invalid Content-Type. Must be application/json' }), {
         status: 415, // Unsupported Media Type
         headers: { ...corsHeaders, 'Content-Type': 'application/json' },
       })
     }

    // 2. Check for Google API Key
    if (!GOOGLE_API_KEY) {
        console.error("Function Error: GOOGLE_API_KEY environment variable not set in Supabase secrets.");
        return new Response(JSON.stringify({ error: 'Internal Server Configuration Error: Missing API Key.' }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
    }

    // 3. Parse Request Body and Validate Input
    let projectDescription: string | undefined;
    try {
        const body = await req.json();
        projectDescription = body.projectDescription;
    } catch (e) {
         console.error("Function Error: Could not parse request body:", e);
         return new Response(JSON.stringify({ error: 'Invalid JSON in request body.' }), {
           status: 400, // Bad Request
           headers: { ...corsHeaders, 'Content-Type': 'application/json' },
         });
    }

    if (!projectDescription || typeof projectDescription !== 'string' || projectDescription.trim() === '') {
      console.warn("Function Validation Error: Missing or invalid projectDescription");
      return new Response(JSON.stringify({ error: 'Missing or invalid projectDescription in request body' }), {
        status: 400, // Bad Request
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    console.log("Received project description (snippet):", projectDescription.substring(0, 100) + "...");

    // 4. Construct Prompt for Google AI (Copied from server.js)
    const prompt = `
You are an expert project manager AI. Based on the following project description, generate a draft product roadmap.

Project Description:
"${projectDescription}"

***IMPORTANT: Your response MUST BE ONLY a valid JSON object. Do NOT include any text before the opening \`{\` or after the closing \`}\`. Do NOT use markdown code blocks (like \`\`\`json). The entire response must be the JSON data itself, adhering precisely to this structure:***
{
  "roadmapName": "A concise, generated name for the product/roadmap based on the description",
  "milestones": [
    {
      "id": "milestone-1",
      "title": "Concise title for the first milestone (e.g., 'Phase 1: Research & Planning')",
      "purpose": "A brief sentence describing the goal or purpose of this milestone.",
      "currentCompletionDate": "",
      "originalCompletionDate": "",
      "items": [
        {
          "id": "item-milestone-1-1",
          "text": "Specific, actionable task for this milestone (e.g., 'Define target audience personas')",
          "status": "Not Started"
        },
        {
          "id": "item-milestone-1-2",
          "text": "Another specific task (e.g., 'Conduct competitor analysis')",
          "status": "Not Started"
        }
      ]
    },
    {
      "id": "milestone-2",
      "title": "Concise title for the second milestone (e.g., 'Phase 2: MVP Development')",
      "purpose": "Brief purpose of this milestone.",
      "currentCompletionDate": "",
      "originalCompletionDate": "",
      "items": [
        {
          "id": "item-milestone-2-1",
          "text": "Specific task (e.g., 'Set up development environment')",
          "status": "Not Started"
        }
      ]
    }
  ]
}
***CRITICAL: Your response MUST BE ONLY a valid JSON object.
- DO NOT include any explanatory text, comments, notes, markdown fences (like \`\`\`json), or any other artifacts (like 'regex:' or 'contiguous' or stray words/phrases) BEFORE, AFTER, OR WITHIN the JSON output.
- The entire response must be parseable as a single, valid JSON object using standard JSON parsers.
- The output MUST start directly with \`{\` and end directly with \`}\`.
- Contain ONLY valid JSON syntax throughout. Double-check for any non-JSON content before finalizing the response.***
***REMEMBER: ONLY the JSON object as output. Verify the structure and content purity meticulously before responding.***
`;

    // 5. Call Google AI API
    console.log(`Calling Google AI model: ${GOOGLE_AI_MODEL_NAME}...`);
    const googleAiResponse = await fetch(GOOGLE_API_URL, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
            // Optional: Add safety settings or generation config if needed
            // generationConfig: {
            //     responseMimeType: "application/json", // Request JSON directly if model supports it reliably
            // }
        }),
    });

    // 6. Handle Google AI Response
    if (!googleAiResponse.ok) {
        const errorBody = await googleAiResponse.text();
        console.error(`Google AI API Error (${googleAiResponse.status}): ${errorBody}`);
        // Provide a more generic error to the frontend for security/simplicity
        return new Response(JSON.stringify({ error: 'Failed to get response from AI service.' }), {
          status: 502, // Bad Gateway
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
    }

    const aiResult = await googleAiResponse.json();

    // Extract the text content - structure might vary slightly based on model/errors
    const responseText = aiResult?.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!responseText) {
        console.error('Function Error: Could not extract text from Google AI response:', JSON.stringify(aiResult, null, 2));
        return new Response(JSON.stringify({ error: 'Received incomplete or unexpected data from AI service.' }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
    }

    console.log("Raw response received from AI (first 200 chars):", responseText.substring(0, 200));

    // 7. Clean and Parse AI Response Text
    let roadmapData;
    try {
        let rawText = responseText.trim();
        let jsonString = rawText;
        const jsonFenceStart = "```json";
        const genericFenceStart = "```";
        const fenceEnd = "```";

        if (rawText.startsWith(jsonFenceStart)) {
            jsonString = rawText.substring(jsonFenceStart.length);
            if (jsonString.endsWith(fenceEnd)) {
                jsonString = jsonString.substring(0, jsonString.lastIndexOf(fenceEnd));
            }
        } else if (rawText.startsWith(genericFenceStart)) {
             jsonString = rawText.substring(genericFenceStart.length);
             if (jsonString.endsWith(fenceEnd)) {
                jsonString = jsonString.substring(0, jsonString.lastIndexOf(fenceEnd));
            }
        }
        jsonString = jsonString.trim();

        roadmapData = JSON.parse(jsonString);

        // Basic Validation
        if (!roadmapData || typeof roadmapData.roadmapName !== 'string' || !Array.isArray(roadmapData.milestones)) {
            throw new Error("Parsed JSON is missing required fields (roadmapName or milestones).");
        }
        console.log("Successfully parsed and validated AI response JSON.");

    } catch (parseError) {
        console.error("Function Error: Error parsing AI response as JSON:", parseError);
        console.error("Problematic AI Response Text:", responseText);
        return new Response(JSON.stringify({ error: 'Invalid response format received from AI service' }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
    }

    // 8. Send Success Response to Frontend
    console.log("Sending successful roadmap data to frontend.");
    return new Response(JSON.stringify(roadmapData), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });

  } catch (error) {
    // --- Handle Unexpected Server Errors ---
    console.error("Function Error (Outer Catch):", error);
    return new Response(JSON.stringify({ error: 'An unexpected error occurred in the function.' }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    });
  }
})

/*
Note on `../_shared/cors.ts`:
For cleaner code, it's recommended to create a shared file for CORS headers.
1. Create a folder: `supabase/functions/_shared`
2. Create a file inside it: `supabase/functions/_shared/cors.ts`
3. Put the following content in `cors.ts`:

export const corsHeaders = {
  'Access-Control-Allow-Origin': '*', // Or your specific frontend origin for production
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS', // Allow POST and OPTIONS
}

Then you can import it as shown at the top of this function file.
If you prefer not to create the shared file, you can define the `corsHeaders` object directly within this `index.ts` file instead.
*/
