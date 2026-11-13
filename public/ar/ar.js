const tg = window.Telegram?.WebApp;

const elements = {
    camera: document.getElementById("camera"),
    destinationName: document.getElementById("destinationName"),
    directionArrow: document.getElementById("directionArrow"),
    directionLabel: document.getElementById("directionLabel"),
    cameraStatus: document.getElementById("cameraStatus"),
    nextInstruction: document.getElementById("nextInstruction"),
    nextTurnDistance: document.getElementById("nextTurnDistance"),
    remainingDistance: document.getElementById("remainingDistance"),
    remainingTime: document.getElementById("remainingTime"),
    compassHeading: document.getElementById("compassHeading"),
    progressPercentage: document.getElementById("progressPercentage"),
    progressBar: document.getElementById("progressBar"),
    startButton: document.getElementById("startButton"),
    voiceButton: document.getElementById("voiceButton"),
    exitButton: document.getElementById("exitButton"),
    statusMessage: document.getElementById("statusMessage")
};

const state = {
    route: null,
    destination: null,
    userLocation: null,
    heading: null,
    watchId: null,
    cameraStream: null,
    navigationStarted: false,
    voiceEnabled: false,
    lastSpokenInstruction: "",
    lastInstructionIndex: -1,
    routeDistances: [],
    totalRouteDistance: 0,
    progress: 0,
    lastProgressUpdate: 0
};

// --------------------------------------------------
// TELEGRAM INITIALISATION
// --------------------------------------------------

if (tg) {
    tg.ready();
    tg.expand();
}

// --------------------------------------------------
// DISTANCE AND BEARING CALCULATIONS
// --------------------------------------------------

function toRadians(degrees) {
    return degrees * Math.PI / 180;
}

function toDegrees(radians) {
    return radians * 180 / Math.PI;
}

function calculateDistance(pointA, pointB) {
    const earthRadius = 6371;

    const lat1 = toRadians(pointA[0]);
    const lat2 = toRadians(pointB[0]);

    const deltaLat = toRadians(pointB[0] - pointA[0]);
    const deltaLon = toRadians(pointB[1] - pointA[1]);

    const a =
        Math.sin(deltaLat / 2) ** 2 +
        Math.cos(lat1) *
        Math.cos(lat2) *
        Math.sin(deltaLon / 2) ** 2;

    return earthRadius * 2 * Math.atan2(
        Math.sqrt(a),
        Math.sqrt(1 - a)
    );
}

function calculateBearing(pointA, pointB) {
    const lat1 = toRadians(pointA[0]);
    const lat2 = toRadians(pointB[0]);

    const deltaLon = toRadians(pointB[1] - pointA[1]);

    const y = Math.sin(deltaLon) * Math.cos(lat2);

    const x =
        Math.cos(lat1) * Math.sin(lat2) -
        Math.sin(lat1) * Math.cos(lat2) * Math.cos(deltaLon);

    return (toDegrees(Math.atan2(y, x)) + 360) % 360;
}

function normalizeAngle(angle) {
    return ((angle % 360) + 360) % 360;
}

function angleDifference(target, current) {
    return ((target - current + 540) % 360) - 180;
}

function formatDistance(km) {
    if (km < 1) {
        return `${Math.round(km * 1000)} m`;
    }

    return `${km.toFixed(2)} km`;
}

// --------------------------------------------------
// ROUTE INITIALISATION
// --------------------------------------------------

function calculateRouteDistances() {
    const geometry = state.route.geometry;

    state.routeDistances = [0];

    let total = 0;

    for (let i = 1; i < geometry.length; i++) {
        total += calculateDistance(
            geometry[i - 1],
            geometry[i]
        );

        state.routeDistances.push(total);
    }

    state.totalRouteDistance = total;
}

async function loadRoute() {
    if (!tg?.initData) {
        throw new Error(
            "Please open AR Navigation from the LOKA Telegram bot."
        );
    }

    const response = await fetch("/api/ar/route", {
        headers: {
            "X-Telegram-Init-Data": tg.initData
        }
    });

    const data = await response.json();

    if (!response.ok) {
        throw new Error(
            data.error || "Unable to retrieve your navigation route."
        );
    }

    if (
        !data.route ||
        !Array.isArray(data.route.geometry) ||
        data.route.geometry.length < 2
    ) {
        throw new Error("The route geometry is invalid.");
    }

    state.route = data.route;
    state.destination = data.destination;

    calculateRouteDistances();

    elements.destinationName.textContent =
        state.destination.name;

    elements.nextInstruction.textContent =
        "Your route is ready.";

    elements.remainingDistance.textContent =
        formatDistance(state.totalRouteDistance);

    elements.remainingTime.textContent =
        `${state.route.durationMinutes} min`;

    elements.statusMessage.textContent =
        "Your route is ready. Start navigation when you are outdoors.";

    return true;
}

// --------------------------------------------------
// CAMERA ACCESS
// --------------------------------------------------

async function startCamera() {
    if (!navigator.mediaDevices?.getUserMedia) {
        throw new Error(
            "Camera access requires HTTPS and a supported browser."
        );
    }

    state.cameraStream = await navigator.mediaDevices.getUserMedia({
        video: {
            facingMode: {
                ideal: "environment"
            },
            width: {
                ideal: 1280
            },
            height: {
                ideal: 720
            }
        },
        audio: false
    });

    elements.camera.srcObject = state.cameraStream;

    await elements.camera.play();

    elements.camera.style.display = "block";

    elements.cameraStatus.textContent =
        "Camera active";
}

function stopCamera() {
    if (state.cameraStream) {
        state.cameraStream.getTracks().forEach(track => {
            track.stop();
        });

        state.cameraStream = null;
    }

    elements.camera.srcObject = null;
    elements.camera.style.display = "none";
}

// --------------------------------------------------
// COMPASS AND DEVICE ORIENTATION
// --------------------------------------------------

let compassAvailable = false;

async function requestCompassPermission() {
    if (typeof DeviceOrientationEvent === "undefined") {
        throw new Error(
            "This device does not support compass orientation."
        );
    }

    if (
        typeof DeviceOrientationEvent.requestPermission === "function"
    ) {
        const permission =
            await DeviceOrientationEvent.requestPermission();

        if (permission !== "granted") {
            throw new Error(
                "Compass permission was not granted."
            );
        }
    }

    window.addEventListener(
        "deviceorientation",
        handleOrientation,
        true
    );

    window.addEventListener(
        "deviceorientationabsolute",
        handleOrientation,
        true
    );

    compassAvailable = true;
}

function handleOrientation(event) {
    let heading = null;

    // iOS provides a dedicated compass heading.
    if (
        Number.isFinite(event.webkitCompassHeading)
    ) {
        heading = event.webkitCompassHeading;
    }

    // Android and other devices can provide absolute orientation.
    else if (
        event.absolute === true &&
        Number.isFinite(event.alpha)
    ) {
        const screenAngle =
            window.screen.orientation?.angle || 0;

        heading = 360 - event.alpha + screenAngle;
    }

    // Ignore readings that are not compass-referenced.
    if (heading === null) {
        return;
    }

    state.heading = normalizeAngle(heading);

    elements.compassHeading.textContent =
        `${Math.round(state.heading)}°`;

    updateDirectionArrow();
}
// --------------------------------------------------
// GPS LOCATION TRACKING
// --------------------------------------------------

function startLocationTracking() {
    if (!navigator.geolocation) {
        throw new Error(
            "Your browser does not support location services."
        );
    }

    state.watchId = navigator.geolocation.watchPosition(
        handleLocationUpdate,

        error => {
            const messages = {
                1: "Location permission was denied.",
                2: "Your current location is unavailable.",
                3: "Location request timed out."
            };

            elements.statusMessage.textContent =
                messages[error.code] || "Unable to access your location.";
        },

        {
            enableHighAccuracy: true,
            maximumAge: 1000,
            timeout: 15000
        }
    );
}

function handleLocationUpdate(position) {
    state.userLocation = [
        position.coords.latitude,
        position.coords.longitude
    ];

    if (!state.navigationStarted) return;

    updateNavigation();
}

function stopLocationTracking() {
    if (state.watchId !== null) {
        navigator.geolocation.clearWatch(state.watchId);
        state.watchId = null;
    }
}

// --------------------------------------------------
// FIND NEAREST ROUTE POSITION
// --------------------------------------------------

function findNearestRoutePoint(location) {
    let nearestIndex = 0;
    let nearestDistance = Infinity;

    for (
        let i = 0;
        i < state.route.geometry.length;
        i++
    ) {
        const distance = calculateDistance(
            location,
            state.route.geometry[i]
        );

        if (distance < nearestDistance) {
            nearestDistance = distance;
            nearestIndex = i;
        }
    }

    return {
        index: nearestIndex,
        distance: nearestDistance
    };
}

// --------------------------------------------------
// ROUTE PROGRESS
// --------------------------------------------------

function updateNavigation() {
    if (!state.userLocation || !state.route) return;

    const nearest = findNearestRoutePoint(
        state.userLocation
    );

    const routeIndex = nearest.index;

    state.progress = state.routeDistances[routeIndex];

    const remaining = Math.max(
        0,
        state.totalRouteDistance - state.progress
    );

    const percentage = state.totalRouteDistance > 0
        ? Math.min(
            100,
            (state.progress / state.totalRouteDistance) * 100
        )
        : 0;

    elements.progressPercentage.textContent =
        `${Math.round(percentage)}%`;

    elements.progressBar.style.width =
        `${percentage}%`;

    elements.remainingDistance.textContent =
        formatDistance(remaining);

    const remainingMinutes =
        state.totalRouteDistance > 0
            ? Math.ceil(
                state.route.durationMinutes *
                remaining / state.totalRouteDistance
            )
            : 0;

    elements.remainingTime.textContent =
        `${remainingMinutes} min`;

    updateNextInstruction();
    updateDirectionArrow();

    const now = Date.now();

    if (now - state.lastProgressUpdate > 3000) {
        state.lastProgressUpdate = now;

        if (nearest.distance > 0.05) {
            elements.statusMessage.textContent =
                "You appear to be away from the calculated route. Checking your position...";
        } else {
            elements.statusMessage.textContent =
                "Navigation active. Follow the directional guidance.";
        }
    }

    checkArrival(remaining);
}

// --------------------------------------------------
// TURN-BY-TURN GUIDANCE
// --------------------------------------------------

function updateNextInstruction() {
    const instructions = state.route.instructions || [];

    let accumulatedDistance = 0;

    let currentIndex = instructions.length - 1;
    let distanceToTurn = 0;

    for (let i = 0; i < instructions.length; i++) {
        const stepDistance =
            instructions[i].distanceKm || 0;

        if (
            accumulatedDistance + stepDistance >=
            state.progress
        ) {
            currentIndex = i;

            distanceToTurn = Math.max(
                0,
                accumulatedDistance +
                stepDistance -
                state.progress
            );

            break;
        }

        accumulatedDistance += stepDistance;
    }

    const instruction = instructions[currentIndex];

    if (!instruction) return;

    elements.nextInstruction.textContent =
        instruction.instruction;

    elements.nextTurnDistance.textContent =
        formatDistance(distanceToTurn);

    if (
        currentIndex !== state.lastInstructionIndex
    ) {
        state.lastInstructionIndex = currentIndex;

        if (state.voiceEnabled) {
            speak(instruction.instruction);
        }
    }

    if (distanceToTurn < 0.04) {
        elements.directionLabel.textContent =
            "UPCOMING TURN";
    } else {
        elements.directionLabel.textContent =
            "FOLLOW THE ARROW";
    }
}

// --------------------------------------------------
// DIRECTIONAL AR ARROW
// --------------------------------------------------

function updateDirectionArrow() {
    if (
        !state.userLocation ||
        state.heading === null ||
        !state.route
    ) {
        return;
    }

    const nearest = findNearestRoutePoint(
        state.userLocation
    );

    const geometry = state.route.geometry;

    const nextIndex = Math.min(
        nearest.index + 1,
        geometry.length - 1
    );

    const targetBearing = calculateBearing(
        state.userLocation,
        geometry[nextIndex]
    );

    const relativeDirection = angleDifference(
        targetBearing,
        state.heading
    );

    elements.directionArrow.style.transform =
        `rotate(${relativeDirection}deg)`;

    if (Math.abs(relativeDirection) < 15) {
        elements.directionLabel.textContent =
            "CONTINUE STRAIGHT";
    } else if (relativeDirection > 0) {
        elements.directionLabel.textContent =
            "BEAR RIGHT";
    } else {
        elements.directionLabel.textContent =
            "BEAR LEFT";
    }
}

// --------------------------------------------------
// VOICE NAVIGATION
// --------------------------------------------------

function speak(message) {
    if (!("speechSynthesis" in window)) {
        return;
    }

    window.speechSynthesis.cancel();

    const utterance = new SpeechSynthesisUtterance(
        message
    );

    utterance.rate = 0.95;
    utterance.pitch = 1;

    window.speechSynthesis.speak(utterance);

    state.lastSpokenInstruction = message;
}

// --------------------------------------------------
// ARRIVAL DETECTION
// --------------------------------------------------

function checkArrival(remainingDistance) {
    const directDistance = calculateDistance(
        state.userLocation,
        [
            state.destination.location.latitude,
            state.destination.location.longitude
        ]
    );

    if (
        directDistance <= 0.025 ||
        remainingDistance <= 0.02
    ) {
        elements.directionLabel.textContent =
            "YOU HAVE ARRIVED";

        elements.nextInstruction.textContent =
            `You have arrived at ${state.destination.name}.`;

        elements.statusMessage.textContent =
            "Navigation completed.";

        if (state.voiceEnabled) {
            speak(`You have arrived at ${state.destination.name}.`);
        }

        stopNavigation();
    }
}

// --------------------------------------------------
// START AND STOP NAVIGATION
// --------------------------------------------------

async function startNavigation() {
    if (state.navigationStarted) return;

    elements.startButton.disabled = true;

    try {
        elements.statusMessage.textContent =
            "Preparing your AR navigation...";

        if (!state.route) {
            await loadRoute();
        }

        await startCamera();

        try {
            await requestCompassPermission();
        } catch (error) {
            elements.statusMessage.textContent =
                "Compass access is unavailable. GPS navigation can still continue.";
        }

        startLocationTracking();

        state.navigationStarted = true;

        elements.startButton.textContent =
            "Navigation Active";

        elements.statusMessage.textContent =
            "Waiting for your GPS position...";

        if (state.voiceEnabled) {
            speak("AR navigation started.");
        }

    } catch (error) {
        elements.statusMessage.textContent =
            error.message;

        stopCamera();

    } finally {
        elements.startButton.disabled = false;
    }
}

function stopNavigation() {
    state.navigationStarted = false;

    stopLocationTracking();
    stopCamera();

    window.removeEventListener(
    "deviceorientation",
    handleOrientation,
    true
);

window.removeEventListener(
    "deviceorientationabsolute",
    handleOrientation,
    true
);

compassAvailable = false;

    if ("speechSynthesis" in window) {
        window.speechSynthesis.cancel();
    }

    elements.startButton.textContent =
        "Start AR Navigation";

    elements.startButton.disabled = false;
}

// --------------------------------------------------
// EVENT LISTENERS
// --------------------------------------------------

elements.startButton.addEventListener(
    "click",
    startNavigation
);

elements.voiceButton.addEventListener(
    "click",
    () => {
        state.voiceEnabled = !state.voiceEnabled;

        elements.voiceButton.textContent =
            state.voiceEnabled
                ? "Disable Voice"
                : "Enable Voice";

        if (!state.voiceEnabled) {
            window.speechSynthesis?.cancel();
        } else if (state.navigationStarted) {
            speak("Voice navigation enabled.");
        }
    }
);

elements.exitButton.addEventListener(
    "click",
    () => {
        stopNavigation();

        if (tg) {
            tg.close();
        } else {
            window.location.href = "/";
        }
    }
);

// --------------------------------------------------
// INITIALISE APPLICATION
// --------------------------------------------------

async function initialise() {
    try {
        elements.statusMessage.textContent =
            "Connecting to LOKA navigation...";

        await loadRoute();

    } catch (error) {
        elements.statusMessage.textContent =
            error.message;

        elements.startButton.disabled = true;
    }
}

initialise();

window.addEventListener("pagehide", stopNavigation);