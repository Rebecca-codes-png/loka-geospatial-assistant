const {
    findNearbyPlaces,
    searchPlaces
} = require("../services/placeService");

// Normalise messages before processing them
function normalizeMessage(message) {
    return message
        .toLowerCase()
        .replace(/[?!.,]/g, "")
        .replace(/\s+/g, " ")
        .trim();
}

// Detect the category of place the user wants
function detectCategories(message) {
    const categories = {
        hostel: [
            "hostel", "hostels", "hall of residence",
            "student accommodation", "student housing"
        ],

        pharmacy: [
            "pharmacy", "pharmacies", "chemist",
            "drugstore", "drug store"
        ],

        bank: [
            "bank", "banks", "bank branch", "banking",
            "banking facilities", "atm", "atms"
        ],

        restaurant: [
            "restaurant", "restaurants", "eatery",
            "eateries", "food spot", "food spots",
            "place to eat", "somewhere to eat"
        ],

        fast_food: [
            "fast food", "shawarma", "burger", "burgers",
            "pizza", "fried chicken"
        ],

        cafe: [
            "cafe", "cafes", "coffee shop",
            "coffee shops", "coffee"
        ],

        bakery: [
            "bakery", "bakeries", "bread shop",
            "bread", "pastry", "pastries"
        ],

        supermarket: [
            "supermarket", "supermarkets",
            "grocery store", "grocery stores"
        ],

        library: [
            "library", "libraries", "reading room"
        ],

        cinema: [
            "cinema", "cinemas",
            "movie theatre", "movie theater"
        ],

        hospital: [
            "hospital", "hospitals"
        ],

        clinic: [
            "clinic", "clinics",
            "medical centre", "medical center"
        ],

        bookshop: [
            "bookshop", "bookshops",
            "bookstore", "bookstores"
        ],

        place_of_worship: [
            "church", "churches", "mosque", "mosques"
        ],

        sports_centre: [
            "sports centre", "sports center",
            "gym", "fitness centre", "fitness center"
        ],

        park: [
            "park", "parks", "garden", "gardens"
        ],

        fuel_station: [
            "fuel station", "petrol station",
            "filling station", "gas station"
        ]
    };

    const detected = [];

    const foodCategories = [
        "restaurant",
        "fast_food",
        "cafeteria",
        "cafe",
        "bakery"
    ];

    const generalFoodKeywords = [
        "food",
        "foods",
        "chop",
        "eat",
        "eating",
        "something to eat",
        "somewhere to eat",
        "place to eat",
        "better food"
    ];

    const wantsGeneralFood = generalFoodKeywords.some(keyword => {
        const escaped = keyword.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
        return new RegExp(`\\b${escaped}\\b`).test(message);
    });

    if (wantsGeneralFood) {
        return foodCategories;
    }

    for (const [category, keywords] of Object.entries(categories)) {
        for (const keyword of keywords) {
            const escaped = keyword.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
            const pattern = new RegExp(`\\b${escaped}\\b`);

            if (pattern.test(message)) {
                detected.push(category);
                break;
            }
        }
    }

    return detected;
}

// Find a known location mentioned by the user
function findReferenceLocation(message) {
    const places = searchPlaces({ limit: 200 });

    const aliases = {
        "main library": "unilag main library",
        "unilag library": "unilag main library",
        "law faculty": "faculty of law",
        "faculty of law": "faculty of law",
        "medical centre": "unilag medical centre",
        "medical center": "unilag medical centre",
        "king jaja": "king jaja hall",
        "moremi": "moremi hall"
    };

    const sortedAliases = Object.entries(aliases)
        .sort((a, b) => b[0].length - a[0].length);

    for (const [alias, placeName] of sortedAliases) {
        const escaped = alias.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
        const pattern = new RegExp(`\\b${escaped}\\b`);

        if (pattern.test(message)) {
            const match = places.find(place =>
                place.name.toLowerCase() === placeName
            );

            if (match) return match;
        }
    }

    const sortedPlaces = [...places].sort(
        (a, b) => b.name.length - a.name.length
    );

    return sortedPlaces.find(place => {
        const name = place.name.toLowerCase();
        const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
        const pattern = new RegExp(`\\b${escaped}\\b`);

        return pattern.test(message);
    }) || null;
}

// Detect navigation requests
function isNavigationRequest(message) {
    const navigationPatterns = [
        /\b(direct me|guide me|take me|navigate me)\b/,
        /\b(directions?|route|navigation)\b/,
        /\b(how do i get to|how can i get to)\b/,
        /\b(how do i reach|how can i reach)\b/,
        /\b(show me how to get to)\b/,
        /\b(help me get to|help me reach)\b/,
        /\b(get me to)\b/,
        /\b(find me a route)\b/
    ];

    return navigationPatterns.some(pattern => pattern.test(message));
}

// Extract requested distance
function extractRadius(message) {
    const kilometreMatch = message.match(
        /(\d+(?:\.\d+)?)\s*(km|kilometres?|kilometers?)\b/
    );

    if (kilometreMatch) {
        return Math.min(Number(kilometreMatch[1]), 20);
    }

    const metreMatch = message.match(
        /(\d+(?:\.\d+)?)\s*(m|metres?|meters?)\b/
    );

    if (metreMatch) {
        return Math.min(Number(metreMatch[1]) / 1000, 20);
    }

    return 2;
}

// Determine whether the user wants a location search
function isSearchRequest(message) {
    const searchPatterns = [
        /\b(find|locate|search|show|discover|recommend|look for)\b/,
        /\b(where can i|where is|where are|where do i)\b/,
        /\b(i need|i want|i'm looking for|help me find)\b/,
        /\b(are there|is there|can you find|can you show)\b/,
        /\b(closest|nearest|near|nearby|around)\b/
    ];

    return searchPatterns.some(pattern => pattern.test(message));
}

// Format recommendations
function formatRecommendations(places) {
    if (!places.length) {
        return "I couldn't find matching places in my current database.";
    }

    return places.map((place, index) => {
        const distance = place.distanceKm < 1
            ? `${Math.round(place.distanceKm * 1000)} metres`
            : `${place.distanceKm.toFixed(2)} km`;

        const category = place.category
            .replace(/_/g, " ")
            .replace(/\b\w/g, letter => letter.toUpperCase());

        const campusStatus = place.campusStatus || "CAMPUS STATUS UNAVAILABLE";

        return (
            `${String(index + 1).padStart(2, "0")}. ${place.name.toUpperCase()}\n` +
            `Category: ${category}\n` +
            `Distance: ${distance}\n` +
            `Campus Status: ${campusStatus}`
        );
    }).join("\n\n────────────────────\n\n");
}
// Main conversation processor
function processMessage(message, userLocation = null, conversationContext = null) {
    const normalized = normalizeMessage(message);

    if (/^(hello|hi|hey|hello loka|hi loka|good morning|good afternoon|good evening)$/.test(normalized)) {
        return {
            status: "greeting",
            message: "Hello! Welcome to LOKA. What would you like to discover today?"
        };
    }

    const categories = detectCategories(normalized);
    const category = categories[0] || null;

    const detectedLocation = findReferenceLocation(normalized);

    const referenceLocation =
        detectedLocation ||
        (conversationContext ? conversationContext.referenceLocation : null);

    // Handle navigation requests
    if (isNavigationRequest(normalized)) {
        if (!detectedLocation && !referenceLocation) {
            return {
                status: "destination_required",
                message: "Where would you like me to direct you? Please tell me your destination."
            };
        }

        if (!userLocation) {
            return {
                status: "location_required",
                message: `I can help you navigate to ${referenceLocation.name}. Please share your current location so I can calculate your route.`,
                destination: referenceLocation
            };
        }

        return {
            status: "directions_requested",
            message: `I'm calculating your route to ${referenceLocation.name}.`,
            origin: userLocation,
            destination: referenceLocation
        };
    }

    const wantsSearch = isSearchRequest(normalized);

    const asksForLocation =
        /^(where is|where are|show me the location of)\b/.test(normalized);

    if (referenceLocation && asksForLocation) {
        return {
            status: "location_found",
            message: `${referenceLocation.name} is a location I have identified in the LOKA database.`,
            place: referenceLocation,
            contextUpdate: {
                referenceLocation
            }
        };
    }

    if (!wantsSearch && !category) {
        return {
            status: "unknown_query",
            message: "I can help you discover places around UNILAG and nearby areas. Tell me what you're looking for."
        };
    }

    if (!category) {
        return {
            status: "unknown_query",
            message: "What type of place are you looking for? You can ask for banks, hostels, pharmacies, restaurants and more."
        };
    }

    const radiusKm = extractRadius(normalized);

    let latitude;
    let longitude;
    let searchingFrom;

    if (referenceLocation) {
        latitude = referenceLocation.location.latitude;
        longitude = referenceLocation.location.longitude;
        searchingFrom = referenceLocation.name;
    } else if (userLocation) {
        latitude = userLocation.latitude;
        longitude = userLocation.longitude;
        searchingFrom = "Your shared location";
    } else {
        return {
            status: "location_required",
            message: "Please share your current location so I can find places near you."
        };
    }

    const places = findNearbyPlaces({
        latitude,
        longitude,
        category: categories.length > 1 ? categories : category,
        radiusKm,
        limit: 10
    });

    return {
        status: places.length ? "results_found" : "no_results",
        message: places.length
            ? "Here are the places I found:"
            : "I couldn't find matching places within that distance.",
        searchingFrom,
        places,
        contextUpdate: {
            referenceLocation: referenceLocation || null
        }
    };
}

module.exports = {
    processMessage,
    formatRecommendations,
    isNavigationRequest
};