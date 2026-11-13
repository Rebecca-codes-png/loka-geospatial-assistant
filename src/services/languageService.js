const { GoogleGenAI } = require("@google/genai");

const MODEL = "gemini-3.5-flash-lite";

if (!process.env.GEMINI_API_KEY) {
    throw new Error("GEMINI_API_KEY is missing from the .env file.");
}

const ai = new GoogleGenAI({
    apiKey: process.env.GEMINI_API_KEY
});

// ========================================
// CLEAN TRANSLATED RESPONSE
// ========================================

function cleanTranslationOutput(text) {
    if (!text || typeof text !== "string") {
        throw new Error("Invalid translated response.");
    }

    let cleaned = text
        .replace(/```text/gi, "")
        .replace(/```/g, "")
        .trim();

    // Decode JSON-encoded strings.
    if (cleaned.startsWith('"') && cleaned.endsWith('"')) {
        try {
            const decoded = JSON.parse(cleaned);

            if (typeof decoded === "string") {
                cleaned = decoded;
            }
        } catch (error) {
            // Continue with normal text cleanup.
        }
    }

    // Convert escaped line breaks into actual line breaks.
    cleaned = cleaned
        .replace(/\\r\\n/g, "\n")
        .replace(/\\n/g, "\n")
        .replace(/\\r/g, "\n");

    return cleaned.trim();
}

// ========================================
// UNDERSTAND USER MESSAGE
// ========================================

async function understandMessage(message) {
    if (!message || typeof message !== "string") {
        throw new Error("A valid message is required.");
    }

    const prompt = `
You are LOKA's multilingual language intelligence system.

LOKA helps people discover places and navigate their surroundings.

Understand messages written in or mixing:
- English
- Nigerian Pidgin
- Yoruba
- Igbo
- Hausa

Identify the language, understand the request, and convert it into clear English.

Preserve official place names and street names.
Never invent destinations.
Ask for clarification if the request is unclear.

Return ONLY valid JSON in this structure:

{
    "language": "English",
    "languageCode": "en",
    "normalizedEnglish": "Find the nearest pharmacy",
    "intent": "search",
    "destination": null,
    "needsClarification": false,
    "clarificationQuestion": null
}

Allowed intent values:
greeting, search, navigation, other, unclear

User message:
${JSON.stringify(message)}
`;

    try {
        const interaction = await ai.interactions.create({
            model: MODEL,
            input: prompt
        });

        const responseText = interaction.output_text;

        if (!responseText) {
            throw new Error("Gemini returned an empty response.");
        }

        const cleanedResponse = responseText
            .replace(/```json/gi, "")
            .replace(/```/g, "")
            .trim();

        const result = JSON.parse(cleanedResponse);

        const allowedIntents = [
            "greeting",
            "search",
            "navigation",
            "other",
            "unclear"
        ];

        if (
            !result.language ||
            !result.languageCode ||
            !result.normalizedEnglish ||
            !allowedIntents.includes(result.intent)
        ) {
            throw new Error("Gemini returned an invalid response structure.");
        }

        return result;

    } catch (error) {
        console.error("Language service error:", error.message);
        throw error;
    }
}

// ========================================
// TRANSLATE RESPONSE
// ========================================

async function translateResponse(text, language, languageCode) {
    if (!text || typeof text !== "string") {
        throw new Error("A valid response text is required.");
    }

    if (!language || !languageCode) {
        throw new Error("The target language is required.");
    }

    const prompt = `
You are LOKA's multilingual response assistant.

Translate the following response into ${language}.
Language code: ${languageCode}

Instructions:
1. Use natural, conversational language.
2. Make it easy for ordinary people to understand.
3. Preserve official place names and business names.
4. Preserve road names and street names.
5. Preserve distances, numbers and estimated travel times.
6. Preserve URLs and Telegram commands exactly.
7. Do not invent information.
8. Do not remove navigation instructions.
9. Keep the original meaning accurate.
10. Preserve every paragraph and line break.
11. Never replace line breaks with literal \\n characters.
12. Do not add quotation marks around the response.
13. Do not use Markdown code blocks.
14. Return ONLY the translated response.

Response:
${JSON.stringify(text)}
`;

    try {
        const interaction = await ai.interactions.create({
            model: MODEL,
            input: prompt
        });

        const translatedText = interaction.output_text;

        if (!translatedText) {
            throw new Error("Gemini returned an empty translation.");
        }

        return cleanTranslationOutput(translatedText);

    } catch (error) {
        console.error("LOKA translation error:", error.message);
        throw error;
    }
}

// ========================================
// EXPORT SERVICES
// ========================================

module.exports = {
    understandMessage,
    translateResponse
};