const { parseQuery } = require("../conversations/queryParser");
const { resolveLocation } = require("./locationService");
const { recommendPlaces } = require("./recommendationService");

function processQuery(message, userLocation = null) {
    const parsedQuery = parseQuery(message);

    if (parsedQuery.intent === "unknown") {
        return {
            success: false,
            status: "unknown_query",
            message: "I'm not sure what you're looking for. Try asking me to find a pharmacy, hostel, bank, restaurant or another place."
        };
    }

    let searchLocation = null;

    // Resolve the user's explicitly shared location.
    if (parsedQuery.locationReference === "user") {
        if (!userLocation) {
            return {
                success: false,
                status: "location_required",
                message: "Please share your current location so I can find places near you."
            };
        }

        searchLocation = userLocation;
    }

    // Resolve a named landmark from our local database.
    else if (parsedQuery.locationReference) {
        searchLocation = resolveLocation(
            parsedQuery.locationReference
        );

        if (!searchLocation) {
            return {
                success: false,
                status: "location_not_found",
                message: "I couldn't find that location in my current geographic database."
            };
        }
    }

    // Ask for a starting location if none was provided.
    else {
        return {
            success: false,
            status: "location_required",
            message: "Where should I search from? You can mention a landmark such as Moremi Hall or explicitly share your current location."
        };
    }

    // If the user asks where a particular landmark is,
    // return that landmark rather than searching around it.
    if (
        parsedQuery.category &&
        parsedQuery.locationReference !== "user" &&
        parsedQuery.originalQuery.toLowerCase().startsWith("where is")
    ) {
        return {
            success: true,
            status: "location_found",
            location: searchLocation,
            recommendations: []
        };
    }

    // Search for and rank matching places.
    const recommendations = recommendPlaces({
        latitude: searchLocation.latitude,
        longitude: searchLocation.longitude,
        category: parsedQuery.category,
        radiusKm: parsedQuery.radiusKm,
        limit: 5
    });

    return {
        success: true,
        status: "results_found",
        searchLocation: {
            name: searchLocation.name || "User's shared location",
            latitude: searchLocation.latitude,
            longitude: searchLocation.longitude
        },
        category: parsedQuery.category,
        radiusKm: parsedQuery.radiusKm,
        totalResults: recommendations.length,
        recommendations
    };
}

module.exports = {
    processQuery
};