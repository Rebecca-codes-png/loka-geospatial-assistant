// ========================================
// LOKA - GEOGRAPHIC DATA IMPORTER
// ========================================

const fs = require("fs");
const path = require("path");

const OVERPASS_URL =
    "https://overpass.private.coffee/api/interpreter";

const BOUNDING_BOX = {
    south: 6.48,
    west: 3.34,
    north: 6.56,
    east: 3.44
};

// ========================================
// DIVIDE COVERAGE INTO FOUR SECTIONS
// ========================================

function createSections() {
    const middleLat =
        (BOUNDING_BOX.south + BOUNDING_BOX.north) / 2;

    const middleLon =
        (BOUNDING_BOX.west + BOUNDING_BOX.east) / 2;

    return [
        {
            south: BOUNDING_BOX.south,
            west: BOUNDING_BOX.west,
            north: middleLat,
            east: middleLon
        },
        {
            south: BOUNDING_BOX.south,
            west: middleLon,
            north: middleLat,
            east: BOUNDING_BOX.east
        },
        {
            south: middleLat,
            west: BOUNDING_BOX.west,
            north: BOUNDING_BOX.north,
            east: middleLon
        },
        {
            south: middleLat,
            west: middleLon,
            north: BOUNDING_BOX.north,
            east: BOUNDING_BOX.east
        }
    ];
}

// ========================================
// BUILD QUERY FOR EACH SECTION
// ========================================

function buildQuery(box) {
    const { south, west, north, east } = box;

    return `
        [out:json][timeout:60];

        (
            nwr["amenity"](${south},${west},${north},${east});
            nwr["shop"](${south},${west},${north},${east});
            nwr["office"](${south},${west},${north},${east});
            nwr["leisure"](${south},${west},${north},${east});
            nwr["tourism"](${south},${west},${north},${east});
        );

        out center tags;
    `;
}

// ========================================
// DOWNLOAD ONE SECTION
// ========================================

async function downloadSection(box, sectionNumber) {
    console.log(`Downloading section ${sectionNumber} of 4...`);

    const response = await fetch(OVERPASS_URL, {
        method: "POST",

        headers: {
            "Content-Type":
                "application/x-www-form-urlencoded",

            "User-Agent":
                "LOKA-Geographic-Data-Importer/1.0"
        },

        body: new URLSearchParams({
            data: buildQuery(box)
        }),

        signal: AbortSignal.timeout(90000)
    });

    if (!response.ok) {
        throw new Error(
            `Section ${sectionNumber} failed with HTTP ${response.status}`
        );
    }

    const data = await response.json();

    if (data.remark) {
        throw new Error(
            `Section ${sectionNumber}: ${data.remark}`
        );
    }

    console.log(
        `Section ${sectionNumber} downloaded successfully.`
    );

    return data.elements || [];
}

// ========================================
// FORMAT PLACES
// ========================================

function formatPlaces(elements) {
    const places = [];

    for (const element of elements) {
        const tags = element.tags || {};

        const name =
            tags.name ||
            tags["name:en"];

        if (!name) {
            continue;
        }

        const latitude =
            element.lat ?? element.center?.lat;

        const longitude =
            element.lon ?? element.center?.lon;

        if (
            !Number.isFinite(latitude) ||
            !Number.isFinite(longitude)
        ) {
            continue;
        }

        places.push({
            osmId: element.id,

            osmType: element.type,

            name,

            category:
                tags.amenity ||
                tags.shop ||
                tags.office ||
                tags.leisure ||
                tags.tourism ||
                "other",

            latitude,

            longitude,

            address: {
                street: tags["addr:street"] || null,
                city: tags["addr:city"] || null
            },

            phone:
                tags.phone ||
                tags["contact:phone"] ||
                null,

            website:
                tags.website ||
                tags["contact:website"] ||
                null,

            openingHours:
                tags.opening_hours || null,

            cuisine:
                tags.cuisine || null,

            source: "OpenStreetMap",

            license: "Open Database License (ODbL)"
        });
    }

    return places;
}

// ========================================
// IMPORT ALL FOUR SECTIONS
// ========================================

async function importPlaces() {
    console.log("Starting geographic data import...");

    const sections = createSections();

    const allElements = [];

    for (let index = 0; index < sections.length; index++) {
        const elements = await downloadSection(
            sections[index],
            index + 1
        );

        allElements.push(...elements);

        // Pause briefly between requests.
        if (index < sections.length - 1) {
            await new Promise(resolve =>
                setTimeout(resolve, 2000)
            );
        }
    }

    // Remove duplicates using OpenStreetMap IDs.
    const uniqueElements = new Map();

    for (const element of allElements) {
        const key = `${element.type}/${element.id}`;

        uniqueElements.set(key, element);
    }

    const places = formatPlaces(
        Array.from(uniqueElements.values())
    );

    const output = {
        metadata: {
            source: "OpenStreetMap",

            license: "Open Database License (ODbL)",

            attribution:
                "© OpenStreetMap contributors",

            importedAt: new Date().toISOString(),

            coverage: BOUNDING_BOX,

            totalPlaces: places.length
        },

        places
    };

    const outputPath = path.join(
        __dirname,
        "../../data/places.json"
    );

    fs.writeFileSync(
        outputPath,
        JSON.stringify(output, null, 2),
        "utf8"
    );

    console.log("Geographic data import completed.");

    console.log(`Places imported: ${places.length}`);

    console.log("Dataset saved successfully.");
}

// ========================================
// RUN IMPORTER
// ========================================

importPlaces().catch(error => {
    console.error(
        "Geographic import failed:",
        error.message
    );
});