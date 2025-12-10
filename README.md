# Inspiration

Faro started because planning a simple day out felt harder than it should be. Most apps either overwhelm you with a firehose of choices or give vague, one-size-fits-all recommendations. I wanted something that could actually understand a mood or vibe—something like “I want a chill evening” or “I’m feeling artsy today”—and turn that into real places nearby, stitched together with clean routing and a clear timeline.

I called the app Faro because it means “lighthouse” in several languages, and that idea fit perfectly: a small, steady guide that helps you navigate—not by telling you where to go, but by lighting up the options in front of you. That felt like the right metaphor for an app meant to turn vague ideas into a clear path.

The project was especially fun because it blended natural-language reasoning, geospatial processing, data normalization, and frontend map rendering. It wasn’t just about building an app; it was about getting multiple systems to talk to each other smoothly.

---

# What It Does

Faro turns a natural-language request into a complete, mapped experience. It:

- Generates semantic search tags with Cohere  
- Fetches matching local spots from Yelp  
- Creates a structured itinerary using AI and real business data  
- Displays all locations on a Leaflet map  
- Calculates walking or driving routes using OSRM  
- Updates everything live on the frontend as the user interacts  

The goal is to make planning feel effortless—type a mood, and Faro handles the search, curation, and routing.

---

# How I Built It

The project is split into three main components, each with its own responsibilities.

## 1. React Frontend (Leaflet + OSRM)

- Leaflet handles rendering, markers, clustering, and viewport fitting  
- OSRM endpoints generate polyline routes between itinerary stops  
- React manages state transitions, live updates, and the itinerary UI  
- Custom hooks control map lifecycle issues like invalidating size after re-renders  
- The interface updates routes, markers, and itinerary elements without flickering  

## 2. Node.js Backend (Express)

The backend coordinates all the external APIs and cleans up their responses.

**Cohere → Search Tag Generation**  
Turns the user’s prompt into five concise search tags.

**Yelp → Location Discovery**  
Fetches businesses for each tag, merges them, and dedupes by ID.

**Ranking Logic**  
Sorts businesses by rating and distance while handling missing fields.

**Cohere → Itinerary Generator**  
Uses curated businesses to produce a structured JSON itinerary.

**Normalization & Matching**  
Matches AI-generated text back to real Yelp entries using normalization rules, similarity checks, and fallback logic.

**Fallback Planner**  
If Cohere returns malformed JSON, an automatic itinerary builder kicks in.

## 3. Data & Parsing Pipeline

A lot of engineering work went into making the system resilient:

- Text normalization to match AI output to Yelp entries  
- Regex-based JSON extraction  
- Safe parsing with fallback heuristics  
- Deduplication rules  
- Distance- and rating-based sorting  
- Coordinate enrichment for route stability  

Each step is defensive by design to keep the experience stable even when APIs misbehave.

---

# Challenges I Ran Into

**Unstable JSON from Cohere**  
Models sometimes return code blocks or malformed JSON. I had to sanitize and implement fallbacks.

**Matching AI Text to Real Businesses**  
“Joe’s Coffee House” vs. “Joes Coffeehouse.” Solved with normalization, address matching, and similarity scoring.

**Leaflet Map Reflows**  
Leaflet misbehaves when containers resize, so I had to trigger `invalidateSize()` during key lifecycle moments.

**Route Stability**  
OSRM sometimes errors on tiny distances or edge cases, so I made it do 2 attempts before completely showing to the user.

---

# Accomplishments That I am Proud Of

- Smooth, real-time map rendering using Leaflet and OSRM  
- A backend that stays stable even when APIs send odd data  
- Itineraries that feel human and context-aware  
- A clean, responsive interface  

---

# What I Learned

- How to coordinate multiple external APIs reliably  
- Techniques for cleaning and validating AI output  
- Practical geospatial engineering: routing, polylines, rendering, viewport control  
- How to blend AI, maps, and business data into one unified experience  

---

# What’s Next for Faro

There’s room to expand:

- User accounts for saving and sharing plans  
- Support for biking, transit, and scenic routes  
- Multi-day plans and themed adventures  
- Integration of real-time data (weather, crowds, events)  
- Additional data sources beyond Yelp  
- Personalized itineraries based on user history and preferences  
