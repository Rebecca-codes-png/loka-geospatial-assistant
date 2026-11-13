const { loadPlaces } = require("./placeService");

function normalizeName(name) {
    return name
        .toLowerCase()
        .replace(/[^a-z0-9\s]/g, "")
        .replace(/\s+/g, " ")
        .trim();
}

function resolveLocation(query) {
    if (typeof query !== "string" || !query.trim()) {
        return null;
    }

    const places = loadPlaces();
    const normalizedQuery = normalizeName(query);

    const matches = places
        .map(place => ({
            ...place,
            normalizedName: normalizeName(place.name)
        }))
        .filter(place => {
            return (
                place.normalizedName === normalizedQuery ||
                place.normalizedName.startsWith(normalizedQuery) ||
                place.normalizedName.includes(normalizedQuery)
            );
        });

    if (matches.length === 0) {
        return null;
    }

    matches.sort((a, b) => {
        const aExact = a.normalizedName === normalizedQuery ? 1 : 0;
        const bExact = b.normalizedName === normalizedQuery ? 1 : 0;

        return bExact - aExact;
    });

    const bestMatch = matches[0];

    return {
        name: bestMatch.name,
        category: bestMatch.category,
        latitude: bestMatch.location.latitude,
        longitude: bestMatch.location.longitude,
        geometryType: bestMatch.geometryType
    };
}

module.exports = {
    resolveLocation,
    normalizeName
};