const fs = require("fs");
const path = require("path");

const FILE_PATH = path.join(
    __dirname,
    "../data/planet_3.337_6.491_54276bb9.osm.geojson"
);

const geojson = JSON.parse(
    fs.readFileSync(FILE_PATH, "utf8")
);

const targets = [
    "Total Filling Station",
    "Lagos National Stadium Complex",
    "Lagos National Stadium"
];

for (const name of targets) {
    console.log("\n==================================");
    console.log("FEATURE:", name);
    console.log("==================================");

    const matches = geojson.features.filter(feature => {
        return feature.properties?.name === name;
    });

    for (const feature of matches) {
        console.log("\nGeometry:", feature.geometry?.type);

        console.log(
            "Properties:",
            JSON.stringify(feature.properties, null, 2)
        );

        const coordinates = feature.geometry?.coordinates;

        if (feature.geometry?.type === "LineString") {
            console.log(
                "First coordinates:",
                JSON.stringify(coordinates.slice(0, 5), null, 2)
            );
        }

        if (feature.geometry?.type === "MultiPolygon") {
            console.log(
                "First polygon coordinates:",
                JSON.stringify(
                    coordinates[0]?.[0]?.slice(0, 5),
                    null,
                    2
                )
            );
        }
    }
}