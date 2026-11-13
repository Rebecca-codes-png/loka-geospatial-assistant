const fs = require("fs");
const path = require("path");

const GEOJSON_PATH = path.join(
    __dirname,
    "../data/planet_3.337_6.491_54276bb9.osm.geojson"
);

const EXISTING_DATABASE_PATH = path.join(
    __dirname,
    "../data/places.json"
);

const OUTPUT_PATH = path.join(
    __dirname,
    "../data/places.expanded.test.json"
);

const EARTH_RADIUS_METRES = 6371000;
const DUPLICATE_DISTANCE_METRES = 75;

const CATEGORY_PRIORITY = [
    ["amenity", {
        place_of_worship: "place_of_worship",
        fast_food: "fast_food",
        restaurant: "restaurant",
        food_court: "restaurant",
        cafe: "cafe",
        internet_cafe: "cafe",
        school: "school",
        kindergarten: "school",
        college: "college",
        university: "university",
        bank: "bank",
        atm: "atm",
        fuel: "fuel_station",
        bus_station: "bus_station",
        ferry_terminal: "transport_station",
        police: "police",
        pharmacy: "pharmacy",
        clinic: "clinic",
        hospital: "hospital",
        health_centre: "clinic",
        fire_station: "fire_station",
        library: "library",
        cinema: "cinema",
        marketplace: "market",
        taxi: "transport_station",
        parking: "parking",
        charging_station: "charging_station",
        money_transfer: "bank"
    }],
    ["healthcare", {
        hospital: "hospital",
        clinic: "clinic",
        pharmacy: "pharmacy"
    }],
    ["shop", {
        bakery: "bakery",
        supermarket: "supermarket",
        convenience: "convenience_store",
        books: "bookshop",
        mall: "shopping_mall",
        clothes: "clothing_store",
        fashion_accessories: "clothing_store",
        computer: "electronics_store",
        copyshop: "printing_shop",
        butcher: "butcher",
        seafood: "seafood",
        hardware: "hardware_store"
    }],
    ["tourism", {
        hostel: "hostel",
        hotel: "hotel",
        motel: "hotel"
    }],
    ["leisure", {
        sports_centre: "sports_centre",
        stadium: "stadium",
        park: "park",
        swimming_pool: "sports_centre",
        sports_hall: "sports_centre",
        pitch: "sports_centre",
        garden: "park"
    }],
    ["office", {
        university: "university",
        coworking: "coworking_space"
    }],
    ["public_transport", {
        station: "transport_station",
        platform: "transport_station"
    }],
    ["railway", {
        station: "transport_station",
        platform: "transport_station"
    }]
];

const GEOMETRY_PRIORITY = {
    Point: 3,
    MultiPolygon: 2,
    Polygon: 2,
    LineString: 1
};

function normalizeName(name) {
    return String(name || "")
        .toLowerCase()
        .normalize("NFKD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/[^a-z0-9]+/g, " ")
        .trim();
}

function isValidCoordinate(longitude, latitude) {
    return (
        Number.isFinite(longitude) &&
        Number.isFinite(latitude) &&
        longitude >= -180 &&
        longitude <= 180 &&
        latitude >= -90 &&
        latitude <= 90
    );
}

function calculateDistanceMetres(a, b) {
    const toRadians = value => value * Math.PI / 180;

    const lat1 = toRadians(a.latitude);
    const lat2 = toRadians(b.latitude);

    const deltaLat = toRadians(b.latitude - a.latitude);
    const deltaLon = toRadians(b.longitude - a.longitude);

    const haversine =
        Math.sin(deltaLat / 2) ** 2 +
        Math.cos(lat1) *
        Math.cos(lat2) *
        Math.sin(deltaLon / 2) ** 2;

    return 2 * EARTH_RADIUS_METRES *
        Math.atan2(
            Math.sqrt(haversine),
            Math.sqrt(1 - haversine)
        );
}

function calculateRingCentroid(ring) {
    if (!Array.isArray(ring) || ring.length < 3) {
        return null;
    }

    let area = 0;
    let longitudeSum = 0;
    let latitudeSum = 0;

    for (let i = 0; i < ring.length - 1; i++) {
        const [x1, y1] = ring[i];
        const [x2, y2] = ring[i + 1];

        const cross = x1 * y2 - x2 * y1;

        area += cross;
        longitudeSum += (x1 + x2) * cross;
        latitudeSum += (y1 + y2) * cross;
    }

    if (Math.abs(area) < 1e-12) {
        return null;
    }

    const divisor = 3 * area;

    const longitude = longitudeSum / divisor;
    const latitude = latitudeSum / divisor;

    if (!isValidCoordinate(longitude, latitude)) {
        return null;
    }

    return { longitude, latitude };
}

function calculateAveragePosition(points) {
    const validPoints = points.filter(point =>
        Array.isArray(point) &&
        isValidCoordinate(point[0], point[1])
    );

    if (!validPoints.length) {
        return null;
    }

    const total = validPoints.reduce(
        (result, point) => {
            result.longitude += point[0];
            result.latitude += point[1];
            return result;
        },
        { longitude: 0, latitude: 0 }
    );

    return {
        longitude: total.longitude / validPoints.length,
        latitude: total.latitude / validPoints.length
    };
}

function calculateLineMidpoint(coordinates) {
    if (!Array.isArray(coordinates) || coordinates.length < 2) {
        return null;
    }

    const segments = [];
    let totalDistance = 0;

    for (let i = 0; i < coordinates.length - 1; i++) {
        const start = coordinates[i];
        const end = coordinates[i + 1];

        if (
            !Array.isArray(start) ||
            !Array.isArray(end) ||
            !isValidCoordinate(start[0], start[1]) ||
            !isValidCoordinate(end[0], end[1])
        ) {
            continue;
        }

        const distance = calculateDistanceMetres(
            { longitude: start[0], latitude: start[1] },
            { longitude: end[0], latitude: end[1] }
        );

        segments.push({ start, end, distance });
        totalDistance += distance;
    }

    if (!segments.length || totalDistance === 0) {
        return calculateAveragePosition(coordinates);
    }

    const midpointDistance = totalDistance / 2;
    let travelled = 0;

    for (const segment of segments) {
        if (travelled + segment.distance >= midpointDistance) {
            const remaining =
                midpointDistance - travelled;

            const ratio = remaining / segment.distance;

            return {
                longitude:
                    segment.start[0] +
                    (segment.end[0] - segment.start[0]) * ratio,

                latitude:
                    segment.start[1] +
                    (segment.end[1] - segment.start[1]) * ratio
            };
        }

        travelled += segment.distance;
    }

    return calculateAveragePosition(coordinates);
}

function getPolygonPosition(coordinates) {
    if (!Array.isArray(coordinates) || !coordinates.length) {
        return null;
    }

    const polygons = coordinates
        .map(polygon => {
            const outerRing = polygon?.[0];

            if (!Array.isArray(outerRing)) {
                return null;
            }

            const centroid = calculateRingCentroid(outerRing);

            if (!centroid) {
                return null;
            }

            return {
                centroid,
                area: Math.abs(
                    calculateRingArea(outerRing)
                )
            };
        })
        .filter(Boolean)
        .sort((a, b) => b.area - a.area);

    if (!polygons.length) {
        return null;
    }

    return polygons[0].centroid;
}

function calculateRingArea(ring) {
    let area = 0;

    for (let i = 0; i < ring.length - 1; i++) {
        const [x1, y1] = ring[i];
        const [x2, y2] = ring[i + 1];

        area += x1 * y2 - x2 * y1;
    }

    return area / 2;
}

function getRepresentativePosition(geometry) {
    if (!geometry) {
        return null;
    }

    const { type, coordinates } = geometry;

    if (type === "Point") {
        if (
            !Array.isArray(coordinates) ||
            !isValidCoordinate(coordinates[0], coordinates[1])
        ) {
            return null;
        }

        return {
            longitude: coordinates[0],
            latitude: coordinates[1]
        };
    }

    if (type === "LineString") {
        return calculateLineMidpoint(coordinates);
    }

    if (type === "Polygon") {
        return getPolygonPosition([coordinates]);
    }

    if (type === "MultiPolygon") {
        return getPolygonPosition(coordinates);
    }

    return null;
}

function getGeometryVertexSignature(geometry) {
    if (!geometry || !geometry.coordinates) {
        return null;
    }

    const vertices = new Set();

    function collectCoordinates(value) {
        if (!Array.isArray(value)) {
            return;
        }

        if (
            value.length >= 2 &&
            typeof value[0] === "number" &&
            typeof value[1] === "number"
        ) {
            vertices.add(
                `${value[0].toFixed(7)},${value[1].toFixed(7)}`
            );
            return;
        }

        for (const child of value) {
            collectCoordinates(child);
        }
    }

    collectCoordinates(geometry.coordinates);

    if (vertices.size === 0) {
        return null;
    }

    const sortedVertices = [...vertices].sort();

    return `${sortedVertices.length}:${sortedVertices.join("|")}`;
}

function classifyPlace(properties) {
    const name = String(properties.name || "").toLowerCase().trim();

    // Bus stops can be mapped using highway=bus_stop.
    if (properties.highway === "bus_stop") {
        return "bus_station";
    }

    // Do not classify roads as places just because their names
    // contain words associated with a place category.
    if (properties.highway) {
        return null;
    }

    // More specific healthcare tags take priority.
    const healthcareMappings = {
        hospital: "hospital",
        clinic: "clinic",
        doctor: "clinic",
        dentist: "clinic",
        midwife: "clinic",
        pharmacy: "pharmacy"
    };

    if (
        properties.healthcare &&
        healthcareMappings[properties.healthcare]
    ) {
        return healthcareMappings[properties.healthcare];
    }

    // Explicitly named hospitals.
    if (
        /\b(hospital|teaching hospital|general hospital|psychiatric hospital)\b/.test(name)
    ) {
        return "hospital";
    }

    // Primary healthcare facilities.
    if (
        /\b(primary health|primary healthcare|health centre|health center|health care centre|health care center|phc)\b/.test(name)
    ) {
        return "clinic";
    }

    // Clinics and other direct healthcare services.
    if (
        /\b(clinic|maternity|nursing home|midwife|dental clinic|dentist)\b/.test(name)
    ) {
        return "clinic";
    }

    // General medical centres and laboratories.
    if (
        /\b(medical centre|medical center|med centre|med center|diagnostic|diagnostics|medical laboratory|pathology laboratory)\b/.test(name)
    ) {
        return "medical_facility";
    }

    // Explicitly named emergency operations centres.
    if (
        /\bemergency operations cent(re|er)\b/.test(name)
    ) {
        return "medical_facility";
    }

    // Ambiguous amenity=hospital records are not automatically
    // presented as hospitals.
    if (properties.amenity === "hospital") {
        return "medical_facility";
    }

    // Use the existing category mappings.
    for (const [tag, mappings] of CATEGORY_PRIORITY) {
        const value = properties[tag];

        if (!value || typeof value !== "string") {
            continue;
        }

        if (mappings[value]) {
            return mappings[value];
        }
    }

    return null;
}
function createPlace(feature) {
    const properties = feature.properties || {};
    const name = String(properties.name || "").trim();

    if (!name) {
        return null;
    }

    const category = classifyPlace(properties);

    if (!category) {
        return null;
    }

    const location = getRepresentativePosition(feature.geometry);

    if (!location) {
        return null;
    }

    const place = {
        name,
        category,
        location,
        geometryType: feature.geometry.type,
        address: {
            street:
                properties["addr:street"] ||
                properties["addr:full"] ||
                null,
            city:
                properties["addr:city"] ||
                "Lagos",
            postcode:
                properties["addr:postcode"] ||
                null
        },
        openingHours:
            properties.opening_hours ||
            null,
        website:
            properties.website ||
            properties["contact:website"] ||
            null,
        phone:
            properties.phone ||
            properties["contact:phone"] ||
            null,
        cuisine:
            properties.cuisine ||
            null,
        source: "OpenStreetMap",
        classification: category
    };

    Object.defineProperty(place, "_geometryVertexSignature", {
        value: getGeometryVertexSignature(feature.geometry),
        enumerable: false
    });

    return place;
}

function getGeometryPriority(place) {
    return GEOMETRY_PRIORITY[place.geometryType] || 0;
}

function isDuplicate(place, existingPlaces, distanceLimit) {
    const normalizedName = normalizeName(place.name);

    return existingPlaces.some(existing => {
        if (
            normalizeName(existing.name) !== normalizedName
        ) {
            return false;
        }

        if (
            !isValidCoordinate(
                existing.location?.longitude,
                existing.location?.latitude
            )
        ) {
            return false;
        }

        const distance = calculateDistanceMetres(
            place.location,
            existing.location
        );

        return distance <= distanceLimit;
    });
}

function reclassifyExistingPlace(place) {
    const name = String(place.name || "").toLowerCase().trim();

    const categoryOverrides = {
        "st claire specialist clinic": "clinic",
        "vnusamin clinic": "clinic",
        "redeemtion medical clinic": "clinic",
        "kajla primary health center": "clinic",
        "kayode health center onipanu": "clinic",
        "a and a medical diagostic center": "medical_facility",
        "jag-bon medical center": "medical_facility",
        "lagos emergency operations center": "medical_facility",
        "ayeitoro phc": "clinic"
    };

    const category = categoryOverrides[name] || place.category;

    return {
        ...place,
        category,
        classification: category
    };
}

function loadJSON(filePath, label) {
    if (!fs.existsSync(filePath)) {
        throw new Error(`${label} was not found: ${filePath}`);
    }

    return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function main() {
    console.log("LOKA EXPANDED DATA PROCESSOR");
    console.log("----------------------------------");

    const geojson = loadJSON(
        GEOJSON_PATH,
        "Expanded GeoJSON dataset"
    );

    const existingDatabase = loadJSON(
        EXISTING_DATABASE_PATH,
        "Existing places database"
    );

    if (!Array.isArray(geojson.features)) {
        throw new Error("The GeoJSON features array is invalid.");
    }

    if (!Array.isArray(existingDatabase.places)) {
        throw new Error("The existing places array is invalid.");
    }

    const existingPlaces = existingDatabase.places.map(
    reclassifyExistingPlace
);

    const candidates = [];
    const stats = {
        totalFeatures: geojson.features.length,
        namedFeatures: 0,
        supportedFeatures: 0,
        unsupportedFeatures: 0,
        invalidFeatures: 0,
        duplicateCandidates: 0,
        imported: 0
    };

    for (const feature of geojson.features) {
        if (feature.properties?.name) {
            stats.namedFeatures++;
        }

        const place = createPlace(feature);

        if (!place) {
            if (
                feature.properties?.name &&
                !classifyPlace(feature.properties || {})
            ) {
                stats.unsupportedFeatures++;
            } else {
                stats.invalidFeatures++;
            }

            continue;
        }

        stats.supportedFeatures++;
        candidates.push(place);
    }

    candidates.sort(
        (a, b) =>
            getGeometryPriority(b) -
            getGeometryPriority(a)
    );

    const acceptedPlaces = [];
const seenGeometryKeys = new Set();

for (const place of candidates) {
    const signature = place._geometryVertexSignature;

    const geometryKey = signature
        ? `${normalizeName(place.name)}::${signature}`
        : null;

    // Skip geometrically identical features, even when
    // the preferred feature already exists in the database.
    if (
        geometryKey &&
        seenGeometryKeys.has(geometryKey)
    ) {
        stats.duplicateCandidates++;
        continue;
    }

    if (geometryKey) {
        seenGeometryKeys.add(geometryKey);
    }

    if (
        isDuplicate(
            place,
            existingPlaces,
            DUPLICATE_DISTANCE_METRES
        )
    ) {
        stats.duplicateCandidates++;
        continue;
    }

    if (
        isDuplicate(
            place,
            acceptedPlaces,
            DUPLICATE_DISTANCE_METRES
        )
    ) {
        stats.duplicateCandidates++;
        continue;
    }

    acceptedPlaces.push(place);
}

    const finalPlaces = [
        ...existingPlaces,
        ...acceptedPlaces
    ];

    stats.imported = acceptedPlaces.length;

    const categoryCounts = {};

    for (const place of acceptedPlaces) {
        categoryCounts[place.category] =
            (categoryCounts[place.category] || 0) + 1;
    }

    const outputDatabase = {
        ...existingDatabase,
        places: finalPlaces,
        attribution: "© OpenStreetMap contributors",
        dataNotes: {
            source: "OpenStreetMap",
            geographicCoverage: "LOKA expanded Lagos extract",
            attribution: "© OpenStreetMap contributors",
            generatedAt: new Date().toISOString(),
            note: "OpenStreetMap data may be incomplete or outdated."
        }
    };

    fs.writeFileSync(
        OUTPUT_PATH,
        JSON.stringify(outputDatabase, null, 2),
        "utf8"
    );

    console.log("\nPROCESSING SUMMARY");
    console.log("----------------------------------");

    for (const [key, value] of Object.entries(stats)) {
        console.log(`${key}: ${value}`);
    }

    console.log("\nNEW PLACES BY CATEGORY");
    console.log("----------------------------------");

    for (const [category, count] of Object.entries(categoryCounts)) {
        console.log(`${category}: ${count}`);
    }

    console.log("\nDATABASE SUMMARY");
    console.log("----------------------------------");
    console.log(`Existing places: ${existingPlaces.length}`);
    console.log(`New places: ${acceptedPlaces.length}`);
    console.log(`Total places: ${finalPlaces.length}`);

    console.log("\nOUTPUT FILE");
    console.log(OUTPUT_PATH);

    console.log("\nExisting places.json was not modified.");
}

try {
    main();
} catch (error) {
    console.error("\nPROCESSING FAILED");
    console.error(error.message);
    process.exitCode = 1;
}