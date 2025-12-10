import express from "express";
import cors from "cors";
import fetch from "node-fetch";

const YELP_API_KEY =
  process.env.YELP_API_KEY ||
  "1zlBAL67NBWyFQCM8lOBeylptoIrFoWQNBJv4Ew3zDyw7HPl55UO4vdqeV_COsdGdpGXsjCoAO4OA6VrEOzD_9lMYopznf1EiWSQGZ-0_iiMgTAmL8QiubK7pjI2aXYx";

const COHERE_API_KEY =
  process.env.COHERE_API_KEY ||
  "JhrZm8BvURROV94UJ9xHnLEozXMckcQcdJqaV6vJ";

const app = express();
app.use(cors());
app.use(express.json());


async function extractSearchTags(userPrompt) {
  const prompt = `
The user gave this mood or plan request:
"${userPrompt}"

Your task:
Return ONLY a JSON array of 5 concise search tags that Yelp can use to find places that one would be interested in based on the user's mood or plan request.
Example: ["romantic restaurant", "scenic park", "cozy cafe", "art museum", "wine bar"]

Return EXACT output format:
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

  console.log("\n===== COHERE TAG RAW OUTPUT =====");
  console.log(text);
  console.log("=================================\n");

  try {
    const match = text.match(/\[(.*?)\]/s);
    const arr = JSON.parse(match[0]);

    console.log("Extracted Tags:", arr);

    return arr.slice(0, 5);
  } catch (err) {
    console.log("Failed to parse tags. Using fallback tags.");
    return ["restaurant", "coffee", "park"];
  }
}

async function fetchYelpPlaces({ term, latitude, longitude, limit = 10 }) {
  console.log(`\nQuerying Yelp for tag: "${term}"`);

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

  console.log(
    `Yelp returned ${json.businesses?.length || 0} businesses for "${term}"`
  );

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
    const ra = b.rating - a.rating;
    if (ra !== 0) return ra;
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

async function generatePlanWithCohere({ userPrompt, businessesSummary }) {
  const prompt = `You are an itinerary planner. Create a detailed itinerary based on the user's mood/request and the available nearby businesses.

User mood/request:
"${userPrompt}"

Available nearby businesses:
${JSON.stringify(businessesSummary, null, 2)}

Return ONLY valid JSON in this exact format:
{
  "title": "Name of the itinerary",
  "description": "Brief description",
  "itinerary": [
    {
      "order": 1,
      "place_name": "Name of the place",
      "activity": "What to do there",
      "duration_minutes": 60,
      "address": "Street address",
      "location": "City, State",
      "details": "Any additional details"
    }
  ]
}

Make sure each activity in the itinerary matches one of the provided businesses. Use their exact names and addresses.`;

  const response = await fetch("https://api.cohere.com/v1/chat", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${COHERE_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "command-a-03-2025",
      message: prompt,
      preamble: "Only return valid JSON in the requested format. Do not add any other text.",
      max_tokens: 900,
      temperature: 0.6,
    }),
  });

  const data = await response.json();
  const text = data?.text || "";

  console.log("\n===== COHERE PLAN RAW OUTPUT =====");
  console.log(text);
  console.log("=================================\n");

  try {
    const match = text.match(/```(?:json)?\s*([\s\S]*?)```/);
    const jsonText = match ? match[1] : text;

    const plan = JSON.parse(jsonText.trim());

    console.log("Cohere plan parsed successfully.");
    return plan;
  } catch (err) {
    console.log("Failed to parse plan JSON from Cohere.");
    return null;
  }
}

function generateFallbackPlan({ userPrompt, businessesSummary, startCoords }) {
  console.log("Using fallback plan.");

  const picks = businessesSummary.slice(0, 3);

  return {
    title: `Simple plan for ${userPrompt}`,
    mood_prompt: userPrompt,
    total_estimated_minutes: picks.length * 60,
    itinerary: picks.map((p, i) => ({
      order: i + 1,
      place_id: p.id,
      place_name: p.name,
      activity: `Visit ${p.name}.`,
      suggested_start_time: null,
      duration_minutes: 60,
      address: p.address,
      location: p.address,
      details: `Rating: ${p.rating}`,
      latitude: p.coordinates?.latitude || null,
      longitude: p.coordinates?.longitude || null,
    })),
    start_location: {
      latitude: startCoords?.latitude || null,
      longitude: startCoords?.longitude || null,
      location: "Your Location",
    },
    alternatives: businessesSummary.slice(3, 6).map((b) => b.name),
    why_this_matches_mood: "Based on top nearby places.",
  };
}


function enrichPlanItineraryWithCoords(plan, cleanedBusinesses, startCoords) {
  if (!plan) return plan;

  if (!plan.itinerary && plan.steps) {
    plan.itinerary = plan.steps;
  }
  if (!plan.itinerary && plan.activities) {
    plan.itinerary = plan.activities;
  }

  if (!Array.isArray(plan.itinerary)) {
    plan.itinerary = [];
  }

  const normalized = (s) =>
    (s || "").toString().replace(/[^a-z0-9\s]/gi, "").toLowerCase();

  const bizIndex = cleanedBusinesses.map((b) => {
    return {
      id: b.id,
      name: normalized(b.name || ""),
      address: normalized(
        [b.location?.address1, b.location?.city, b.location?.state]
          .filter(Boolean)
          .join(" ")
      ),
      coords: b.coordinates || null,
      raw: b,
    };
  });

  const tryFind = (text) => {
    if (!text) return null;
    const t = normalized(text);
    let found =
      bizIndex.find((b) => b.name && t.includes(b.name)) ||
      bizIndex.find((b) => b.name && b.name.includes(t));
    if (found) return found;

    found =
      bizIndex.find((b) => b.address && t.includes(b.address)) ||
      bizIndex.find((b) => b.address && b.address.includes(t));
    if (found) return found;

    const tokens = t.split(/\s+/).filter(Boolean);
    if (tokens.length > 0) {
      found = bizIndex.find((b) =>
        tokens.some((tk) => b.name.includes(tk) || b.address.includes(tk))
      );
    }
    return found || null;
  };

  plan.itinerary = plan.itinerary.map((step) => {
    const searchable = [step.location, step.activity, step.details, step.place_name, step.address]
      .filter(Boolean)
      .join(" - ");
    const match = tryFind(searchable);

    if (match && match.coords && match.coords.latitude && match.coords.longitude) {
      return {
        ...step,
        latitude: match.coords.latitude,
        longitude: match.coords.longitude,
        matched_business_id: match.id,
      };
    }

    return {
      ...step,
      latitude: step.latitude || null,
      longitude: step.longitude || null,
    };
  });

  plan.start_location = {
    latitude: startCoords?.latitude || null,
    longitude: startCoords?.longitude || null,
    location: "Your Location", 
  };

  return plan;
}

app.post("/api/plan", async (req, res) => {
  try {
    const { prompt, latitude, longitude } = req.body;
    console.log("\n===============================");
    console.log("New Request:", prompt);
    console.log("===============================");

    const tags = await extractSearchTags(prompt);

    console.log("\nFinal Tags Used:", tags);

    let allBusinesses = [];
    for (const tag of tags) {
      const results = await fetchYelpPlaces({
        term: tag,
        latitude,
        longitude,
        limit: 5,
      });
      allBusinesses.push(...results);
    }

    console.log(`\nTotal merged businesses: ${allBusinesses.length}`);

    let cleaned = dedupeBusinesses(allBusinesses);
    console.log(`After dedupe: ${cleaned.length}`);

    cleaned = sortBusinesses(cleaned);
    cleaned = cleaned.slice(0, 9);

    console.log(`Final top results: ${cleaned.length}`);

    const summary = summarizeBusinessesForPrompt(cleaned);

    let plan = await generatePlanWithCohere({
      userPrompt: prompt,
      businessesSummary: summary,
    });

    if (!plan) {
      plan = generateFallbackPlan({
        userPrompt: prompt,
        businessesSummary: summary,
        startCoords: { latitude, longitude },
      });
    } else {
      try {
        plan = enrichPlanItineraryWithCoords(plan, cleaned, {
          latitude,
          longitude,
        });
      } catch (err) {
        console.log("Failed to enrich plan with coords:", err);
      }
    }

    console.log("Sending plan back:", JSON.stringify(plan, null, 2));

    return res.json({
      spots: cleaned,
      plan,
      debug: {
        extracted_tags: tags,
        total_raw_businesses: allBusinesses.length,
        deduped_businesses: cleaned.length,
      },
    });
  } catch (err) {
    console.log("SERVER ERROR:", err);
    res.status(500).json({ error: err.message });
  }
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`\nServer running at http://localhost:${PORT}`);
});
