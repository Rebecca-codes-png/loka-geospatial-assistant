const { processQuery } = require("./lokaEngine");

const testQueries = [
    "Find hostels around Moremi Hall within 2km",
    "Find pharmacies near me",
    "Find banks around King Jaja Hall within 1km",
    "Where is the main library?",
    "Find restaurants around Faculty of Law",
    "Hello LOKA"
];

console.log("LOKA INTELLIGENCE ENGINE TEST");
console.log("==============================\n");

for (const query of testQueries) {
    console.log("USER:", query);

    const result = processQuery(query);

    console.log("STATUS:", result.status);
    console.log("MESSAGE:", result.message || "Request processed.");

    if (result.success) {
        if (result.location) {
            console.log("LOCATION:", result.location.name);
        }

        if (result.searchLocation) {
            console.log("SEARCHING FROM:", result.searchLocation.name);
        }

        if (result.recommendations?.length > 0) {
            console.log("\nRECOMMENDATIONS:");

            result.recommendations.forEach((place, index) => {
                console.log(
                    `${index + 1}. ${place.name} - ${place.distanceKm} km`
                );
            });
        }
    }

    console.log("\n------------------------------\n");
}

console.log("LOKA INTELLIGENCE ENGINE TEST COMPLETED.");