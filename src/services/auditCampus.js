// ========================================
// LOKA - UNILAG DATASET AUDIT
// ========================================

const fs = require("fs");
const path = require("path");

const datasetPath = path.join(
    __dirname,
    "../../data/planet_3.366_6.485_eb1e0687.osm.geojson"
);

const campusKeywords = [
    "unilag",
    "university of lagos",
    "akoka",
    "moremi",
    "jaja",
    "faculty",
    "dli",
    "student",
    "campus",
    "lagos"
];

try {

    console.log("Starting UNILAG coverage audit...");

    const rawData = fs.readFileSync(datasetPath, "utf8");
    const dataset = JSON.parse(rawData);

    const campusMatches = [];
    const foodPlaces = [];
    const namedPlaceCount = {};

    for (const feature of dataset.features) {

        const properties = feature.properties || {};

        const name =
            properties.name ||
            properties.official_name ||
            properties.alt_name ||
            "";

        const searchableName = String(name).toLowerCase();

        const categories = {};

        const categoryKeys = [
            "amenity",
            "shop",
            "healthcare",
            "leisure",
            "tourism",
            "office",
            "sport",
            "railway",
            "public_transport"
        ];

        for (const key of categoryKeys) {

            if (properties[key]) {
                categories[key] = properties[key];
            }
        }

        if (name) {

            for (const key of Object.keys(categories)) {

                namedPlaceCount[key] =
                    (namedPlaceCount[key] || 0) + 1;

            }
        }

        if (
            name &&
            campusKeywords.some(keyword =>
                searchableName.includes(keyword)
            )
        ) {

            campusMatches.push({
                name,
                categories,
                geometry: feature.geometry?.type || "Unknown"
            });

        }

        const foodCategories = [
            "restaurant",
            "fast_food",
            "cafe",
            "food_court",
            "ice_cream",
            "bakery"
        ];

        const isFoodPlace =
            foodCategories.includes(properties.amenity) ||
            foodCategories.includes(properties.shop) ||
            Boolean(properties.cuisine);

        if (isFoodPlace) {

            foodPlaces.push({
                name: name || "Unnamed",
                amenity: properties.amenity || null,
                shop: properties.shop || null,
                cuisine: properties.cuisine || null,
                geometry: feature.geometry?.type || "Unknown"
            });

        }

    }

    console.log("\nNAMED PLACES BY CATEGORY:");
    console.table(namedPlaceCount);

    console.log("\nPOSSIBLE UNILAG AND CAMPUS FEATURES:");

    console.dir(campusMatches, {
        depth: 5
    });

    console.log("\nFOOD PLACES:");

    console.dir(foodPlaces, {
        depth: 5
    });

    console.log("\nTOTAL CAMPUS MATCHES:");
    console.log(campusMatches.length);

    console.log("\nTOTAL FOOD PLACES:");
    console.log(foodPlaces.length);

    console.log("\nCampus audit completed.");

} catch (error) {

    console.error(
        "Campus audit failed:",
        error.message
    );

}