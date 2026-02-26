import express from "express";
import cors from "cors";
import fetch from "node-fetch";
import dotenv from "dotenv";

dotenv.config();

const YELP_API_KEY = process.env.YELP_API_KEY;
const COHERE_API_KEY = process.env.COHERE_API_KEY;

const app = express();

/* =========================
   CORS CONFIG
========================= */

const allowedOrigins = [
  "http://localhost:5173",
  "https://faro-delta.vercel.app",
];

app.use(
  cors({
    origin: function (origin, callback) {
      if (!origin) return callback(null, true);

      if (allowedOrigins.includes(origin)) {
        return callback(null, true);
      } else {
        console.log("CORS BLOCKED:", origin);
        return callback(new Error("Not allowed by CORS"));
      }
    },
    methods: ["GET", "POST", "OPTIONS"],
    credentials: true,
  })
);

app.use(express.json());

/* =========================
   TAG EXTRACTION (COHERE)
========================= */

async function extractSearchTags(userPrompt) {
  console.log("\n===== COHERE TAG EXTRACTION START =====");

  const prompt = `
User mood/request:
"${userPrompt}"

Return ONLY a JSON array of 5 concise search tags.
Example:
["romantic restaurant", "scenic park", "cozy cafe", "art museum", "wine bar"]
`;

  try {
    const response = await fetch("https://api.cohere.com/v1/chat", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${COHERE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "command-a-03-2025",
        message: prompt,
        preamble: "Return ONLY a JSON array.",
        max_tokens: 100,
        temperature: 0.2,
      }),
    });

    console.log("Cohere Status:", response.status);

    const data = await response.json();
    const text = data?.text || "";

    console.log("Raw Cohere Tag Output:", text);

    const match = text.match(/\[(.*?)\]/s);
    const arr = JSON.parse(match[0]);

    console.log("Parsed Tags:", arr);
    console.log("===== COHERE TAG EXTRACTION END =====\n");

    return arr.slice(0, 5);
  } catch (err) {
    console.log("COHERE TAG ERROR:", err);
    return ["restaurant", "coffee", "park"];
  }
}

/* =========================
   YELP FETCH WITH DEBUG
========================= */

async function fetchYelpPlaces({ term, latitude, longitude, limit = 5 }) {
  console.log("\n===== YELP DEBUG START =====");
  console.log("Search Term:", term);
  console.log("Latitude:", latitude);
  console.log("Longitude:", longitude);
  console.log("API Key Exists:", !!YELP_API_KEY);

  const url = new URL("https://api.yelp.com/v3/businesses/search");
  url.searchParams.append("term", term);
  url.searchParams.append("latitude", latitude);
  url.searchParams.append("longitude", longitude);
  url.searchParams.append("limit", String(limit));
  url.searchParams.append("sort_by", "best_match");

  console.log("Full Yelp URL:", url.toString());

  try {
    const response = await fetch(url.toString(), {
      headers: { Authorization: `Bearer ${YELP_API_KEY}` },
    });

    console.log("Yelp Response Status:", response.status);

    const json = await response.json();

    if (!response.ok) {
      console.log("YELP ERROR RESPONSE:");
      console.log(JSON.stringify(json, null, 2));
      console.log("===== YELP DEBUG END =====\n");
      return [];
    }

    console.log(
      `Yelp returned ${json.businesses?.length || 0} businesses`
    );

    if (json.businesses?.length > 0) {
      console.log(
        "Sample:",
        json.businesses[0].name,
        "| Rating:",
        json.businesses[0].rating
      );
    }

    console.log("===== YELP DEBUG END =====\n");

    return json.businesses || [];
  } catch (err) {
    console.log("YELP FETCH FAILED:", err);
    return [];
  }
}

/* =========================
   UTILITIES
========================= */

function dedupeBusinesses(arr) {
  const seen = new Set();
  return arr.filter((b) => {
    if (seen.has(b.id)) return false;
    seen.add(b.id);
    return true;
  });
}

function sortBusinesses(arr) {
  return arr.sort((a, b) => {
    const ratingDiff = b.rating - a.rating;
    if (ratingDiff !== 0) return ratingDiff;
    return (a.distance || 999999) - (b.distance || 999999);
  });
}

function summarizeBusinessesForPrompt(businesses) {
  return businesses.map((b) => ({
    id: b.id,
    name: b.name,
    rating: b.rating,
    review_count: b.review_count,
    price: b.price || null,
    categories: b.categories?.map((c) => c.title) || [],
    url: b.url,
    phone: b.display_phone || null,
    address:
      [b.location?.address1, b.location?.city, b.location?.state]
        .filter(Boolean)
        .join(", ") || null,
    coordinates: b.coordinates || null,
  }));
}

/* =========================
   PLAN GENERATION (COHERE)
========================= */

async function generatePlanWithCohere({ userPrompt, businessesSummary }) {
  console.log("\n===== COHERE PLAN GENERATION START =====");

  const prompt = `
Create an itinerary based on:
"${userPrompt}"

Available businesses:
${JSON.stringify(businessesSummary, null, 2)}

Return ONLY valid JSON.
`;

  try {
    const response = await fetch("https://api.cohere.com/v1/chat", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${COHERE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "command-a-03-2025",
        message: prompt,
        preamble: "Return ONLY valid JSON.",
        max_tokens: 900,
        temperature: 0.6,
      }),
    });

    console.log("Cohere Status:", response.status);

    const data = await response.json();
    const text = data?.text || "";

    console.log("Raw Cohere Plan Output:", text);

    const match = text.match(/```(?:json)?\s*([\s\S]*?)```/);
    const jsonText = match ? match[1] : text;

    const parsed = JSON.parse(jsonText.trim());

    console.log("Plan Parsed Successfully");
    console.log("===== COHERE PLAN GENERATION END =====\n");

    return parsed;
  } catch (err) {
    console.log("COHERE PLAN ERROR:", err);
    return null;
  }
}

/* =========================
   ROUTE
========================= */

app.post("/api/plan", async (req, res) => {
  try {
    const { prompt, latitude, longitude } = req.body;

    console.log("\n====================================");
    console.log("NEW /api/plan REQUEST");
    console.log("Prompt:", prompt);
    console.log("Latitude:", latitude);
    console.log("Longitude:", longitude);
    console.log("====================================\n");

    const tags = await extractSearchTags(prompt);

    let allBusinesses = [];
    for (const tag of tags) {
      const results = await fetchYelpPlaces({
        term: tag,
        latitude,
        longitude,
      });
      allBusinesses.push(...results);
    }

    console.log("Total businesses before dedupe:", allBusinesses.length);

    let cleaned = dedupeBusinesses(allBusinesses);
    cleaned = sortBusinesses(cleaned).slice(0, 9);

    console.log("Total businesses after dedupe:", cleaned.length);

    const summary = summarizeBusinessesForPrompt(cleaned);

    let plan = await generatePlanWithCohere({
      userPrompt: prompt,
      businessesSummary: summary,
    });

    if (!plan) {
      console.log("Using fallback plan.");
      plan = {
        title: `Simple plan for ${prompt}`,
        itinerary: summary.slice(0, 3).map((b, i) => ({
          order: i + 1,
          place_name: b.name,
          activity: `Visit ${b.name}`,
          duration_minutes: 60,
          address: b.address,
          location: b.address,
          details: `Rating: ${b.rating}`,
        })),
      };
    }

    return res.json({
      spots: cleaned,
      plan,
    });
  } catch (err) {
    console.error("SERVER ERROR:", err);
    res.status(500).json({ error: err.message });
  }
});

/* =========================
   START SERVER
========================= */

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});