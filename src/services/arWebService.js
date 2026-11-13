const express = require("express");
const crypto = require("node:crypto");
const path = require("node:path");

function validateTelegramInitData(initData, botToken) {
    if (!initData || !botToken) {
        return null;
    }

    try {
        const params = new URLSearchParams(initData);
        const receivedHash = params.get("hash");

        if (!receivedHash) {
            return null;
        }

        const authDate = Number(params.get("auth_date"));

        if (
            !Number.isFinite(authDate) ||
            Date.now() / 1000 - authDate > 86400 ||
            authDate > Date.now() / 1000 + 60
        ) {
            return null;
        }

        const dataCheckString = [...params.entries()]
            .filter(([key]) => key !== "hash")
            .sort(([a], [b]) => a.localeCompare(b))
            .map(([key, value]) => `${key}=${value}`)
            .join("\n");

        const secretKey = crypto
            .createHmac("sha256", "WebAppData")
            .update(botToken)
            .digest();

        const calculatedHash = crypto
            .createHmac("sha256", secretKey)
            .update(dataCheckString)
            .digest();

        const receivedHashBuffer = Buffer.from(
            receivedHash,
            "hex"
        );

        if (
            receivedHashBuffer.length !== calculatedHash.length ||
            !crypto.timingSafeEqual(
                calculatedHash,
                receivedHashBuffer
            )
        ) {
            return null;
        }

        const userData = params.get("user");

        if (!userData) {
            return null;
        }

        return JSON.parse(userData);

    } catch {
        return null;
    }
}

function createArWebService({
    botToken,
    activeNavigations
}) {
    const app = express();

    const publicDirectory = path.resolve(
        __dirname,
        "../../public"
    );

    app.disable("x-powered-by");

    app.use(express.static(publicDirectory));

    // Health check
    app.get("/health", (req, res) => {
        res.json({
            status: "online",
            service: "LOKA AR Navigation"
        });
    });

    // Serve AR interface
    app.get("/ar", (req, res) => {
        res.sendFile(
            path.join(publicDirectory, "ar", "index.html")
        );
    });

    // Authenticate Telegram Mini App requests
    function authenticateTelegram(req, res, next) {
        const initData = req.get("X-Telegram-Init-Data");

        const telegramUser = validateTelegramInitData(
            initData,
            botToken
        );

        if (!telegramUser) {
            return res.status(401).json({
                error: "Telegram authentication failed."
            });
        }

        req.telegramUser = telegramUser;

        next();
    }

    // Retrieve the authenticated user's active route
    app.get(
        "/api/ar/route",
        authenticateTelegram,
        (req, res) => {
            const userId = Number(req.telegramUser.id);

            const navigation = activeNavigations.get(userId);

            if (!navigation) {
                return res.status(404).json({
                    error: "No active navigation session was found."
                });
            }

            if (
                !navigation.route ||
                !Array.isArray(navigation.route.geometry) ||
                navigation.route.geometry.length < 2
            ) {
                return res.status(422).json({
                    error: "The active route has no usable geometry."
                });
            }

            return res.json({
                destination: {
                    name: navigation.destination.name,
                    location: navigation.destination.location
                },

                route: {
                    geometry: navigation.route.geometry,
                    instructions: navigation.route.instructions,
                    distanceKm: navigation.route.distanceKm,
                    durationMinutes:
                        navigation.route.durationMinutes,
                    mode: navigation.route.mode
                }
            });
        }
    );

    const port = Number(process.env.PORT) || 5000;

    const server = app.listen(port, "0.0.0.0", () => {
        console.log(
            `LOKA AR web service running on port ${port}`
        );
    });

    return {
        app,
        server
    };
}

module.exports = {
    createArWebService,
    validateTelegramInitData
};