const categoryKeywords = {
    pharmacy: ["pharmacy", "pharmacies", "chemist", "chemists"],
    hospital: ["hospital", "hospitals"],
    clinic: ["clinic", "clinics"],
    hostel: ["hostel", "hostels", "student accommodation"],
    bank: ["bank", "banks"],
    atm: ["atm", "atms"],
    restaurant: ["restaurant", "restaurants", "food"],
    fast_food: ["fast food", "shawarma", "burger", "pizza"],
    cafe: ["cafe", "cafes", "coffee"],
    bakery: ["bakery", "bakeries", "bread"],
    supermarket: ["supermarket", "supermarkets", "grocery"],
    library: ["library", "libraries"],
    cinema: ["cinema", "cinemas"],
    cafeteria: ["cafeteria", "canteen", "canteens"],
    bookshop: ["bookshop", "bookstore", "bookstores"],
    place_of_worship: ["church", "churches", "mosque", "mosques"],
    bus_station: ["bus station", "bus stations"]
};

function detectCategory(message) {
    const normalizedMessage = message.toLowerCase();

    for (const [category, keywords] of Object.entries(categoryKeywords)) {
        for (const keyword of keywords) {
            const pattern = new RegExp(
                `\\b${keyword.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`,
                "i"
            );

            if (pattern.test(normalizedMessage)) {
                return category;
            }
        }
    }

    return null;
}

function detectRadius(message) {
    const normalizedMessage = message.toLowerCase();

    const match = normalizedMessage.match(
        /(?:within|under|less than|maximum|max)\s+(\d+(?:\.\d+)?)\s*(km|kilometers?|metres?|meters?|m)\b/
    );

    if (!match) {
        return 5;
    }

    const value = Number(match[1]);
    const unit = match[2];

    if (unit === "m" || unit.startsWith("met")) {
        return value / 1000;
    }

    return value;
}

function detectLocationReference(message) {
    const normalizedMessage = message.toLowerCase();

    if (
        normalizedMessage.includes("near me") ||
        normalizedMessage.includes("around me") ||
        normalizedMessage.includes("closest to me")
    ) {
        return "user";
    }

    const knownLocations = [
        "moremi hall",
        "king jaja hall",
        "faculty of law",
        "main library",
        "jaja shopping complex",
        "unilag cafeteria"
    ];

    for (const location of knownLocations) {
        if (normalizedMessage.includes(location)) {
            return location;
        }
    }

    return null;
}

function parseQuery(message) {
    if (typeof message !== "string" || !message.trim()) {
        return {
            intent: "unknown",
            category: null,
            radiusKm: 5,
            locationReference: null,
            originalQuery: message
        };
    }

    const category = detectCategory(message);
    const radiusKm = detectRadius(message);
    const locationReference = detectLocationReference(message);

    if (!category && !locationReference) {
        return {
            intent: "unknown",
            category: null,
            radiusKm,
            locationReference,
            originalQuery: message
        };
    }

    return {
        intent: "nearby_search",
        category,
        radiusKm,
        locationReference,
        originalQuery: message
    };
}

module.exports = {
    parseQuery,
    detectCategory,
    detectRadius,
    detectLocationReference
};