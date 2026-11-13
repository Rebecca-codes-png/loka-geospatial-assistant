const { searchPlaces } = require("../services/placeService");
const { getRoute } = require("../services/routeService");

const {
    createNavigationMonitor
} = require("../services/navigationMonitor");

async function testNavigationMonitor() {
    const origin = searchPlaces({
        query: "King Jaja Hall",
        limit: 1
    })[0];

    const destination = searchPlaces({
        query: "Faculty of Law",
        limit: 1
    })[0];

    if (!origin || !destination) {
        console.log("Test locations could not be found.");
        return;
    }

    console.log("LOKA INTELLIGENT NAVIGATION TEST");
    console.log("--------------------------------");

    const route = await getRoute({
        origin: origin.location,
        destination: destination.location,
        mode: "pedestrian"
    });

    const monitor = createNavigationMonitor();

    const routeStart = {
        latitude: route.geometry[0][0],
        longitude: route.geometry[0][1]
    };

    console.log("\nTEST 1: NORMAL ROUTE POSITION");

    const normalResult = monitor.evaluate({
        location: routeStart,
        geometry: route.geometry,
        destination: destination.location,
        accuracyMeters: 5
    });

    console.log(normalResult);

    const simulatedWrongLocation = {
        latitude: origin.location.latitude + 0.002,
        longitude: origin.location.longitude + 0.002
    };

    console.log("\nTEST 2: FIRST POSSIBLE DEVIATION");

    console.log(monitor.evaluate({
        location: simulatedWrongLocation,
        geometry: route.geometry,
        destination: destination.location,
        accuracyMeters: 5
    }));

    console.log("\nTEST 3: SECOND POSSIBLE DEVIATION");

    console.log(monitor.evaluate({
        location: simulatedWrongLocation,
        geometry: route.geometry,
        destination: destination.location,
        accuracyMeters: 5
    }));

    console.log("\nTEST 4: THIRD CONSECUTIVE DEVIATION");

    const deviationResult = monitor.evaluate({
        location: simulatedWrongLocation,
        geometry: route.geometry,
        destination: destination.location,
        accuracyMeters: 5
    });

    console.log(deviationResult);

    if (deviationResult.status === "off_route") {
        console.log("\nTEST 5: AUTOMATIC REROUTING");

        console.log("LOKA is calculating an alternative route...");

        try {
            const alternativeRoute = await getRoute({
                origin: simulatedWrongLocation,
                destination: destination.location,
                mode: route.mode
            });

            console.log("ALTERNATIVE ROUTE SUCCESSFULLY CALCULATED");

            console.log("New distance:", alternativeRoute.distanceKm, "km");
            console.log("Estimated time:", alternativeRoute.durationMinutes, "minutes");
            console.log("Route coordinates:", alternativeRoute.geometry.length);

            if (alternativeRoute.geometry.length >= 2) {
                console.log("REROUTING TEST PASSED");

                monitor.reset();
            } else {
                console.log("REROUTING TEST FAILED: Invalid route geometry.");
            }

        } catch (error) {
            console.log("REROUTING TEST FAILED:", error.message);
        }

    } else {
        console.log("\nREROUTING TEST SKIPPED: Wrong turn was not confirmed.");
    }

    console.log("\nTEST 6: POOR GPS ACCURACY");

    const accuracyResult = monitor.evaluate({
        location: routeStart,
        geometry: route.geometry,
        destination: destination.location,
        accuracyMeters: 50
    });

    console.log(accuracyResult);

    console.log("\nTEST 7: ARRIVAL DETECTION");

    const arrivalMonitor = createNavigationMonitor();

    const arrivalResultOne = arrivalMonitor.evaluate({
        location: destination.location,
        geometry: route.geometry,
        destination: destination.location,
        accuracyMeters: 5
    });

    console.log("First arrival update:", arrivalResultOne);

    const arrivalResultTwo = arrivalMonitor.evaluate({
        location: destination.location,
        geometry: route.geometry,
        destination: destination.location,
        accuracyMeters: 5
    });

    console.log("Second arrival update:", arrivalResultTwo);

    if (
        arrivalResultOne.status === "approaching_destination" &&
        arrivalResultTwo.status === "arrived"
    ) {
        console.log("ARRIVAL DETECTION TEST PASSED");
    } else {
        console.log("ARRIVAL DETECTION TEST FAILED");
    }

    console.log("\nAll navigation tests completed.");
}

testNavigationMonitor().catch(error => {
    console.error("Navigation test failed:", error.message);
});