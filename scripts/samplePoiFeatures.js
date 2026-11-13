const fs = require("fs");
const path = require("path");

const FILE_PATH = path.join(
    __dirname,
    "../data/planet_3.337_6.491_54276bb9.osm.geojson"
);

const geojson = JSON.parse(
    fs.readFileSync(FILE_PATH, "utf8")
);

const relevantTags = [
    "amenity",
    "shop",
    "tourism",
    "leisure",
    "healthcare",
    "office",
    "public_transport",
    "railway",
    "sport"
];

const samples = {
    Point: [],
    LineString: [],
    MultiPolygon: []
};

for (const feature of geojson.features) {
    const properties = feature.properties || {};
    const geometryType = feature.geometry?.type;

    const hasRelevantTag = relevantTags.some(tag =>
        properties[tag] !== undefined
    );

    if (!hasRelevantTag || !properties.name) {
        continue;
    }

    if (
        samples[geometryType] &&
        samples[geometryType].length < 3
    ) {
        samples[geometryType].push({
            id: feature.id || null,
            geometryType,
            name: properties.name,
            properties,
            geometryPreview:
                geometryType === "Point"
                    ? feature.geometry.coordinates
                    : "Geometry coordinates omitted"
        });
    }

    if (
        Object.values(samples).every(
            group => group.length >= 3
        )
    ) {
        break;
    }
}

console.log(
    JSON.stringify(samples, null, 2)
);