const EARTH_RADIUS_METRES = 6371000;

const OFF_ROUTE_THRESHOLD = 50;
const REQUIRED_DEVIATIONS = 3;
const ARRIVAL_THRESHOLD = 30;
const REQUIRED_ARRIVAL_UPDATES = 2;

function calculateDistance(first, second) {
    const toRadians = degrees => degrees * Math.PI / 180;

    const latitudeDifference =
        toRadians(second.latitude - first.latitude);

    const longitudeDifference =
        toRadians(second.longitude - first.longitude);

    const latitude1 = toRadians(first.latitude);
    const latitude2 = toRadians(second.latitude);

    const a =
        Math.sin(latitudeDifference / 2) ** 2 +
        Math.cos(latitude1) *
        Math.cos(latitude2) *
        Math.sin(longitudeDifference / 2) ** 2;

    return EARTH_RADIUS_METRES *
        2 *
        Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function distanceToSegment(point, start, end) {
    const toRadians = degrees => degrees * Math.PI / 180;

    const referenceLatitude = toRadians(point.latitude);

    const project = coordinate => ({
        x:
            EARTH_RADIUS_METRES *
            toRadians(coordinate.longitude - point.longitude) *
            Math.cos(referenceLatitude),

        y:
            EARTH_RADIUS_METRES *
            toRadians(coordinate.latitude - point.latitude)
    });

    const a = project(start);
    const b = project(end);

    const segmentX = b.x - a.x;
    const segmentY = b.y - a.y;

    const segmentLengthSquared =
        segmentX * segmentX + segmentY * segmentY;

    if (segmentLengthSquared === 0) {
        return Math.hypot(a.x, a.y);
    }

    const projection = Math.max(
        0,
        Math.min(
            1,
            -(
                a.x * segmentX +
                a.y * segmentY
            ) / segmentLengthSquared
        )
    );

    const nearestX = a.x + projection * segmentX;
    const nearestY = a.y + projection * segmentY;

    return Math.hypot(nearestX, nearestY);
}

function calculateDistanceToRoute(location, geometry) {
    if (
        !location ||
        !Number.isFinite(location.latitude) ||
        !Number.isFinite(location.longitude) ||
        !Array.isArray(geometry) ||
        geometry.length < 2
    ) {
        throw new Error("Valid location and route geometry are required.");
    }

    let shortestDistance = Infinity;

    for (let index = 0; index < geometry.length - 1; index++) {
        const start = {
            latitude: geometry[index][0],
            longitude: geometry[index][1]
        };

        const end = {
            latitude: geometry[index + 1][0],
            longitude: geometry[index + 1][1]
        };

        const distance = distanceToSegment(
            location,
            start,
            end
        );

        shortestDistance = Math.min(
            shortestDistance,
            distance
        );
    }

    return Number(shortestDistance.toFixed(2));
}

function createNavigationMonitor() {
    let consecutiveDeviations = 0;
    let consecutiveArrivalUpdates = 0;
    let hasArrived = false;

    function evaluate({
        location,
        geometry,
        destination = null,
        accuracyMeters = 0
    }) {
        if (
            !Number.isFinite(accuracyMeters) ||
            accuracyMeters < 0
        ) {
            throw new Error("Invalid GPS accuracy.");
        }

        if (accuracyMeters > 25) {
            consecutiveDeviations = 0;
            consecutiveArrivalUpdates = 0;

            return {
                status: "insufficient_accuracy",
                message: "GPS accuracy is too low to assess your route reliably."
            };
        }

        if (hasArrived) {
            return {
                status: "arrived",
                message: "You have reached your destination."
            };
        }

        if (destination) {
            const distanceToDestination = calculateDistance(
                location,
                destination
            );

            if (distanceToDestination <= ARRIVAL_THRESHOLD) {
                consecutiveArrivalUpdates++;

                if (
                    consecutiveArrivalUpdates >=
                    REQUIRED_ARRIVAL_UPDATES
                ) {
                    hasArrived = true;
                    consecutiveDeviations = 0;

                    return {
                        status: "arrived",
                        distanceToDestination,
                        message: "You have reached your destination."
                    };
                }

                return {
                    status: "approaching_destination",
                    distanceToDestination,
                    message: "You are very close to your destination. Confirming arrival."
                };
            }

            consecutiveArrivalUpdates = 0;
        }

        const distanceFromRoute = calculateDistanceToRoute(
            location,
            geometry
        );

        if (distanceFromRoute > OFF_ROUTE_THRESHOLD + accuracyMeters) {
            consecutiveDeviations++;

            if (consecutiveDeviations >= REQUIRED_DEVIATIONS) {
                return {
                    status: "off_route",
                    distanceFromRoute,
                    consecutiveDeviations,
                    message: "You appear to have moved away from your planned route."
                };
            }

            return {
                status: "possible_deviation",
                distanceFromRoute,
                consecutiveDeviations,
                message: "You may be moving away from your planned route. Checking your next location update."
            };
        }

        consecutiveDeviations = 0;

        return {
            status: "on_route",
            distanceFromRoute,
            consecutiveDeviations,
            message: "You are following your planned route."
        };
    }

    function reset() {
        consecutiveDeviations = 0;
        consecutiveArrivalUpdates = 0;
        hasArrived = false;
    }

    return {
        evaluate,
        reset
    };
}

module.exports = {
    calculateDistance,
    calculateDistanceToRoute,
    createNavigationMonitor
};