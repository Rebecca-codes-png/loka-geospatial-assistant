// ========================================
// LOKA - PLACE CATEGORY INSPECTION
// ========================================

const fs = require("fs");
const path = require("path");

const datasetPath = path.join(
    __dirname,
    "../../data/planet_3.366_6.485_eb1e0687.osm.geojson"
);

console.log("Inspecting LOKA place categories...");

try {
    const rawData = fs.readFileSync(datasetPath, "utf8");
    const dataset = JSON.parse(rawData);

    const categoryKeys = [
        "amenity",
        "shop",
        "healthcare",
        "leisure",
        "tourism",
        "office",
        "public_transport",
        "railway",
        "sport",
        "craft"
    ];

    const categoryCounts = {};
    const categoryValues = {};
    const placeSamples = [];

    for (const key of categoryKeys) {
        categoryValues[key] = {};
    }

    for (const feature of dataset.features || []) {

        const properties = feature.properties || {};

        let hasPlaceCategory = false;

        for (const key of categoryKeys) {

            const value = properties[key];

            if (value) {

                hasPlaceCategory = true;

                categoryValues[key][value] =
                    (categoryValues[key][value] || 0) + 1;

                categoryCounts[key] =
                    (categoryCounts[key] || 0) + 1;
            }
        }

        if (hasPlaceCategory && placeSamples.length < 40) {

            placeSamples.push({
                name: properties.name || "Unnamed",
                categories: Object.fromEntries(
                    categoryKeys
                        .filter(key => properties[key])
                        .map(key => [key, properties[key]])
                ),
                geometry: feature.geometry?.type || "Unknown"
            });
        }
    }

    console.log("\nTOTAL FEATURES:");
    console.log(dataset.features.length);

    console.log("\nPLACE CATEGORY COUNTS:");
    console.table(categoryCounts);

    console.log("\nCATEGORY VALUES:");

    for (const key of categoryKeys) {

        if (Object.keys(categoryValues[key]).length > 0) {

            console.log(`\n${key.toUpperCase()}`);
            console.table(categoryValues[key]);
        }
    }

    console.log("\nSAMPLE PLACE FEATURES:");
    console.dir(placeSamples, {
        depth: 5
    });

    console.log("\nPlace category inspection completed.");

} catch (error) {

    console.error(
        "Inspection failed:",
        error.message
    );

}