const { searchPlaces } = require("../services/placeService");

const {
    createNavigationMonitor
} = require("../services/navigationMonitor");

function testArrivalDetection() {
    const destination = searchPlaces({
        query: "Faculty of Law",
        limit: 1
    })[0];

    if (!destination) {
        console.log("Faculty of Law could not be found.");
        return;
    }

    const monitor = createNavigationMonitor();

    const destinationLocation = destination.location;

    console.log("LOKA ARRIVAL DETECTION TEST");
    console.log("---------------------------");

    console.log("\nDestination:", destination.name);

    console.log("\nTEST 1: USER APPROACHING DESTINATION");

    const firstResult = monitor.evaluate({
        location: destinationLocation,
        destination: destinationLocation,
        geometry: [],
        accuracyMeters: 5
    });

    console.log(firstResult);

    console.log("\nTEST 2: CONFIRMING ARRIVAL");

    const secondResult = monitor.evaluate({
        location: destinationLocation,
        destination: destinationLocation,
        geometry: [],
        accuracyMeters: 5
    });

    console.log(secondResult);

    console.log("\nTEST 3: ARRIVAL STATUS PERSISTENCE");

    const thirdResult = monitor.evaluate({
        location: destinationLocation,
        destination: destinationLocation,
        geometry: [],
        accuracyMeters: 5
    });

    console.log(thirdResult);

    console.log("\nTEST RESULTS");

    if (
        firstResult.status === "approaching_destination" &&
        secondResult.status === "arrived" &&
        thirdResult.status === "arrived"
    ) {
        console.log("ARRIVAL DETECTION TEST PASSED");
    } else {
        console.log("ARRIVAL DETECTION TEST FAILED");
    }

    console.log("\nArrival detection tests completed.");
}

testArrivalDetection();