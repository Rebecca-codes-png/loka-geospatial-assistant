const fs = require("fs");
const path = require("path");

const sourcePath = path.join(
    __dirname,
    "../planet_3.337_6.491_54276bb9.osm.geojson"
);

const outputPath = path.join(
    __dirname,
    "../data/unilag-campus-boundary.candidate.geojson"
);

function calculateRingArea(ring) {
    const earthRadius = 6371008.8;
    let area = 0;

    for (let i = 0; i < ring.length - 1; i++) {
        const [lon1, lat1] = ring[i];
        const [lon2, lat2] = ring[i + 1];

        const longitudeDifference =
            (lon2 - lon1) * Math.PI / 180;

        const latitude1 = lat1 * Math.PI / 180;
        const latitude2 = lat2 * Math.PI / 180;

        area += longitudeDifference *
            (2 + Math.sin(latitude1) + Math.sin(latitude2));
    }

    return Math.abs(area * earthRadius * earthRadius / 2);
}

function calculateMultiPolygonArea(coordinates) {
    let totalArea = 0;

    for (const polygon of coordinates) {
        for (let i = 0; i < polygon.length; i++) {
            const ringArea = calculateRingArea(polygon[i]);

            if (i === 0) {
                totalArea += ringArea;
            } else {
                totalArea -= ringArea;
            }
        }
    }

    return totalArea;
}

function getBounds(coordinates) {
    const points = coordinates.flat(2);

    const longitudes = points.map(point => point[0]);
    const latitudes = points.map(point => point[1]);

    return {
        west: Math.min(...longitudes),
        south: Math.min(...latitudes),
        east: Math.max(...longitudes),
        north: Math.max(...latitudes)
    };
}

function main() {
    console.log("Reading Lagos OpenStreetMap dataset...");

    const dataset = JSON.parse(
        fs.readFileSync(sourcePath, "utf8")
    );

    const boundary = dataset.features.find(feature => {
        return (
            feature.properties?.name === "University of Lagos" &&
            feature.properties?.wikidata === "Q1782980" &&
            feature.geometry?.type === "MultiPolygon"
        );
    });

    if (!boundary) {
        throw new Error(
            "University of Lagos MultiPolygon boundary not found."
        );
    }

    const areaSquareMetres = calculateMultiPolygonArea(
        boundary.geometry.coordinates
    );

    const areaSquareKilometres = areaSquareMetres / 1000000;

    const result = {
        type: "FeatureCollection",
        name: "LOKA UNILAG Akoka Campus Boundary",
        attribution: "© OpenStreetMap contributors",
        features: [boundary]
    };

    fs.writeFileSync(
        outputPath,
        JSON.stringify(result, null, 2)
    );

    console.log("\nBOUNDARY EXTRACTED");
    console.log("Geometry:", boundary.geometry.type);
    console.log(
        "Polygon count:",
        boundary.geometry.coordinates.length
    );
    console.log(
        "Area:",
        areaSquareKilometres.toFixed(3),
        "km²"
    );
    console.log("Bounds:", getBounds(boundary.geometry.coordinates));
    console.log("Output:", outputPath);
}

main();