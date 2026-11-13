const { findNearbyPlaces } = require("./placeService");

function recommendPlaces({
    latitude,
    longitude,
    category = null,
    radiusKm = 5,
    limit = 5
}) {
    const places = findNearbyPlaces({
        latitude,
        longitude,
        category,
        radiusKm,
        limit: 100
    });

    const recommendations = places.map(place => {
        return {
            ...place,
            recommendationReason: "Nearest available location"
        };
    });

    return recommendations.slice(0, limit);
}

module.exports = {
    recommendPlaces
};