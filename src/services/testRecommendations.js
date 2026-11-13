const {
    recommendPlaces
} = require("./recommendationService");

const moremiHall = {
    latitude: 6.5175094,
    longitude: 3.3967698
};

console.log("LOKA RECOMMENDATION ENGINE TEST");
console.log("================================\n");

const recommendations = recommendPlaces({
    latitude: moremiHall.latitude,
    longitude: moremiHall.longitude,
    category: "hostel",
    radiusKm: 2,
    limit: 5
});

if (recommendations.length === 0) {
    console.log("No recommendations found.");
} else {
    recommendations.forEach((place, index) => {
        console.log(`${index + 1}. ${place.name}`);
        console.log(`Category: ${place.category}`);
        console.log(`Distance: ${place.distanceKm} km`);
        console.log(`Reason: ${place.recommendationReason}`);
        console.log("--------------------------");
    });
}

console.log("\nRECOMMENDATION TEST COMPLETED.");