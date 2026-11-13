const fs = require("fs");
const path = require("path");

const filePath = path.join(
    __dirname,
    "../data/planet_3.337_6.491_54276bb9.osm.geojson"
);

const geojson = JSON.parse(fs.readFileSync(filePath, "utf8"));

const tagFields = [
    "amenity",
    "shop",
    "tourism",
    "leisure",
    "healthcare",
    "office",
    "public_transport",
    "railway",
    "sport",
    "education",
    "landuse",
    "highway"
];

const valueCounts = {};
const namedFeatures = {};
const namedByGeometry = {};
const samples = {};

let totalNamed = 0;

for (const field of tagFields) {
    valueCounts[field] = {};
    samples[field] = [];
}

for (const feature of geojson.features) {
    const properties = feature.properties || {};
    const geometry = feature.geometry?.type || "Unknown";

    const name =
        properties.name ||
        properties["name:en"] ||
        properties["official_name"];

    if (name) {
        totalNamed++;

        namedByGeometry[geometry] =
            (namedByGeometry[geometry] || 0) + 1;
    }

    for (const field of tagFields) {
        const value = properties[field];

        if (!value) continue;

        const values = Array.isArray(value) ? value : [value];

        for (const item of values) {
            const key = String(item);

            valueCounts[field][key] =
                (valueCounts[field][key] || 0) + 1;

            if (
                samples[field].length < 12 &&
                name
            ) {
                samples[field].push({
                    name,
                    value: key,
                    geometry
                });
            }
        }
    }
}

console.log("\nLOKA PLACE CATEGORY AUDIT");
console.log("================================");

console.log("Total features:", geojson.features.length);
console.log("Total named features:", totalNamed);

console.log("\nNAMED FEATURES BY GEOMETRY");
console.log("================================");
console.table(namedByGeometry);

for (const field of tagFields) {
    console.log(`\n${field.toUpperCase()} VALUES`);
    console.log("================================");

    const sorted = Object.entries(valueCounts[field])
        .sort((a, b) => b[1] - a[1]);

    console.table(
        sorted.map(([value, count]) => ({
            value,
            count
        }))
    );

    if (samples[field].length) {
        console.log(`NAMED ${field.toUpperCase()} EXAMPLES`);
        console.table(samples[field]);
    }
}

console.log("\nLOKA CATEGORY AUDIT COMPLETE");