const {
    isInsideUnilag,
    getCampusStatus
} = require("./geofenceService");

const testLocations = [
    {
        name: "UNILAG Main Library area",
        latitude: 6.516,
        longitude: 3.397
    },
    {
        name: "Outside campus test",
        latitude: 6.510,
        longitude: 3.420
    }
];

for (const location of testLocations) {
    console.log("\n" + location.name);

    console.log(
        "Campus status:",
        getCampusStatus(
            location.latitude,
            location.longitude
        )
    );
}