const MODEL = "gemini-3.1-flash-tts-preview";
const VOICE = "Kore";

if (!process.env.GEMINI_API_KEY) {
    throw new Error("GEMINI_API_KEY is missing from the .env file.");
}

function createWavBuffer(pcmData, sampleRate, channels) {
    const bitsPerSample = 16;
    const blockAlign = channels * (bitsPerSample / 8);
    const byteRate = sampleRate * blockAlign;

    const header = Buffer.alloc(44);

    header.write("RIFF", 0);
    header.writeUInt32LE(36 + pcmData.length, 4);
    header.write("WAVE", 8);

    header.write("fmt ", 12);
    header.writeUInt32LE(16, 16);
    header.writeUInt16LE(1, 20);
    header.writeUInt16LE(channels, 22);
    header.writeUInt32LE(sampleRate, 24);
    header.writeUInt32LE(byteRate, 28);
    header.writeUInt16LE(blockAlign, 32);
    header.writeUInt16LE(bitsPerSample, 34);

    header.write("data", 36);
    header.writeUInt32LE(pcmData.length, 40);

    return Buffer.concat([header, pcmData]);
}

async function generateSpeech(text) {
    if (!text || typeof text !== "string") {
        throw new Error("Valid text is required.");
    }

    try {
        const response = await fetch(
            "https://generativelanguage.googleapis.com/v1beta/interactions",
            {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "x-goog-api-key": process.env.GEMINI_API_KEY
                },
                body: JSON.stringify({
                    model: MODEL,
                    input: `Speak in a natural Nigerian English accent. Use a warm, youthful female voice. Sound friendly, intelligent, confident and conversational. Maintain clear pronunciation and a professional but approachable delivery. Avoid exaggerating the accent. Speak the following text exactly as written, without adding or removing words: ${text}`,
                    response_format: {
                        type: "audio"
                    },
                    generation_config: {
                        speech_config: [
                            {
                                voice: VOICE
                            }
                        ]
                    }
                })
            }
        );

        const result = await response.json();

        if (!response.ok) {
            throw new Error(
                result.error?.message || "Speech generation failed."
            );
        }

        const interaction = result.interaction || result;

        const audioOutput = interaction.steps
            ?.flatMap(step => step.content || [])
            .find(item => item.type === "audio" && item.data);

        if (!audioOutput) {
            throw new Error("Gemini returned no audio data.");
        }

        const pcmData = Buffer.from(audioOutput.data, "base64");

        const sampleRate = audioOutput.sample_rate || 24000;
        const channels = audioOutput.channels || 1;

        const wavAudio = createWavBuffer(
            pcmData,
            sampleRate,
            channels
        );

        return {
            audio: wavAudio,
            mimeType: "audio/wav"
        };

    } catch (error) {
        console.error("LOKA speech generation error:", error.message);
        throw error;
    }
}

module.exports = {
    generateSpeech
};