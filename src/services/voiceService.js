const { GoogleGenAI } = require("@google/genai");

const TRANSCRIPTION_MODEL = "gemini-3.5-flash-lite";

if (!process.env.GEMINI_API_KEY) {
    throw new Error("GEMINI_API_KEY is missing from the .env file.");
}

const ai = new GoogleGenAI({
    apiKey: process.env.GEMINI_API_KEY
});

async function transcribeVoiceNote(filePath, mimeType = "audio/ogg") {
    if (!filePath) {
        throw new Error("A voice recording file path is required.");
    }

    let audioFile = null;

    try {
        audioFile = await ai.files.upload({
            file: filePath,
            config: {
                mimeType: mimeType
            }
        });

        const response = await ai.models.generateContent({
            model: TRANSCRIPTION_MODEL,
            contents: [
                {
                    role: "user",
                    parts: [
                        {
                            text: "Transcribe everything spoken in this audio accurately. Preserve the original language, including Nigerian Pidgin and other Nigerian languages. Return only the spoken words."
                        },
                        {
                            fileData: {
                                fileUri: audioFile.uri,
                                mimeType: audioFile.mimeType
                            }
                        }
                    ]
                }
            ]
        });

        const transcription = response.text;

        if (!transcription || !transcription.trim()) {
            throw new Error("No speech could be recognised.");
        }

        return transcription.trim();

    } catch (error) {
        console.error("LOKA voice transcription error:", error.message);
        throw error;

    } finally {
        if (audioFile && audioFile.name) {
            try {
                await ai.files.delete({
                    name: audioFile.name
                });
            } catch (cleanupError) {
                console.error(
                    "Gemini audio cleanup failed:",
                    cleanupError.message
                );
            }
        }
    }
}

module.exports = {
    transcribeVoiceNote
};