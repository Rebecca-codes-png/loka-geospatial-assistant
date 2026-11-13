const fs = require("fs");
const path = require("path");

const { point, booleanPointInPolygon } = require("@turf/turf");

const BOUNDARY_PATH = path.join(
    __dirname,
    "../../data/unilag-campus-boundary.candidate.geojson"
);

let campusBoundary = null;

function loadCampusBoundary() {
    if (campusBoundary) {
        return campusBoundary;
    }

    if (!fs.existsSync(BOUNDARY_PATH)) {
        throw new Error("UNILAG campus boundary was not found.");
    }

    const database = JSON.parse(
        fs.readFileSync(BOUNDARY_PATH, "utf8")
    );

    const boundary = database.features?.find(feature => {
        return (
            feature.geometry?.type === "Polygon" ||
            feature.geometry?.type === "MultiPolygon"
        );
    });

    if (!boundary) {
        throw new Error("UNILAG campus boundary is invalid.");
    }

    campusBoundary = boundary;

    return campusBoundary;
}

function isInsideUnilag(latitude, longitude) {
    if (
        !Number.isFinite(latitude) ||
        !Number.isFinite(longitude)
    ) {
        throw new Error("Invalid coordinates supplied to geofence.");
    }

    const boundary = loadCampusBoundary();

    const userPoint = point([longitude, latitude]);

    return booleanPointInPolygon(userPoint, boundary);
}

function getCampusStatus(latitude, longitude) {
    const inside = isInsideUnilag(latitude, longitude);

    return inside
        ? "INSIDE UNILAG CAMPUS"
        : "OUTSIDE UNILAG CAMPUS";
}

module.exports = {
    loadCampusBoundary,
    isInsideUnilag,
    getCampusStatus
};