// ========================================
// LOKA - LOCAL PLACE PROCESSOR
// ========================================

const fs = require("fs");
const path = require("path");

const SOURCE_PATH = path.join(
    __dirname,
    "../../data/planet_3.366_6.485_eb1e0687.osm.geojson"
);

const OUTPUT_PATH = path.join(
    __dirname,
    "../../data/places.json"
);

// ========================================
// CATEGORY CLASSIFICATION
// ========================================

function classifyPlace(properties) {

    const p = properties;

    if (p.amenity === "restaurant") return "restaurant";
    if (p.amenity === "fast_food") return "fast_food";
    if (p.amenity === "cafe") return "cafe";
    if (p.amenity === "food_court") return "food_court";

    if (p.shop === "bakery") return "bakery";
    if (p.shop === "supermarket") return "supermarket";
    if (p.shop === "convenience") return "convenience_store";
    if (p.shop === "mall") return "shopping_mall";
    if (p.shop === "books") return "bookshop";

    if (p.amenity === "bank") return "bank";
    if (p.amenity === "atm") return "atm";

    if (p.amenity === "pharmacy") return "pharmacy";
    if (p.healthcare === "pharmacy") return "pharmacy";
    if (p.building === "pharmacy") return "pharmacy";

    if (p.amenity === "hospital") return "hospital";
    if (p.amenity === "clinic") return "clinic";
    if (p.healthcare === "hospital") return "hospital";
    if (p.healthcare === "clinic") return "clinic";

    if (p.amenity === "school") return "school";
    if (p.amenity === "university") return "university";
    if (p.office === "university") return "university";
    if (p.amenity === "college") return "college";

    if (p.amenity === "library") return "library";

    if (p.amenity === "cinema") return "cinema";

    if (p.amenity === "bus_station") return "bus_station";
    if (p.public_transport === "station") return "transport_station";

    if (p.amenity === "place_of_worship") return "place_of_worship";

    if (p.leisure === "park") return "park";
    if (p.leisure === "sports_centre") return "sports_centre";
    if (p.leisure === "stadium") return "stadium";
    if (p.leisure === "swimming_pool") return "swimming_pool";

    if (p.tourism === "hotel") return "hotel";
    if (p.tourism === "hostel") return "hostel";

    if (p.amenity === "fuel") return "fuel_station";

    if (p.amenity === "parking") return "parking";

    // Carefully controlled name-based classification.

    const name = String(p.name || "").toLowerCase();

    if (name.includes("cafeteria")) return "cafeteria";

    return null;
}

// ========================================
// GEOMETRY REPRESENTATIVE COORDINATES
// ========================================

function getRepresentativeCoordinates(geometry) {

    if (!geometry || !geometry.coordinates) {
        return null;
    }

    if (geometry.type === "Point") {

        const [longitude, latitude] = geometry.coordinates;

        if (
            !Number.isFinite(longitude) ||
            !Number.isFinite(latitude)
        ) {
            return null;
        }

        return {
            longitude,
            latitude
        };
    }

    const positions = [];

    function collectPositions(coordinates) {

        if (
            Array.isArray(coordinates) &&
            typeof coordinates[0] === "number" &&
            typeof coordinates[1] === "number"
        ) {

            positions.push(coordinates);
            return;
        }

        if (Array.isArray(coordinates)) {

            for (const item of coordinates) {
                collectPositions(item);
            }

        }
    }

    collectPositions(geometry.coordinates);

    if (positions.length === 0) {
        return null;
    }

    const longitudes = positions.map(position => position[0]);
    const latitudes = positions.map(position => position[1]);

    const minLongitude = Math.min(...longitudes);
    const maxLongitude = Math.max(...longitudes);

    const minLatitude = Math.min(...latitudes);
    const maxLatitude = Math.max(...latitudes);

    return {
        longitude: (minLongitude + maxLongitude) / 2,
        latitude: (minLatitude + maxLatitude) / 2
    };
}

// ========================================
// DUPLICATE PRIORITY
// ========================================

function getGeometryPriority(geometryType) {

    const priorities = {
        Point: 3,
        MultiPolygon: 2,
        Polygon: 2,
        LineString: 1,
        MultiLineString: 1
    };

    return priorities[geometryType] || 0;
}

// ========================================
// PROCESS DATASET
// ========================================

function processPlaces() {

    console.log("Starting LOKA place processing...");

    const rawData = fs.readFileSync(
        SOURCE_PATH,
        "utf8"
    );

    const dataset = JSON.parse(rawData);

    const placesMap = new Map();

    let classifiedFeatures = 0;
    let skippedFeatures = 0;
    let duplicateFeatures = 0;

    for (const feature of dataset.features || []) {

        const properties = feature.properties || {};

        const name = String(
            properties.name ||
            properties.official_name ||
            ""
        ).trim();

        if (!name) {
            skippedFeatures++;
            continue;
        }

        const category = classifyPlace(properties);

        if (!category) {
            skippedFeatures++;
            continue;
        }

        const coordinates =
            getRepresentativeCoordinates(feature.geometry);

        if (!coordinates) {
            skippedFeatures++;
            continue;
        }

        classifiedFeatures++;

        const normalizedName = name
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, " ")
            .trim();

        const key = `${normalizedName}::${category}`;

        const place = {

            name,

            category,

            location: coordinates,

            geometryType: feature.geometry.type,

            address: {
                street: properties["addr:street"] || null,
                city: properties["addr:city"] || null,
                postcode: properties["addr:postcode"] || null
            },

            openingHours: properties.opening_hours || null,

            website: properties.website || null,

            phone:
                properties.phone ||
                properties["contact:phone"] ||
                null,

            cuisine: properties.cuisine || null,

            source: "OpenStreetMap",

            classification:
                properties.amenity ||
                properties.shop ||
                properties.healthcare ||
                properties.office ||
                properties.leisure ||
                properties.tourism ||
                properties.building ||
                "name_inference"

        };

        const existing = placesMap.get(key);

        if (existing) {

            duplicateFeatures++;

            const newPriority = getGeometryPriority(
                place.geometryType
            );

            const oldPriority = getGeometryPriority(
                existing.geometryType
            );

            if (newPriority > oldPriority) {
                placesMap.set(key, place);
            }

        } else {

            placesMap.set(key, place);

        }

    }

    const places = Array.from(placesMap.values());

    const categoryCounts = {};

    for (const place of places) {

        categoryCounts[place.category] =
            (categoryCounts[place.category] || 0) + 1;

    }

    const output = {

        metadata: {

            generatedAt: new Date().toISOString(),

            source: "OpenStreetMap",

            totalSourceFeatures: dataset.features.length,

            classifiedFeatures,

            duplicateFeatures,

            skippedFeatures,

            totalUniquePlaces: places.length,

            categoryCounts

        },

        places

    };

    fs.writeFileSync(
        OUTPUT_PATH,
        JSON.stringify(output, null, 2),
        "utf8"
    );

    console.log("\nPROCESSING COMPLETED");

    console.log("\nPROCESSING SUMMARY:");

    console.table({
        TotalFeatures: dataset.features.length,
        ClassifiedFeatures: classifiedFeatures,
        DuplicateFeatures: duplicateFeatures,
        SkippedFeatures: skippedFeatures,
        UniquePlaces: places.length
    });

    console.log("\nPLACE CATEGORIES:");

    console.table(categoryCounts);

    console.log("\nOUTPUT FILE:");
    console.log(OUTPUT_PATH);

}

try {

    processPlaces();

} catch (error) {

    console.error(
        "Place processing failed:",
        error.message
    );

}