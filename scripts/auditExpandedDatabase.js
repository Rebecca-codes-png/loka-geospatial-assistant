const fs = require("fs");
const path = require("path");

const DATABASE_PATH = path.join(
    __dirname,
    "../data/places.expanded.test.json"
);

const database = JSON.parse(
    fs.readFileSync(DATABASE_PATH, "utf8")
);

const places = database.places;

const hospitals = places.filter(
    place => place.category === "hospital"
);

console.log("LOKA EXPANDED DATABASE AUDIT");
console.log("----------------------------------");

console.log("Total places:", places.length);
console.log("Hospital records:", hospitals.length);

console.log("\nFIRST 30 HOSPITAL RECORDS");
console.log("----------------------------------");

hospitals.slice(0, 30).forEach((place, index) => {
    console.log(`\n${index + 1}. ${place.name}`);

    console.log("Coordinates:", place.location);
    console.log("Geometry:", place.geometryType);
    console.log("Address:", place.address);
    console.log("Source:", place.source);
});

console.log("\nCATEGORY COUNTS");
console.log("----------------------------------");

const counts = {};

for (const place of places) {
    counts[place.category] =
        (counts[place.category] || 0) + 1;
}

Object.entries(counts)
    .sort((a, b) => b[1] - a[1])
    .forEach(([category, count]) => {
        console.log(`${category}: ${count}`);
    });

console.log("\nCOORDINATE VALIDATION");
console.log("----------------------------------");

const invalidCoordinates = places.filter(place => {
    const longitude = place.location?.longitude;
    const latitude = place.location?.latitude;

    return (
        !Number.isFinite(longitude) ||
        !Number.isFinite(latitude) ||
        longitude < 3 ||
        longitude > 4 ||
        latitude < 6 ||
        latitude > 7
    );
});

console.log(
    "Invalid or unexpected coordinates:",
    invalidCoordinates.length
);