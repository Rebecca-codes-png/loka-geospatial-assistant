const {
    findNearbyPlaces,
    searchPlaces
} = require("./placeService");

console.log("LOKA LOCAL SEARCH ENGINE TEST");
console.log("==============================\n");

// Moremi Hall coordinates from our dataset
const testLocation = {
    latitude: 6.5175094,
    longitude: 3.3967698
};

// TEST 1: Find all nearby places
console.log("TEST 1: PLACES NEAR MOREMI HALL");
console.log("--------------------------------");

const nearbyPlaces = findNearbyPlaces({
    latitude: testLocation.latitude,
    longitude: testLocation.longitude,
    radiusKm: 2,
    limit: 15
});

if (nearbyPlaces.length === 0) {
    console.log("No nearby places found.");
} else {
    console.table(
        nearbyPlaces.map(place => ({
            name: place.name,
            category: place.category,
            distanceKm: place.distanceKm
        }))
    );
}

// TEST 2: Find nearby hostels
console.log("\nTEST 2: SEARCH FOR HOSTELS");
console.log("--------------------------");

const nearbyHostels = findNearbyPlaces({
    latitude: testLocation.latitude,
    longitude: testLocation.longitude,
    category: "hostel",
    radiusKm: 2,
    limit: 10
});

console.table(
    nearbyHostels.map(place => ({
        name: place.name,
        distanceKm: place.distanceKm
    }))
);

// TEST 3: Search for a specific place
console.log("\nTEST 3: SEARCH FOR FACULTY OF LAW");
console.log("---------------------------------");

const lawFaculty = searchPlaces({
    query: "Faculty of Law"
});

console.table(
    lawFaculty.map(place => ({
        name: place.name,
        category: place.category
    }))
);

console.log("\nALL SEARCH TESTS COMPLETED.");