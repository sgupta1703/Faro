import React, { useEffect, useState, useRef } from "react";
import "./App.css";
import LogoLoop from "./LogoLoop";
import { FaGithub } from "react-icons/fa";
import { SiSupabase, SiReact, SiStripe, SiVite } from "react-icons/si";
import BusinessCards from "./Components/BusinessCards.jsx";

import L from "leaflet";
import "leaflet/dist/leaflet.css";

delete L.Icon.Default.prototype._getIconUrl;

L.Icon.Default.mergeOptions({
  iconRetinaUrl:
    "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png",
  iconUrl:
    "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png",
  shadowUrl:
    "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png",
});

const redMarkerIcon = new L.Icon({
  iconUrl:
    "https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-red.png",
  shadowUrl:
    "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png",
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41],
});


const techLogos = [
  { node: <FaGithub size={20} color="black" />, title: "GitHub" },
  { node: <SiSupabase size={20} color="black" />, title: "Supabase" },
  { node: <SiReact size={20} color="black" />, title: "React" },
  { node: <SiStripe size={20} color="black" />, title: "Stripe" },
  { node: <SiVite size={20} color="black" />, title: "Vite" },
];


function MapView({ start, itineraryPoints = [], plan = null }) {
  const containerRef = useRef(null);
  const mapRef = useRef(null);
  const markersRef = useRef([]);
  const routeLayerRef = useRef(null);
  const resizeObserverRef = useRef(null);
  const slideAncestorRef = useRef(null);
  const [debugLines, setDebugLines] = useState([]);
  const [visibleSize, setVisibleSize] = useState({ w: 0, h: 0 });
  const [hoveredStopIndex, setHoveredStopIndex] = useState(null);

  const zoomToPoint = (lat, lng) => {
    if (mapRef.current) {
      mapRef.current.setView([lat, lng], 15);
    }
  };

  const log = (msg) => {
    setDebugLines((d) => [msg, ...d].slice(0, 12));
    console.debug("[MapView]", msg);
  };

  const safeInvalidate = (map) => {
    if (!map) return;
    try {
      map.invalidateSize();
      log("invalidateSize() called");
    } catch (e) {
      log("invalidateSize() failed: " + String(e));
    }
  };

  const createMap = (container) => {
    if (!container || mapRef.current) return;
    log("Creating Leaflet map (container visible)");
    const m = L.map(container, {
      center: [37.7749, -122.4194],
      zoom: 13,
      zoomControl: true,
      preferCanvas: true,
    });
    mapRef.current = m;

    const tileLayer = L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution:
        '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
      maxZoom: 19,
    }).addTo(m);

    tileLayer.on("load", () => log("Tile layer loaded"));
    tileLayer.on("tileerror", (err) => log("Tile error: " + JSON.stringify(err)));

    setTimeout(() => safeInvalidate(m), 50);
    setTimeout(() => safeInvalidate(m), 300);
  };

  useEffect(() => {
    const container = containerRef.current;
    if (!container) {
      log("No containerRef on mount");
      return;
    }

    log("Mounting ResizeObserver for map container");

    if (window.ResizeObserver) {
      resizeObserverRef.current = new ResizeObserver((entries) => {
        for (const entry of entries) {
          const w = Math.round(entry.contentRect.width);
          const h = Math.round(entry.contentRect.height);
          setVisibleSize({ w, h });

          if (w > 0 && h > 0 && !mapRef.current) {
            createMap(container);
          } else if (w > 0 && h > 0 && mapRef.current) {
            safeInvalidate(mapRef.current);
          }
        }
      });

      try {
        resizeObserverRef.current.observe(container);
        log("ResizeObserver attached");
      } catch (e) {
        log("ResizeObserver observe failed: " + String(e));
      }
    } else {
      log("No ResizeObserver available");
      const w = container.clientWidth;
      const h = container.clientHeight;
      setVisibleSize({ w, h });
      if (w > 0 && h > 0 && !mapRef.current) createMap(container);
    }

    const slideAncestor = container.closest(".slide");
    slideAncestorRef.current = slideAncestor;
    const onTransitionEnd = () => {
      log("slide transitionend/animationend -> invalidating map and retrying");
      if (!mapRef.current) createMap(container);
      safeInvalidate(mapRef.current);
      setTimeout(() => safeInvalidate(mapRef.current), 150);
      setTimeout(() => safeInvalidate(mapRef.current), 500);
    };
    if (slideAncestor) {
      slideAncestor.addEventListener("transitionend", onTransitionEnd);
      slideAncestor.addEventListener("animationend", onTransitionEnd);
    }

    const initialW = Math.round(container.clientWidth);
    const initialH = Math.round(container.clientHeight);
    if (initialW > 0 && initialH > 0 && !mapRef.current) {
      createMap(container);
    } else {
      log(`Initial container size ${initialW}×${initialH} -> waiting for ResizeObserver`);
    }

    return () => {
      try {
        if (resizeObserverRef.current && container) {
          resizeObserverRef.current.unobserve(container);
          resizeObserverRef.current.disconnect();
        }
      } catch (e) {
      }
      if (slideAncestorRef.current) {
        slideAncestorRef.current.removeEventListener("transitionend", onTransitionEnd);
        slideAncestorRef.current.removeEventListener("animationend", onTransitionEnd);
      }

      try {
        if (mapRef.current) {
          mapRef.current.remove();
          mapRef.current = null;
        }
      } catch (e) {
      }
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) {
      log("Map not ready yet for route update");
      return;
    }

    log(`Got start: ${JSON.stringify(start)} itineraryPoints.length=${itineraryPoints.length}`);

    markersRef.current.forEach((m) => {
      try {
        m.remove();
      } catch (e) {}
    });
    markersRef.current = [];
    if (routeLayerRef.current) {
      try {
        routeLayerRef.current.remove();
      } catch (e) {}
      routeLayerRef.current = null;
    }

    const points = [];
    if (start && start.latitude != null && start.longitude != null) {
      points.push({ lat: Number(start.latitude), lng: Number(start.longitude), title: "Start (You)" });
    }

    itineraryPoints.forEach((p, idx) => {
      if (p && p.latitude != null && p.longitude != null) {
        points.push({
          lat: Number(p.latitude),
          lng: Number(p.longitude),
          title: p.activity || `Stop ${idx + 1}`,
          details: p.location || "",
        });
      }
    });

    log(`Computed ${points.length} valid point(s)`);

    if (points.length === 0) {
      log("No points to display; centering default");
      safeInvalidate(map);
      map.setView([37.7749, -122.4194], 12);
      return;
    }

    safeInvalidate(map);

    if (points.length === 1) {
      const pt = points[0];
      map.setView([pt.lat, pt.lng], 14);
      const marker = L.marker([pt.lat, pt.lng]).addTo(map).bindPopup(pt.title || "Location");
      markersRef.current.push(marker);
      log("Drew single-point marker");
      return;
    }

    const coordsForOsrm = points.map((p) => `${p.lng},${p.lat}`).join(";");
    const osrmUrl = `https://router.project-osrm.org/route/v1/driving/${encodeURIComponent(
      coordsForOsrm
    )}?overview=full&geometries=geojson&steps=false&annotations=duration,distance`;

    log("Requesting OSRM route: " + osrmUrl);

    let aborted = false;
    fetch(osrmUrl)
      .then((res) => {
        if (!res.ok) throw new Error("OSRM request failed: " + res.status);
        return res.json();
      })
      .then((data) => {
        if (aborted) return;
        if (data && data.routes && data.routes.length > 0) {
          const route = data.routes[0];
          routeLayerRef.current = L.geoJSON(route.geometry, { style: { weight: 5, opacity: 0.8 } }).addTo(map);

          points.forEach((p, idx) => {
            const isStart = idx === 0;
            const marker = L.marker([p.lat, p.lng], { icon: isStart ? redMarkerIcon : L.Icon.Default.prototype })
              .addTo(map)
              .bindPopup(`<strong>${isStart ? "Start" : p.title}</strong><br/>${p.details || ""}`);
            markersRef.current.push(marker);
          });

          safeInvalidate(map);

          const bounds = routeLayerRef.current.getBounds();
          if (bounds.isValid && typeof bounds.isValid === "function" ? bounds.isValid() : true) {
            map.fitBounds(bounds, { padding: [40, 40] });
            log("Fitted map to route bounds");
            setTimeout(() => safeInvalidate(map), 60);
          } else {
            log("Route bounds invalid");
          }
        } else {
          log("OSRM returned no routes -> polyline fallback");
          const latlngs = points.map((p) => [p.lat, p.lng]);
          routeLayerRef.current = L.polyline(latlngs, { weight: 4, dashArray: "6,6" }).addTo(map);
          points.forEach((p, idx) => {
            const isStart = idx === 0;
            const marker = L.marker([p.lat, p.lng], { icon: isStart ? redMarkerIcon : L.Icon.Default.prototype }).addTo(map).bindPopup(`<strong>${isStart ? "Start" : p.title}</strong>`);
            markersRef.current.push(marker);
          });
          safeInvalidate(map);
          const bounds = routeLayerRef.current.getBounds();
          if (bounds && bounds.isValid && bounds.isValid()) map.fitBounds(bounds, { padding: [40, 40] });
        }
      })
      .catch((err) => {
        if (aborted) return;
        console.warn("Routing failed, drawing polyline fallback:", err);
        log("Routing failed: " + (err && err.message ? err.message : String(err)));
        const latlngs = points.map((p) => [p.lat, p.lng]);
        routeLayerRef.current = L.polyline(latlngs, { weight: 4, dashArray: "6,6" }).addTo(map);
        points.forEach((p, idx) => {
          const isStart = idx === 0;
          const marker = L.marker([p.lat, p.lng], { icon: isStart ? redMarkerIcon : L.Icon.Default.prototype }).addTo(map).bindPopup(`<strong>${isStart ? "Start" : p.title}</strong>`);
          markersRef.current.push(marker);
        });
        safeInvalidate(map);
        const bounds = routeLayerRef.current.getBounds();
        if (bounds && bounds.isValid && bounds.isValid()) map.fitBounds(bounds, { padding: [40, 40] });
      });

    return () => {
      aborted = true;
    };
  }, [start, itineraryPoints, visibleSize.w, visibleSize.h]);

  const hasPoints =
    (start && start.latitude != null && start.longitude != null) ||
    (itineraryPoints && itineraryPoints.length > 0 && itineraryPoints.some((p) => p.latitude != null && p.longitude != null));

  return (
    <div style={{ display: "flex", gap: 16, marginBottom: 18 }}>
      <div style={{ flex: "1 1 60%", minWidth: 0, position: "relative" }}>
        <div
          ref={containerRef}
          style={{
            width: "100%",
            height: 400,
            borderRadius: 12,
            overflow: "hidden",
            boxShadow: "0 10px 30px rgba(16,24,40,0.08)",
          }}
          aria-hidden={false}
        />

        {!hasPoints && (
          <div
            style={{
              position: "absolute",
              left: 20,
              bottom: 20,
              background: "rgba(255,255,255,0.95)",
              padding: "10px 12px",
              borderRadius: 8,
              zIndex: 999,
              boxShadow: "0 6px 20px rgba(0,0,0,0.08)",
              fontSize: 13,
            }}
          >
            No route points available — the map is visible but there are no coordinates to render.
          </div>
        )}
      </div>

      <div
        style={{
          flex: "1 1 40%",
          minWidth: 0,
          background: "#fff",
          borderRadius: 12,
          padding: 16,
          boxShadow: "0 10px 30px rgba(16,24,40,0.08)",
          overflow: "auto",
          maxHeight: 400,
        }}
      >
        {plan && (
          <>
            <h3 style={{ margin: "0 0 12px 0", fontSize: "1.1rem", fontWeight: "bold" }}>
              {plan.title || "Your Itinerary"}
            </h3>
            {plan.description && (
              <p style={{ margin: "0 0 16px 0", fontSize: "0.9rem", color: "#666" }}>
                {plan.description}
              </p>
            )}
          </>
        )}

        {start && start.latitude != null && start.longitude != null && (
          <div
            onClick={() => zoomToPoint(start.latitude, start.longitude)}
            style={{
              padding: 12,
              marginBottom: 12,
              background: "#fff3cd",
              borderRadius: 8,
              borderLeft: "4px solid #ff0000",
              cursor: "pointer",
              transition: "all 0.2s ease",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = "translateX(4px)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = "translateX(0)";
            }}
          >
            <div style={{ fontWeight: "bold", color: "#000", marginBottom: 4 }}>
              📍 Your Location (Start)
            </div>
            {itineraryPoints.length > 0 && (
              <div style={{ fontSize: "0.85rem", color: "#666" }}>
                {itineraryPoints[0].location}
              </div>
            )}
          </div>
        )}

        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {itineraryPoints.map((point, idx) => (
            <div
              key={idx}
              onClick={() => zoomToPoint(point.latitude, point.longitude)}
              onMouseEnter={() => setHoveredStopIndex(idx)}
              onMouseLeave={() => setHoveredStopIndex(null)}
              style={{
                padding: 12,
                background: hoveredStopIndex === idx ? "#e3f2fd" : "#f5f5f5",
                borderRadius: 8,
                borderLeft: "4px solid #2196f3",
                cursor: "pointer",
                transition: "all 0.2s ease",
                transform: hoveredStopIndex === idx ? "translateX(4px)" : "translateX(0)",
              }}
            >
              <div style={{ fontWeight: "bold", color: "#000", marginBottom: 4 }}>
                Stop {idx + 1}: {point.place_name}
              </div>
              {point.activity && (
                <div style={{ fontSize: "0.85rem", color: "#666", marginBottom: 4 }}>
                  {point.activity}
                </div>
              )}
              {point.details && (
                <div style={{ fontSize: "0.85rem", color: "#666", marginBottom: 4 }}>
                  {point.details}
                </div>
              )}
              <div style={{ fontSize: "0.8rem", color: "#999" }}>
                {point.location}
              </div>
            </div>
          ))}
        </div>

        {itineraryPoints.length === 0 && (
          <div style={{ textAlign: "center", color: "#999", padding: "20px 10px" }}>
            No stops planned yet
          </div>
        )}
      </div>
    </div>
  );
}

export default function App() {
  const [screen, setScreen] = useState(0);
  const [input, setInput] = useState("");
  const [plan, setPlan] = useState(null);
  const [spots, setSpots] = useState([]);
  const [loadingTextIndex, setLoadingTextIndex] = useState(0);
  const loadStartRef = useRef(null);
  const MIN_LOADING_MS = 3000;

  const loadingMessages = [
    "Analyzing mood directions...",
    "Figuring out path...",
    "Discovering perfect spots...",
    "Crafting your itinerary...",
    "Mapping out adventures...",
    "Building your experience...",
  ];

  useEffect(() => {
    if (screen !== 0) return;
    
    const timer = setTimeout(() => setScreen(1), 3500);
    return () => clearTimeout(timer);
  }, [screen]);

  useEffect(() => {
    if (screen !== 2) return;
    
    const interval = setInterval(() => {
      setLoadingTextIndex((prev) => (prev + 1) % loadingMessages.length);
    }, 1000);

    return () => clearInterval(interval);
  }, [screen, loadingMessages.length]);

  const startLoading = async () => {
    if (!input.trim()) return;

    setScreen(2);
    loadStartRef.current = Date.now();

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const { latitude, longitude } = position.coords;

        try {
          const res = await fetch("http://localhost:5000/api/plan", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ prompt: input, latitude, longitude }),
          });

          const payload = await res.json();
          console.log("Received payload:", payload);
          setPlan(payload.plan);
          setSpots(payload.spots);

          const elapsed = Date.now() - (loadStartRef.current || 0);
          const remaining = Math.max(0, MIN_LOADING_MS - elapsed);
          setTimeout(() => setScreen(3), remaining);
        } catch (err) {
          console.error(err);
          alert("Error fetching plan.");
          setScreen(1);
        }
      },
      () => {
        alert("Unable to get location.");
        setScreen(1);
      }
    );
  };

  const getItineraryPoints = () => {
    if (plan && Array.isArray(plan.itinerary)) {
      const withCoords = plan.itinerary
        .filter((s) => s && s.latitude != null && s.longitude != null)
        .map((s) => ({
          latitude: s.latitude,
          longitude: s.longitude,
          place_name: s.place_name || s.name || "",
          activity: s.activity || "",
          details: s.details || s.description || "",
          location: s.location || s.address || "",
        }));

      if (withCoords.length > 0) return withCoords;
    }

    if (spots && spots.length > 0) {
      return spots
        .slice(0, 3)
        .map((b) => ({
          latitude: b.coordinates?.latitude,
          longitude: b.coordinates?.longitude,
          activity: b.name,
          location: (b.location?.display_address || []).join(", "),
        }))
        .filter((p) => p.latitude != null && p.longitude != null);
    }

    return [];
  };

  const mapStart = plan?.start_location || null;
  const itineraryPoints = getItineraryPoints();

  return (
    <div className="container">
      {screen !== 0 && (
        <div
          onClick={() => setScreen(0)}
          style={{
            position: "absolute",
            top: 20,
            left: 20,
            display: "flex",
            alignItems: "center",
            gap: 12,
            cursor: "pointer",
            zIndex: 100,
            transition: "opacity 0.2s ease",
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.opacity = "0.7";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.opacity = "1";
          }}
        >
          <img
            src="/logo.png"
            alt="Faro"
            style={{ height: 40, width: 40 }}
          />
          <span
            style={{
              fontSize: "1.3rem",
              fontWeight: "bold",
              color: "#000",
              fontFamily: "Georgia, 'Times New Roman', Times, serif",
            }}
          >
            Faro
          </span>
        </div>
      )}

      <div className={`slide ${screen === 0 ? "active" : ""}`}>
        <img 
          src="/logo.png" 
          alt="Faro Logo" 
          style={{ marginBottom: 10, height: 100, width: 100, marginRight: 7 }}
        />
        <h1 className="welcome-title">Welcome to Faro</h1>
      </div>

      <div className={`slide prompt-slide ${screen === 1 ? "active" : ""}`}>
        <h2 className="prompt-title">What vibe are you looking for?</h2>
        <div style={{ display: "flex", flexDirection: "column", gap: 20, alignItems: "center", width: "100%" }}>
          <input
            className="text-input"
            placeholder="ex: chill day, artsy date night..."
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyPress={(e) => e.key === "Enter" && startLoading()}
            style={{
              width: "min(90%, 520px)",
              padding: "18px 24px",
              borderRadius: 8,
              border: "2px solid #d1d1d1",
              background: "#fff",
              fontSize: "1.1rem",
              fontFamily: "Georgia, 'Times New Roman', Times, serif",
              outline: "none",
              transition: "all 0.3s ease",
              boxShadow: "0 2px 8px rgba(0,0,0,0.08)",
            }}
            onFocus={(e) => {
              e.target.style.borderColor = "#000";
              e.target.style.boxShadow = "0 4px 16px rgba(0,0,0,0.12)";
            }}
            onBlur={(e) => {
              e.target.style.borderColor = "#d1d1d1";
              e.target.style.boxShadow = "0 2px 8px rgba(0,0,0,0.08)";
            }}
          />
          <button
            className="next-btn"
            onClick={startLoading}
            style={{
              padding: "16px 48px",
              fontSize: "1.1rem",
              fontWeight: "bold",
              borderRadius: 8,
              border: "2px solid #000",
              background: "#fff",
              color: "#000",
              cursor: "pointer",
              transition: "all 0.25s ease",
              boxShadow: "0 2px 8px rgba(0,0,0,0.08)",
            }}
            onMouseEnter={(e) => {
              e.target.style.background = "#000";
              e.target.style.color = "#fff";
              e.target.style.boxShadow = "0 4px 16px rgba(0,0,0,0.2)";
            }}
            onMouseLeave={(e) => {
              e.target.style.background = "#fff";
              e.target.style.color = "#000";
              e.target.style.boxShadow = "0 2px 8px rgba(0,0,0,0.08)";
            }}
          >
            Continue
          </button>
        </div>
      </div>

      <div className={`slide ${screen === 2 ? "active loading-slide" : ""}`}>
        <div
          style={{
            width: "28ch",
            maxWidth: "80vw",
            height: "26px",
            display: "flex",
            alignItems: "center",
            overflow: "hidden",
            borderRadius: 999,
            marginBottom: 18,
            boxShadow: "inset 0 1px 0 rgba(255,255,255,0.6)",
            background: "rgba(0,0,0,0.02)",
          }}
          aria-hidden="true"
        >
          <LogoLoop
            logos={techLogos}
            speed={120}
            direction="left"
            logoHeight={20}
            gap={18}
            hoverSpeed={120}
            fadeOut={false}
          />
        </div>

      <div
          className="loading-text"
          style={{
            fontFamily: "Georgia, 'Times New Roman', Times, serif",
            color: "#000",
            fontSize: "1.05rem",
          }}
        >
          {loadingMessages[loadingTextIndex]}
        </div>
      </div>

      <div className={`slide ${screen === 3 ? "active results-slide" : ""}`}>
        <h2>Your Personalized Plan</h2>

        <div className="map-wrapper">
          <MapView key={screen === 3 ? 1 : 0} start={mapStart} itineraryPoints={itineraryPoints} plan={plan} />
        </div>

        <BusinessCards businesses={spots} />

        <button onClick={() => setScreen(1)}>Plan Another Trip</button>
      </div>
    </div>
  );
}
