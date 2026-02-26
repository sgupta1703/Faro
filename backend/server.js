import express from "express";
import cors from "cors";
import fetch from "node-fetch";
import dotenv from "dotenv";

dotenv.config();

const YELP_API_KEY = process.env.YELP_API_KEY;
const COHERE_API_KEY = process.env.COHERE_API_KEY;

const app = express();

/* =========================
   PROPER MULTI-ORIGIN CORS
========================= */

const allowedOrigins = [
  "http://localhost:5173",
  "https://faro-delta.vercel.app",
];

app.use(
  cors({
    origin: function (origin, callback) {
      // Allow non-browser requests (like Postman)
      if (!origin) return callback(null, true);

      if (allowedOrigins.includes(origin)) {
        return callback(null, true);
      } else {
        console.log("Blocked by CORS:", origin);
        return callback(new Error("Not allowed by CORS"));
      }
    },
    methods: ["GET", "POST", "OPTIONS"],
    credentials: true,
  })
);

app.use(express.json());

/* =========================
   TAG EXTRACTION
========================= */

async function extractSearchTags(userPrompt) {
  const prompt = `
The user gave this mood or plan request:
"${userPrompt}"

Return ONLY a JSON array of 5 concise search tags.
Example:
["romantic restaurant", "scenic park", "cozy cafe", "art museum", "wine bar"]

Return EXACT format:
["tag1", "tag2", "tag3", "tag4", "tag5"]
`;

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

  const data = await response.json();
  const text = data?.text || "";

  try {
    const match = text.match(/\[(.*?)\]/s);
    const arr = JSON.parse(match[0]);
    return arr.slice(0, 5);
  } catch {
    return ["restaurant", "coffee", "park"];
  }
}

/* =========================
   YELP FETCH
========================= */

async function fetchYelpPlaces({ term, latitude, longitude, limit = 5 }) {
  const url = new URL("https://api.yelp.com/v3/businesses/search");
  url.searchParams.append("term", term);
  url.searchParams.append("latitude", latitude);
  url.searchParams.append("longitude", longitude);
  url.searchParams.append("limit", String(limit));
  url.searchParams.append("sort_by", "best_match");

  const response = await fetch(url.toString(), {
    headers: { Authorization: `Bearer ${YELP_API_KEY}` },
  });

  const json = await response.json();
  return json.businesses || [];
}

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
    distance_meters: b.distance || null,
    coordinates: b.coordinates || null,
  }));
}

/* =========================
   PLAN GENERATION
========================= */

async function generatePlanWithCohere({ userPrompt, businessesSummary }) {
  const prompt = `
Create a detailed itinerary based on:

User request:
"${userPrompt}"

Available businesses:
${JSON.stringify(businessesSummary, null, 2)}

Return ONLY valid JSON in this format:
{
  "title": "Name",
  "description": "Short description",
  "itinerary": [
    {
      "order": 1,
      "place_name": "Exact business name",
      "activity": "What to do",
      "duration_minutes": 60,
      "address": "Address",
      "location": "City, State",
      "details": "Extra details"
    }
  ]
}
`;

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

  const data = await response.json();
  const text = data?.text || "";

  try {
    const match = text.match(/```(?:json)?\s*([\s\S]*?)```/);
    const jsonText = match ? match[1] : text;
    return JSON.parse(jsonText.trim());
  } catch {
    return null;
  }
}

/* =========================
   ROUTE
========================= */

app.post("/api/plan", async (req, res) => {
  try {
    const { prompt, latitude, longitude } = req.body;

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

    let cleaned = dedupeBusinesses(allBusinesses);
    cleaned = sortBusinesses(cleaned).slice(0, 9);

    const summary = summarizeBusinessesForPrompt(cleaned);

    let plan = await generatePlanWithCohere({
      userPrompt: prompt,
      businessesSummary: summary,
    });

    if (!plan) {
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