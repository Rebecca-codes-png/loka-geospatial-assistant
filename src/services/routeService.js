const ROUTING_API = "https://valhalla1.openstreetmap.de/route";

// Format distances for easy reading
function formatDistance(distanceKm) {
    if (distanceKm < 1) {
        return `${Math.round(distanceKm * 1000)} metres`;
    }

    return `${distanceKm.toFixed(2)} km`;
}

// Format journey duration
function formatDuration(minutes) {
    if (minutes < 1) {
        return "Less than a minute";
    }

    if (minutes < 60) {
        return `${minutes} minutes`;
    }

    const hours = Math.floor(minutes / 60);
    const remainingMinutes = minutes % 60;

    if (remainingMinutes === 0) {
        return `${hours} hour${hours > 1 ? "s" : ""}`;
    }

    return `${hours} hour${hours > 1 ? "s" : ""} ${remainingMinutes} minutes`;
}

// Decode Valhalla's encoded polyline6 geometry
function decodePolyline6(encoded) {
    const coordinates = [];

    let index = 0;
    let latitude = 0;
    let longitude = 0;

    while (index < encoded.length) {
        let result = 0;
        let shift = 0;
        let byte;

        do {
            byte = encoded.charCodeAt(index++) - 63;
            result |= (byte & 0x1f) << shift;
            shift += 5;
        } while (byte >= 0x20);

        const latitudeChange =
            result & 1 ? ~(result >> 1) : result >> 1;

        latitude += latitudeChange;

        result = 0;
        shift = 0;

        do {
            byte = encoded.charCodeAt(index++) - 63;
            result |= (byte & 0x1f) << shift;
            shift += 5;
        } while (byte >= 0x20);

        const longitudeChange =
            result & 1 ? ~(result >> 1) : result >> 1;

        longitude += longitudeChange;

        coordinates.push([
            latitude / 1000000,
            longitude / 1000000
        ]);
    }

    return coordinates;
}

// Calculate a route between two locations
async function getRoute({
    origin,
    destination,
    mode = "pedestrian"
}) {
    const validModes = ["pedestrian", "auto", "bicycle"];

    if (!validModes.includes(mode)) {
        throw new Error("Unsupported travel mode.");
    }

    const coordinates = [origin, destination];

    for (const point of coordinates) {
        if (
            !point ||
            !Number.isFinite(point.latitude) ||
            !Number.isFinite(point.longitude) ||
            point.latitude < -90 ||
            point.latitude > 90 ||
            point.longitude < -180 ||
            point.longitude > 180
        ) {
            throw new Error("Invalid route coordinates.");
        }
    }

    const response = await fetch(ROUTING_API, {
        method: "POST",
        headers: {
            "Content-Type": "application/json"
        },
        body: JSON.stringify({
            locations: [
                {
                    lat: origin.latitude,
                    lon: origin.longitude
                },
                {
                    lat: destination.latitude,
                    lon: destination.longitude
                }
            ],
            costing: mode,
            units: "kilometers",
            language: "en",
            directions_type: "instructions",
            alternates: 1
        })
    });

    if (!response.ok) {
        throw new Error(
            `Routing service returned HTTP ${response.status}.`
        );
    }

    const data = await response.json();

    if (!data.trip || !data.trip.legs?.length) {
        throw new Error(
            data.error || "No route could be found."
        );
    }

    // Extract turn-by-turn instructions
    const instructions = data.trip.legs.flatMap(leg =>
        leg.maneuvers.map(maneuver => ({
            instruction: maneuver.instruction,
            distanceKm: Number(
                (maneuver.length || 0).toFixed(3)
            )
        }))
    );

    // Extract the actual route geometry
    const geometry = [];

    for (const leg of data.trip.legs) {
        if (!leg.shape) {
            continue;
        }

        const legCoordinates = decodePolyline6(leg.shape);

        if (geometry.length && legCoordinates.length) {
            legCoordinates.shift();
        }

        geometry.push(...legCoordinates);
    }

    if (geometry.length < 2) {
        throw new Error(
            "The routing service did not return usable route geometry."
        );
    }

    return {
        distanceKm: Number(data.trip.summary.length.toFixed(2)),
        durationMinutes: Math.round(data.trip.summary.time / 60),
        mode,
        instructions,
        geometry,
        origin,
        destination
    };
}

// Generate a visual route link using OpenStreetMap
function generateMapLink(route) {
    const { origin, destination } = route;

    const start = `${origin.latitude},${origin.longitude}`;
    const end = `${destination.latitude},${destination.longitude}`;

    return `https://www.openstreetmap.org/directions?engine=fossgis_osrm_foot&route=${start}%3B${end}`;
}
// Convert route information into a readable Telegram message
function formatRouteForTelegram(
    route,
    destinationName = "your destination"
) {
    const travelModes = {
        pedestrian: "Walking",
        auto: "Driving",
        bicycle: "Cycling"
    };

    const modeName = travelModes[route.mode] || "Travel";
    const mapLink = generateMapLink(route);

    let message =
        `YOUR ROUTE TO ${destinationName.toUpperCase()}\n\n` +
        `Travel mode: ${modeName}\n` +
        `Distance: ${formatDistance(route.distanceKm)}\n` +
        `Estimated time: ${formatDuration(route.durationMinutes)}\n\n` +
        `VIEW YOUR ROUTE ON THE MAP:\n${mapLink}\n\n` +
        `DIRECTIONS\n\n`;

    if (!route.instructions.length) {
        message += "No step-by-step instructions are currently available.\n";
    } else {
        const steps = route.instructions.slice(0, 25);

        steps.forEach((step, index) => {
            message +=
                `${index + 1}. ${step.instruction}\n` +
                `   Distance: ${formatDistance(step.distanceKm)}\n\n`;
        });

        if (route.instructions.length > 25) {
            message +=
                "For the remaining directions, open your navigation link.\n\n";
        }
    }

    message += `Destination: ${destinationName}\n`;
    message += "\nFollow the instructions carefully and travel safely.";

    return message;
}
module.exports = {
    getRoute,
    formatRouteForTelegram,
    formatDistance,
    formatDuration,
    decodePolyline6,
    generateMapLink
};