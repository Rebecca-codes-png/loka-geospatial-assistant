const fs = require("fs");
const path = require("path");

const { calculateDistance } = require("../utils/distance");
const { getCampusStatus } = require("./geofenceService");

const DATA_PATH = path.join(__dirname, "../../data/places.json");

function loadPlaces() {
    if (!fs.existsSync(DATA_PATH)) {
        throw new Error("LOKA places database was not found.");
    }

    const database = JSON.parse(
        fs.readFileSync(DATA_PATH, "utf8")
    );

    if (!Array.isArray(database.places)) {
        throw new Error("LOKA places database is invalid.");
    }

    return database.places;
}

function isValidCoordinate(latitude, longitude) {
    return (
        Number.isFinite(latitude) &&
        Number.isFinite(longitude) &&
        latitude >= -90 &&
        latitude <= 90 &&
        longitude >= -180 &&
        longitude <= 180
    );
}

function addCampusStatus(place) {
    return {
        ...place,
        campusStatus: getCampusStatus(
            place.location.latitude,
            place.location.longitude
        )
    };
}

function findNearbyPlaces({
    latitude,
    longitude,
    category = null,
    radiusKm = 5,
    limit = 10
}) {
    if (!isValidCoordinate(latitude, longitude)) {
        throw new Error("Invalid search coordinates.");
    }

    const places = loadPlaces();

    const results = places
        .filter(place => {
            if (!isValidCoordinate(
                place.location?.latitude,
                place.location?.longitude
            )) {
                return false;
            }

            if (
                category &&
                (
                    Array.isArray(category)
                        ? !category.includes(place.category)
                        : place.category !== category
                )
            ) {
                return false;
            }

            return true;
        })
        .map(place => {
            const distance = calculateDistance(
                latitude,
                longitude,
                place.location.latitude,
                place.location.longitude
            );

            return {
                ...place,
                distanceKm: Number(distance.toFixed(2))
            };
        })
        .filter(place => place.distanceKm <= radiusKm)
        .sort((a, b) => a.distanceKm - b.distanceKm)
        .map(addCampusStatus);

    return results.slice(0, limit);
}

function searchPlaces({
    query = "",
    category = null,
    limit = 10
}) {
    const places = loadPlaces();

    const normalizedQuery = query.trim().toLowerCase();

    const results = places.filter(place => {
        const name = place.name.toLowerCase();
        const placeCategory = place.category.toLowerCase();
        const cuisine = (place.cuisine || "").toLowerCase();

        const matchesQuery =
            !normalizedQuery ||
            name.includes(normalizedQuery) ||
            placeCategory.includes(normalizedQuery) ||
            cuisine.includes(normalizedQuery);

        const matchesCategory =
            !category || place.category === category;

        return matchesQuery && matchesCategory;
    });

    return results
        .slice(0, limit)
        .map(addCampusStatus);
}

module.exports = {
    loadPlaces,
    findNearbyPlaces,
    searchPlaces
};