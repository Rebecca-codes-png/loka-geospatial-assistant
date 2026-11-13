const { parseQuery } = require("../conversations/queryParser");

const testMessages = [
    "Find pharmacies near me",
    "Show me hostels within 2km",
    "Are there restaurants within 500 metres?",
    "Find banks under 1km",
    "Where is the main library?",
    "Find a cafeteria around me",
    "Hello LOKA"
];

console.log("LOKA QUERY PARSER TEST");
console.log("======================\n");

for (const message of testMessages) {
    console.log("USER:", message);
    console.log("LOKA:", parseQuery(message));
    console.log("----------------------");
}

console.log("\nQUERY PARSER TEST COMPLETED.");