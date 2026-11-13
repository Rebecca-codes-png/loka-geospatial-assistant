const fs = require("fs");
const path = require("path");

const GEOJSON_PATH = path.join(
    __dirname,
    "../data/planet_3.337_6.491_54276bb9.osm.geojson"
);

const DATABASE_PATH = path.join(
    __dirname,
    "../data/places.expanded.test.json"
);

const geojson = JSON.parse(
    fs.readFileSync(GEOJSON_PATH, "utf8")
);

const database = JSON.parse(
    fs.readFileSync(DATABASE_PATH, "utf8")
);

const hospitals = database.places.filter(
    place => place.category === "hospital"
);

function normalizeName(name) {
    return String(name || "")
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, " ")
        .trim();
}

console.log("LOKA HOSPITAL CLASSIFICATION AUDIT");
console.log("----------------------------------");

for (const hospital of hospitals) {
    const matches = geojson.features.filter(feature => {
        return (
            normalizeName(feature.properties?.name) ===
            normalizeName(hospital.name)
        );
    });

    if (!matches.length) {
        continue;
    }

    console.log("\nPLACE:", hospital.name);

    for (const match of matches) {
        const properties = match.properties || {};

        console.log("Geometry:", match.geometry?.type);

        console.log("Relevant OSM tags:", {
            amenity: properties.amenity || null,
            healthcare: properties.healthcare || null,
            name: properties.name || null,
            office: properties.office || null,
            description: properties.description || null,
            operator: properties.operator || null
        });
    }
}