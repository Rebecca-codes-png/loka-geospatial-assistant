const {
    processMessage,
    formatRecommendations
} = require("./messageProcessor");

const tests = [
    "Hello LOKA",
    "Find hostels around Moremi Hall within 2km",
    "Find banks around King Jaja Hall within 1km",
    "Where is the main library?",
    "Find pharmacies near me",
    "Find restaurants around Faculty of Law",
    "Find banks around King Jaja Hall within 1km",
"Where is the main library?",
];

for (const message of tests) {
    console.log("\n================================");
    console.log("USER:", message);

    const result = processMessage(message);

    console.log("STATUS:", result.status);
    console.log("MESSAGE:", result.message);

    if (result.place) {
        console.log("LOCATION:", result.place.name);
    }

    if (result.places) {
        console.log("SEARCHING FROM:", result.searchingFrom);
        console.log("\nRECOMMENDATIONS:");
        console.log(formatRecommendations(result.places));
    }
}