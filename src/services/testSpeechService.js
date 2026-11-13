require("dotenv").config();

const fs = require("node:fs");
const path = require("node:path");

const { generateSpeech } = require("./speechService");

const samples = [
    {
        name: "loka-nigerian-english",
        text: "Speak with a natural, authentic Nigerian English accent. Use a warm, youthful female voice. Sound confident, friendly and conversational. Avoid an exaggerated accent. Say: Hello! I am LOKA, your intelligent location assistant. There is a pharmacy just a few minutes away from your location. Let me show you the way."
    },
    {
        name: "loka-nigerian-pidgin",
        text: "Speak in natural Nigerian Pidgin with an authentic Nigerian accent. Use a warm, youthful female voice. Sound relaxed and friendly, like a Nigerian speaking naturally. Say: How far! I be LOKA, your location assistant. I don find one pharmacy wey dey near you. Make I show you the way."
    },
    {
        name: "loka-local-professional",
        text: "Speak with a natural Nigerian English accent, with a subtle Nigerian conversational influence. Use a warm, youthful female voice. Sound professional, intelligent and approachable. Say: Hello! I am LOKA. I have found a few useful places around you. Let's find the best option for your journey."
    }
];

async function testSpeech() {
    for (const sample of samples) {
        try {
            console.log(`Generating ${sample.name}...`);

            const result = await generateSpeech(sample.text);

            const outputPath = path.join(
                process.cwd(),
                `${sample.name}.wav`
            );

            fs.writeFileSync(outputPath, result.audio);

            console.log(`Saved: ${outputPath}`);

        } catch (error) {
            console.error(
                `Failed to generate ${sample.name}:`,
                error.message
            );
        }
    }

    console.log("All voice tests completed.");
}

testSpeech();