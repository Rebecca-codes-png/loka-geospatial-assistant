const fs = require("fs");
const path = require("path");

const filePath = path.join(
    __dirname,
    "../data/planet_3.337_6.491_54276bb9.osm.geojson"
);

console.log("LOKA GEOJSON DATASET INSPECTOR");
console.log("--------------------------------");

if (!fs.existsSync(filePath)) {
    console.error("GeoJSON file not found:", filePath);
    process.exit(1);
}

const fileSize = fs.statSync(filePath).size;

console.log("File size:", (fileSize / (1024 * 1024)).toFixed(2), "MB");

const rawData = fs.readFileSync(filePath, "utf8");
const geojson = JSON.parse(rawData);

if (!Array.isArray(geojson.features)) {
    console.error("This file does not contain a valid GeoJSON FeatureCollection.");
    process.exit(1);
}

const features = geojson.features;

console.log("Total features:", features.length);

const geometryCounts = {};
const tagCounts = {};
const samples = [];

for (const feature of features) {
    const geometryType = feature.geometry?.type || "Unknown";

    geometryCounts[geometryType] =
        (geometryCounts[geometryType] || 0) + 1;

    const properties = feature.properties || {};

    for (const [key, value] of Object.entries(properties)) {
        if (value !== null && value !== undefined && value !== "") {
            tagCounts[key] = (tagCounts[key] || 0) + 1;
        }
    }

    if (samples.length < 15) {
        samples.push({
            name: properties.name || properties["name:en"] || "Unnamed",
            properties,
            geometry: geometryType
        });
    }
}

console.log("\nGEOMETRY BREAKDOWN");
console.log("--------------------------------");
console.table(geometryCounts);

console.log("\nMOST COMMON PROPERTY KEYS");
console.log("--------------------------------");

const sortedTags = Object.entries(tagCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 35);

console.table(
    sortedTags.map(([property, count]) => ({
        property,
        count
    }))
);

console.log("\n15 SAMPLE FEATURES");
console.log("--------------------------------");
console.dir(samples, { depth: 5 });

console.log("\nINSPECTION COMPLETE");