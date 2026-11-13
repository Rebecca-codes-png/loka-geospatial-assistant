// ========================================
// LOKA - LOCATION INTELLIGENCE ASSISTANT
// ========================================

require("dotenv").config();

const { Bot, InputFile } = require("grammy");
const { hydrateFiles } = require("@grammyjs/files");

const fs = require("node:fs/promises");

const {
    processMessage,
    formatRecommendations
} = require("./conversations/messageProcessor");

const {
    getRoute,
    formatRouteForTelegram
} = require("./services/routeService");

const {
    createNavigationMonitor
} = require("./services/navigationMonitor");

const {
    understandMessage,
    translateResponse
} = require("./services/languageService");

const {
    transcribeVoiceNote
} = require("./services/voiceService");

const {
    generateSpeech
} = require("./services/speechService");

const {
    convertToOgg
} = require("./services/audioService");

// ========================================
// SESSION STORAGE
// ========================================

const conversationContexts = new Map();
const userLocations = new Map();
const activeNavigations = new Map();
const voicePreferences = new Map();

const CONTEXT_EXPIRY = 30 * 60 * 1000;

// ========================================
// BOT INITIALISATION
// ========================================

const token = process.env.BOT_TOKEN;

if (!token) {
    throw new Error("LOKA BOT TOKEN IS MISSING!");
}

const bot = new Bot(token);

bot.api.config.use(hydrateFiles(bot.token));

// ========================================
// HELPER: VALIDATE LOCATION
// ========================================

function isValidLocation(location) {
    return (
        location &&
        Number.isFinite(location.latitude) &&
        Number.isFinite(location.longitude) &&
        location.latitude >= -90 &&
        location.latitude <= 90 &&
        location.longitude >= -180 &&
        location.longitude <= 180
    );
}

// ========================================
// HELPER: REPLY IN USER LANGUAGE
// ========================================

async function replyInUserLanguage(ctx, text, languageResult) {
    let finalText = text;

    if (languageResult && languageResult.languageCode !== "en") {
        try {
            finalText = await translateResponse(
                text,
                languageResult.language,
                languageResult.languageCode
            );
        } catch (error) {
            console.error(
                "LOKA response translation failed:",
                error.message
            );
        }
    }

    await ctx.reply(finalText);

    if (!voicePreferences.get(ctx.chat.id)) {
        return;
    }

    try {
        await ctx.replyWithChatAction("upload_voice");

        const speechResult = await generateSpeech(finalText);

        const oggAudio = await convertToOgg(speechResult.audio);

        await ctx.replyWithVoice(
            new InputFile(oggAudio, "loka-response.ogg")
        );

    } catch (error) {
        console.error(
            "LOKA spoken response failed:",
            error.message
        );
    }
}

// ========================================
// HELPER: PROCESS LIVE LOCATION
// ========================================

async function processLiveLocation(ctx, chatId, location) {
    const navigation = activeNavigations.get(chatId);

    if (!navigation || !navigation.isLive) {
        return;
    }

    if (navigation.rerouting) {
        return;
    }

    const accuracyMeters =
        Number.isFinite(location.horizontal_accuracy)
            ? location.horizontal_accuracy
            : 25;

    const result = navigation.monitor.evaluate({
        location: {
            latitude: location.latitude,
            longitude: location.longitude
        },
        geometry: navigation.route.geometry,
        destination: navigation.destination.location,
        accuracyMeters
    });

    console.log("LOKA NAVIGATION STATUS:", result.status);

    if (result.status === "arrived") {
        await replyInUserLanguage(
            ctx,
            "YOU HAVE ARRIVED!\n\n" +
            "You have successfully reached your destination: " +
            navigation.destination.name + ".\n\n" +
            "Thank you for navigating with LOKA."
        );

        activeNavigations.delete(chatId);

        console.log(
            "LOKA ARRIVAL CONFIRMED:",
            navigation.destination.name
        );

        return;
    }

    if (result.status !== "off_route") {
        return;
    }

    navigation.rerouting = true;

    try {
        await replyInUserLanguage(
            ctx,
            "You appear to have moved away from your planned route.\n\n" +
            "LOKA is calculating a new route from your current position."
        );

        const newRoute = await getRoute({
            origin: {
                latitude: location.latitude,
                longitude: location.longitude
            },
            destination: navigation.destination.location,
            mode: navigation.route.mode
        });

        navigation.route = newRoute;
        navigation.monitor = createNavigationMonitor();
        navigation.rerouting = false;

        await replyInUserLanguage(
            ctx,
            "NEW ROUTE CALCULATED\n\n" +
            formatRouteForTelegram(
                newRoute,
                navigation.destination.name
            )
        );

    } catch (error) {
        navigation.rerouting = false;

        console.error("LOKA rerouting error:", error.message);

        await replyInUserLanguage(
            ctx,
            "I couldn't calculate a new route right now. " +
            "Please try again shortly."
        );
    }
}

// ========================================
// TEST: SIMULATED LIVE NAVIGATION
// ========================================

bot.command("testnavigation", async (ctx) => {
    const chatId = ctx.chat.id;

    if (!voicePreferences.get(chatId)) {
        await ctx.reply(
            "Please enable spoken responses first using /voiceon."
        );
        return;
    }

    try {
         const { searchPlaces } = require("./services/placeService");
         
        await ctx.reply(
            "LOKA SIMULATED NAVIGATION TEST\n\n" +
            "Preparing a test journey from King Jaja Hall " +
            "to the Faculty of Law."
        );

        const origin = searchPlaces({
            query: "King Jaja Hall",
            limit: 1
        })[0];

        const destination = searchPlaces({
            query: "Faculty of Law",
            limit: 1
        })[0];

        if (!origin || !destination) {
            throw new Error("Test locations could not be found.");
        }

        const route = await getRoute({
            origin: origin.location,
            destination: destination.location,
            mode: "pedestrian"
        });

        const navigation = {
            isLive: true,
            rerouting: false,
            monitor: createNavigationMonitor(),
            route,
            destination
        };

        activeNavigations.set(chatId, navigation);

        await ctx.reply(
            "TEST 1: SIMULATING A WRONG TURN\n\n" +
            "LOKA will now receive three simulated GPS updates."
        );

        const simulatedWrongLocation = {
            latitude: origin.location.latitude + 0.002,
            longitude: origin.location.longitude + 0.002,
            horizontal_accuracy: 5
        };

        for (let i = 1; i <= 3; i++) {
            console.log(`SIMULATED GPS UPDATE ${i}`);

            await processLiveLocation(
                ctx,
                chatId,
                simulatedWrongLocation
            );
        }

        await ctx.reply(
            "TEST 2: SIMULATING ARRIVAL\n\n" +
            "LOKA will now simulate reaching the Faculty of Law."
        );

        navigation.monitor = createNavigationMonitor();

        const simulatedArrival = {
            latitude: destination.location.latitude,
            longitude: destination.location.longitude,
            horizontal_accuracy: 5
        };

        await processLiveLocation(
            ctx,
            chatId,
            simulatedArrival
        );

        await processLiveLocation(
            ctx,
            chatId,
            simulatedArrival
        );

        activeNavigations.delete(chatId);

        await ctx.reply(
            "SIMULATED NAVIGATION TEST COMPLETED.\n\n" +
            "Check the spoken notifications you received."
        );

    } catch (error) {
        activeNavigations.delete(chatId);

        console.error(
            "SIMULATED NAVIGATION TEST FAILED:",
            error.message
        );

        await ctx.reply(
            "The navigation simulation encountered an error: " +
            error.message
        );
    }
});

// ========================================
// WELCOME COMMAND
// ========================================

bot.command("start", async (ctx) => {
    await ctx.reply(
        "Hey there! Welcome to LOKA!\n\n" +
        "I'm your location intelligence assistant.\n\n" +
        "I can help you discover places, find useful services " +
        "and navigate to destinations around you.\n\n" +
        "I'm starting around UNILAG, Akoka.\n\n" +
        "What would you like to explore today?\n\n" +
        "Use /voiceon to enable spoken responses.\n" +
        "Use /voiceoff to return to text-only mode."
    );
});

// ========================================
// FIND COMMAND
// ========================================

bot.command("find", async (ctx) => {
    await ctx.reply(
        "Wonderful! What are you looking for?\n\n" +
        "You can ask me for restaurants, shawarma spots, " +
        "pharmacies, supermarkets and more."
    );
});

// ========================================
// ENABLE SPOKEN RESPONSES
// ========================================

bot.command("voiceon", async (ctx) => {
    voicePreferences.set(ctx.chat.id, true);

    await ctx.reply(
        "LOKA spoken responses are now enabled.\n\n" +
        "I'll send my normal text responses alongside " +
        "spoken replies in my Nigerian English voice.\n\n" +
        "Use /voiceoff whenever you want to return to text-only mode."
    );
});

// ========================================
// DISABLE SPOKEN RESPONSES
// ========================================

bot.command("voiceoff", async (ctx) => {
    voicePreferences.set(ctx.chat.id, false);

    await ctx.reply(
        "LOKA spoken responses have been disabled.\n\n" +
        "I'll continue responding with text only."
    );
});

// ========================================
// LOCATION COMMAND
// ========================================

bot.command("location", async (ctx) => {
    await ctx.reply(
        "To help you discover nearby places or calculate a route:\n\n" +
        "1. Tap the attachment icon in Telegram.\n" +
        "2. Select Location.\n" +
        "3. Choose Send My Current Location.\n\n" +
        "For live navigation, choose Share My Live Location."
    );
});

// ========================================
// STOP NAVIGATION
// ========================================

bot.command("stopnavigation", async (ctx) => {
    const chatId = ctx.chat.id;

    activeNavigations.delete(chatId);
    userLocations.delete(chatId);

    await ctx.reply(
        "Your LOKA navigation session has ended.\n\n" +
        "If you were sharing live location, you can also stop " +
        "sharing it from Telegram's location message."
    );
});

// ========================================
// RECEIVE LOCATION
// ========================================

bot.on("message:location", async (ctx) => {
    const chatId = ctx.chat.id;
    const location = ctx.message.location;

    if (!isValidLocation(location)) {
        await ctx.reply(
            "I couldn't process that location. Please try again."
        );

        return;
    }

    const isLive = Boolean(location.live_period);

    userLocations.set(chatId, {
        latitude: location.latitude,
        longitude: location.longitude,
        isLive,
        lastActivity: Date.now()
    });

    const navigation = activeNavigations.get(chatId);

    if (navigation && navigation.awaitingLiveLocation && isLive) {
        navigation.isLive = true;
        navigation.awaitingLiveLocation = false;
        navigation.monitor = createNavigationMonitor();

        await ctx.reply(
            "LIVE NAVIGATION ACTIVATED\n\n" +
            "LOKA is now receiving your shared live-location updates " +
            "and checking your position against your planned route.\n\n" +
            "You can end navigation anytime using /stopnavigation."
        );

        await processLiveLocation(ctx, chatId, location);

        return;
    }

    if (isLive) {
        await ctx.reply(
            "Your live location has been received.\n\n" +
            "You can now request directions, and LOKA can monitor " +
            "your route while your live-location sharing remains active."
        );

        return;
    }

    await ctx.reply(
        "Your current location has been received successfully.\n\n" +
        "You can now request directions or discover nearby places.\n\n" +
        "For live route monitoring, share your live location instead."
    );
});

// ========================================
// RECEIVE LIVE LOCATION UPDATES
// ========================================

bot.on("edited_message:location", async (ctx) => {
    const chatId = ctx.editedMessage.chat.id;
    const location = ctx.editedMessage.location;

    console.log("LIVE LOCATION UPDATE RECEIVED");

    if (!isValidLocation(location)) {
        console.log("Location is invalid.");
        return;
    }

    const savedLocation = userLocations.get(chatId);

    if (!savedLocation) {
        console.log("No saved location found for this user.");
        return;
    }

    savedLocation.latitude = location.latitude;
    savedLocation.longitude = location.longitude;
    savedLocation.lastActivity = Date.now();

    console.log("Location successfully updated.");

    await processLiveLocation(ctx, chatId, location);
});

// ========================================
// RECEIVE VOICE NOTES
// ========================================

bot.on("message:voice", async (ctx) => {
    let downloadedFilePath = null;

    try {
        await ctx.replyWithChatAction("typing");

        await ctx.reply(
            "I received your voice note. Let me understand your request."
        );

        const file = await ctx.getFile();

        downloadedFilePath = await file.download();

        const transcription = await transcribeVoiceNote(
            downloadedFilePath,
            "audio/ogg"
        );

        console.log("LOKA VOICE TRANSCRIPTION COMPLETED.");

        if (!transcription) {
            await ctx.reply(
                "I couldn't understand that voice note. Please try again."
            );

            return;
        }

        console.log("LOKA TRANSCRIBED REQUEST:", transcription);

        await handleTextMessage(ctx, transcription);

    } catch (error) {
        console.error("LOKA voice processing error:", error.message);

        await ctx.reply(
            "I couldn't process your voice note right now. Please try again."
        );

    } finally {
        if (downloadedFilePath) {
            try {
                await fs.unlink(downloadedFilePath);
            } catch (cleanupError) {
                console.error(
                    "Voice file cleanup failed:",
                    cleanupError.message
                );
            }
        }
    }
});

// ========================================
// GENERAL MESSAGE PROCESSING
// ========================================

async function handleTextMessage(ctx, originalMessage) {
    const chatId = ctx.chat.id;

    let message = originalMessage;
    let languageResult = null;

    // Understand the user's message using Gemini
    try {
        await ctx.replyWithChatAction("typing");

        languageResult = await understandMessage(originalMessage);

        console.log(
            "LOKA DETECTED LANGUAGE:",
            languageResult.language
        );

        console.log(
            "LOKA UNDERSTOOD REQUEST:",
            languageResult.normalizedEnglish
        );

        if (languageResult.needsClarification) {
            await replyInUserLanguage(
                ctx,
                languageResult.clarificationQuestion ||
                "Could you please explain what you would like to find?",
                languageResult
            );

            return;
        }

        message = languageResult.normalizedEnglish;

    } catch (error) {
        console.error(
            "LOKA language processing error:",
            error.message
        );

        await replyInUserLanguage(
            ctx,
            "I'm having trouble understanding that message right now. " +
            "Please try again or send your request in English.",
            languageResult
        );

        return;
    }

    // ========================================
    // RETRIEVE CONVERSATION CONTEXT
    // ========================================

    const savedContext = conversationContexts.get(chatId);

    let conversationContext = null;

    if (savedContext) {
        const expired =
            Date.now() - savedContext.lastActivity > CONTEXT_EXPIRY;

        if (expired) {
            conversationContexts.delete(chatId);
        } else {
            conversationContext = savedContext.context;
        }
    }

    // ========================================
    // RETRIEVE SAVED USER LOCATION
    // ========================================

    let userLocation = null;

    const savedLocation = userLocations.get(chatId);

    if (savedLocation) {
        const expired =
            Date.now() - savedLocation.lastActivity > CONTEXT_EXPIRY;

        if (expired) {
            userLocations.delete(chatId);
        } else {
            userLocation = {
                latitude: savedLocation.latitude,
                longitude: savedLocation.longitude
            };

            savedLocation.lastActivity = Date.now();
        }
    }

    // ========================================
    // PROCESS MESSAGE
    // ========================================

    const result = processMessage(
        message,
        userLocation,
        conversationContext
    );

    // ========================================
    // UPDATE CONVERSATION CONTEXT
    // ========================================

    if (result.contextUpdate) {
        conversationContexts.set(chatId, {
            context: result.contextUpdate,
            lastActivity: Date.now()
        });
    }

    // ========================================
    // GREETING
    // ========================================

    if (result.status === "greeting") {
        await replyInUserLanguage(
            ctx,
            result.message,
            languageResult
        );

        return;
    }

    // ========================================
// LOCATION FOUND
// ========================================

if (result.status === "location_found") {
    const place = result.place;

    const category = place.category
        .replace(/_/g, " ")
        .replace(/\b\w/g, letter => letter.toUpperCase());

    const campusStatus = place.campusStatus ||
        "CAMPUS STATUS UNAVAILABLE";

    await replyInUserLanguage(
        ctx,
        `${result.message}\n\n` +
        `Category: ${category}\n` +
        `Campus Status: ${campusStatus}\n` +
        `Latitude: ${place.location.latitude}\n` +
        `Longitude: ${place.location.longitude}`,
        languageResult
    );

    return;
}
    // ========================================
    // DESTINATION REQUIRED
    // ========================================

    if (result.status === "destination_required") {
        await replyInUserLanguage(
            ctx,
            result.message,
            languageResult
        );

        return;
    }

    // ========================================
    // USER LOCATION REQUIRED
    // ========================================

    if (result.status === "location_required") {
        await replyInUserLanguage(
            ctx,
            result.message,
            languageResult
        );

        return;
    }

    // ========================================
    // ROUTE CALCULATION
    // ========================================

    if (result.status === "directions_requested") {
        await replyInUserLanguage(
            ctx,
            `Calculating your route to ${result.destination.name}...`,
            languageResult
        );

        try {
            const route = await getRoute({
                origin: result.origin,
                destination: result.destination.location,
                mode: "pedestrian"
            });

            const savedLocation = userLocations.get(chatId);
            const isLive = Boolean(savedLocation?.isLive);

            activeNavigations.set(chatId, {
                route,
                destination: result.destination,
                monitor: createNavigationMonitor(),
                isLive,
                awaitingLiveLocation: !isLive,
                rerouting: false
            });

            await replyInUserLanguage(
                ctx,
                formatRouteForTelegram(
                    route,
                    result.destination.name
                ),
                languageResult
            );

            if (isLive) {
                await replyInUserLanguage(
                    ctx,
                    "Live navigation is active. LOKA will monitor your " +
                    "shared location for significant route deviations.\n\n" +
                    "Use /stopnavigation to end your navigation session.",
                    languageResult
                );
            } else {
                await replyInUserLanguage(
                    ctx,
                    "Would you also like LOKA to monitor your journey?\n\n" +
                    "Share your LIVE location using Telegram's attachment " +
                    "menu and select Share My Live Location.\n\n" +
                    "You can use /stopnavigation to end your navigation session.",
                    languageResult
                );
            }

        } catch (error) {
            console.error("LOKA routing error:", error.message);

            await replyInUserLanguage(
                ctx,
                "I couldn't calculate your route right now. " +
                "Please try again shortly.",
                languageResult
            );
        }

        return;
    }

    // ========================================
    // SEARCH RESULTS FOUND
    // ========================================

    if (result.status === "results_found") {
        const response =
            `I found ${result.places.length} places near you.\n\n` +
            `Searching from: ${result.searchingFrom}\n\n` +
            formatRecommendations(result.places) +
            "\n\nResults are arranged by distance.";

        await replyInUserLanguage(
            ctx,
            response,
            languageResult
        );

        return;
    }

    // ========================================
    // NO SEARCH RESULTS
    // ========================================

    if (result.status === "no_results") {
        await replyInUserLanguage(
            ctx,
            result.message,
            languageResult
        );

        return;
    }

    // ========================================
    // GENERAL FALLBACK
    // ========================================

    await replyInUserLanguage(
        ctx,
        result.message,
        languageResult
    );
}

// ========================================
// GENERAL TEXT MESSAGES
// ========================================

bot.on("message:text", async (ctx) => {
    await handleTextMessage(ctx, ctx.message.text);
});

// ========================================
// ERROR HANDLING
// ========================================

bot.catch((error) => {
    console.error(
        "LOKA encountered an error:",
        error.message
    );
});

// ========================================
// START LOKA
// ========================================

bot.start();

console.log("LOKA is online!");