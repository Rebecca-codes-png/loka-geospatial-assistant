const { resolveLocation } = require("./locationService");

const testLocations = [
    "Moremi Hall",
    "King Jaja Hall",
    "Faculty of Law",
    "Unilag Main Library",
    "UNILAG Medical Centre",
    "Jaja Shopping Complex",
    "Unknown Location"
];

console.log("LOKA LOCATION SERVICE TEST");
console.log("==========================\n");

for (const location of testLocations) {
    console.log("SEARCHING FOR:", location);

    const result = resolveLocation(location);

    if (!result) {
        console.log("Location not found.");
    } else {
        console.log(result);
    }

    console.log("--------------------------");
}

console.log("\nLOCATION SERVICE TEST COMPLETED.");