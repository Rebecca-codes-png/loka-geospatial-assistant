// ========================================
// LOKA - CAMPUS FEATURE INSPECTION
// ========================================

const fs = require("fs");
const path = require("path");

const datasetPath = path.join(
    __dirname,
    "../../data/planet_3.366_6.485_eb1e0687.osm.geojson"
);

const searchTerms = [
    "university of lagos",
    "unilag cafeteria",
    "unilag pharmacy",
    "unilag medical centre",
    "unilag main library",
    "jaja shopping complex",
    "moremi hall",
    "faculty of law",
    "faculty of engineering"
];

try {

    console.log("Inspecting important UNILAG features...");

    const rawData = fs.readFileSync(datasetPath, "utf8");
    const dataset = JSON.parse(rawData);

    const results = [];

    for (const feature of dataset.features) {

        const properties = feature.properties || {};

        const name = String(
            properties.name || ""
        ).toLowerCase();

        const matchedTerm = searchTerms.find(term =>
            name.includes(term)
        );

        if (!matchedTerm) {
            continue;
        }

        const coordinates = feature.geometry?.coordinates;

        results.push({

            matchedTerm,

            featureId: feature.id || "No feature ID",

            name: properties.name,

            properties,

            geometryType: feature.geometry?.type,

            coordinatePreview: coordinates
                ? JSON.stringify(coordinates).slice(0, 180)
                : "No coordinates"

        });

    }

    console.log("\nMATCHING FEATURES:");
    console.dir(results, {
        depth: 5
    });

    console.log("\nTOTAL MATCHING FEATURES:");
    console.log(results.length);

    console.log("\nInspection completed.");

} catch (error) {

    console.error(
        "Inspection failed:",
        error.message
    );

}