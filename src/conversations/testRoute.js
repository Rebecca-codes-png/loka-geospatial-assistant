const { searchPlaces } = require("../services/placeService");

const {
    getRoute,
    formatRouteForTelegram
} = require("../services/routeService");

async function testRoute() {
    const origin = searchPlaces({
        query: "King Jaja Hall",
        limit: 1
    })[0];

    const destination = searchPlaces({
        query: "Faculty of Law",
        limit: 1
    })[0];

    if (!origin || !destination) {
        console.log("Could not find the test locations.");
        return;
    }

    console.log("Testing LOKA Route Geometry");
    console.log("----------------------------");

    const route = await getRoute({
        origin: origin.location,
        destination: destination.location,
        mode: "pedestrian"
    });

    console.log("\nROUTE SUMMARY");
    console.log("Distance:", route.distanceKm, "km");
    console.log("Estimated time:", route.durationMinutes, "minutes");

    console.log("\nGEOMETRY VERIFICATION");
    console.log("Total route coordinates:", route.geometry.length);

    console.log(
        "Starting coordinate:",
        route.geometry[0]
    );

    console.log(
        "Ending coordinate:",
        route.geometry[route.geometry.length - 1]
    );

    console.log("\nDIRECTIONS");
    console.log(formatRouteForTelegram(route, destination.name));

    console.log("\nGeometry test completed.");
}

testRoute().catch(error => {
    console.error("Route geometry test failed:", error.message);
});