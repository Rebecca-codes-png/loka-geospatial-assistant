const fs = require("fs");
const path = require("path");

const DATA_PATH = path.join(__dirname, "../../data/places.json");

console.log("Starting LOKA database verification...\n");

if (!fs.existsSync(DATA_PATH)) {
    console.error("ERROR: places.json was not found.");
    process.exit(1);
}

const database = JSON.parse(fs.readFileSync(DATA_PATH, "utf8"));

const places = database.places;

if (!Array.isArray(places)) {
    console.error("ERROR: Invalid places database.");
    process.exit(1);
}

console.log("DATABASE SUMMARY");
console.log("-------------------------");
console.log("Total places:", places.length);
console.log("Source:", database.metadata.source);

console.log("\nCATEGORY COUNTS");
console.log("-------------------------");

console.table(database.metadata.categoryCounts);

console.log("\nIMPORTANT UNILAG LOCATIONS");
console.log("-------------------------");

const keywords = [
    "moremi",
    "king jaja",
    "faculty of law",
    "main library",
    "jaja shopping complex",
    "medical centre",
    "unilag cafeteria",
    "university of lagos"
];

for (const keyword of keywords) {
    const matches = places.filter(place =>
        place.name.toLowerCase().includes(keyword)
    );

    console.log(`\n${keyword.toUpperCase()}:`);

    if (matches.length === 0) {
        console.log("Not found");
        continue;
    }

    matches.forEach(place => {
        console.log({
            name: place.name,
            category: place.category,
            latitude: place.location.latitude,
            longitude: place.location.longitude,
            geometryType: place.geometryType
        });
    });
}

console.log("\nDATABASE VERIFICATION COMPLETED.");