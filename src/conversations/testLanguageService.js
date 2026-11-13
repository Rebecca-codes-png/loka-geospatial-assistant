require("dotenv").config();

const {
    understandMessage,
    translateResponse
} = require("../services/languageService");

async function testLanguageService() {
    console.log("Testing LOKA Multilingual Intelligence...\n");

    const testMessage = "Abeg, help me find the nearest pharmacy.";

    try {
        const understanding = await understandMessage(testMessage);

        console.log("DETECTED LANGUAGE:");
        console.log(understanding.language);

        console.log("\nNORMALIZED MESSAGE:");
        console.log(understanding.normalizedEnglish);

        const translatedResponse = await translateResponse(
            "The nearest pharmacy is 500 metres away. Follow the main road.",
            "Yoruba",
            "yo"
        );

        console.log("\nYORUBA RESPONSE:");
        console.log(translatedResponse);

        console.log("\nLOKA multilingual test completed.");

    } catch (error) {
        console.error("\nTest failed:");
        console.error(error.message);
    }
}

testLanguageService();