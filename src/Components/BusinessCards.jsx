import React from "react";

export default function BusinessCards({ businesses = [] }) {
  const placeholder =
    "data:image/svg+xml;utf8," +
    encodeURIComponent(
      `<svg xmlns='http://www.w3.org/2000/svg' width='600' height='400' viewBox='0 0 600 400'><defs><linearGradient id='g' x1='0%' y1='0%' x2='100%' y2='100%'><stop offset='0%' style='stop-color:#f7f2e8'/><stop offset='100%' style='stop-color:#ffffff'/></linearGradient></defs><rect width='600' height='400' fill='url(#g)'/></svg>`
    );

  return (
    <div className="bc-wrapper" aria-live="polite">
      <header className="bc-header">
        <p className="bc-sub">Other curated places based on your vibe — tap a card to explore</p>
      </header>

      <div className="bc-grid">
        {businesses.map((b, idx) => {
          const categories = (b.categories || []).map((c) => c.title).slice(0, 2);
          const address = b.location?.display_address?.join(", ") || "";
          return (
            <a
              key={b.id}
              href={b.url}
              target="_blank"
              rel="noopener noreferrer"
              className="bc-card"
              style={{ animationDelay: `${idx * 0.06}s` }}
              aria-label={`Open ${b.name} in new tab`}
            >
              <div className="bc-media">
                <img
                  src={b.image_url || placeholder}
                  alt={b.name || "Business image"}
                  onError={(e) => {
                    if (e?.currentTarget) e.currentTarget.src = placeholder;
                  }}
                />
                <div className="bc-overlay" />
                <div className="bc-badges">
                  {categories.map((c, i) => (
                    <span className="bc-chip" key={i}>
                      {c}
                    </span>
                  ))}
                </div>
              </div>

              <div className="bc-body">
                <div className="bc-row">
                  <h3 className="bc-name">{b.name}</h3>
                  {b.rating && (
                    <div className="bc-rating" title={`${b.rating} out of 5`}>
                      <svg viewBox="0 0 24 24" className="star">
                        <path d="M12 .587l3.668 7.431 8.2 1.192-5.934 5.79 1.401 8.165L12 18.896l-7.335 3.869 1.401-8.165L.132 9.21l8.2-1.192z" />
                      </svg>
                      <span className="rating-value">{b.rating.toFixed(1)}</span>
                    </div>
                  )}
                </div>

                {b.review_count > 0 && (
                  <p className="bc-reviews">{b.review_count} reviews</p>
                )}

                <p className="bc-address">{address}</p>

                <div className="bc-meta">
                  <span className="bc-distance">
                    {b.distance ? `${(b.distance / 1000).toFixed(1)} km away` : ""}
                  </span>
                  <button
                    className="bc-open"
                    onClick={(e) => {
                      e.preventDefault();
                      window.open(b.url, "_blank", "noopener");
                    }}
                    aria-label={`Open ${b.name}`}
                  >
                    <span>View details</span>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M5 12h14M12 5l7 7-7 7"/>
                    </svg>
                  </button>
                </div>
              </div>
            </a>
          );
        })}
      </div>

      <style>{`
        /* Softer serif to match app */
        :root {
          --cream: #f7f2e8;
          --card-bg: #ffffff;
          --muted: #6b7280;
          --text: #0f172a;
          --accent: #111111; /* neutral accent (black) */
          --chip-bg: rgba(255,255,255,0.9);
          --chip-border: rgba(16,24,40,0.06);
          --shadow: rgba(16,24,40,0.06);
        }

        @keyframes slideUp {
          from { opacity: 0; transform: translateY(20px); }
          to   { opacity: 1; transform: translateY(0); }
        }

        /* wrapper */
        .bc-wrapper {
          width: 100%;
          max-width: 1280px;
          margin: 0 auto;
          padding: 0 12px;
          box-sizing: border-box;
          font-family: Georgia, "Times New Roman", Times, serif;
          color: var(--text);
        }

        .bc-header {
          display: flex;
          flex-direction: column;
          gap: 8px;
          align-items: center;
          margin: 0.4px 0 28px;
          animation: slideUp 0.5s cubic-bezier(0.4,0,0.2,1) forwards;
        }

        .bc-sub {
          margin: 0;
          color: var(--muted);
          font-size: 0.98rem;
          text-align: center;
          max-width: 720px;
          line-height: 1.5;
        }

        /* grid */
        .bc-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
          gap: 20px;
          padding: 0 4px 32px;
        }

        @media (max-width: 640px) {
          .bc-grid {
            grid-template-columns: 1fr;
            gap: 18px;
            padding: 0;
          }
          .bc-header {
            margin-bottom: 20px;
          }
        }

        /* card */
        .bc-card {
          display: flex;
          flex-direction: column;
          background: var(--card-bg);
          border-radius: 12px;
          overflow: hidden;
          text-decoration: none;
          color: inherit;
          box-shadow: 0 6px 18px var(--shadow);
          transition: transform 0.28s ease, box-shadow 0.28s ease, border-color 0.28s ease;
          border: 1px solid rgba(15,23,42,0.04);
          opacity: 0;
          animation: slideUp 0.45s cubic-bezier(0.4, 0, 0.2, 1) forwards;
        }

        .bc-card:hover {
          transform: translateY(-6px);
          box-shadow: 0 18px 40px rgba(15,23,42,0.08);
          border-color: rgba(15,23,42,0.06);
        }

        .bc-card:focus {
          outline: none;
          box-shadow: 0 0 0 4px rgba(16,24,40,0.06);
        }

        /* media */
        .bc-media {
          position: relative;
          aspect-ratio: 16/9;
          background: linear-gradient(180deg, var(--cream), #ffffff);
          overflow: hidden;
        }

        .bc-media img {
          width: 100%;
          height: 100%;
          object-fit: cover;
          display: block;
          transition: transform 0.6s cubic-bezier(0.4, 0, 0.2, 1);
        }

        .bc-card:hover .bc-media img {
          transform: scale(1.03);
        }

        .bc-overlay {
          position: absolute;
          inset: 0;
          background: linear-gradient(180deg, transparent 40%, rgba(0,0,0,0.15) 100%);
          opacity: 0;
          transition: opacity 0.32s ease;
          pointer-events: none;
        }

        .bc-card:hover .bc-overlay {
          opacity: 1;
        }

        .bc-badges {
          position: absolute;
          left: 14px;
          bottom: 14px;
          display: flex;
          gap: 8px;
          align-items: center;
          flex-wrap: wrap;
          z-index: 2;
        }

        .bc-chip {
          background: var(--chip-bg);
          padding: 6px 12px;
          border-radius: 999px;
          font-size: 12px;
          font-weight: 600;
          color: var(--accent);
          box-shadow: 0 2px 8px rgba(16,24,40,0.035);
          border: 1px solid var(--chip-border);
          backdrop-filter: blur(6px);
        }

        /* body */
        .bc-body {
          padding: 16px;
          display: flex;
          flex-direction: column;
          gap: 8px;
          flex: 1;
        }

        .bc-row {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          gap: 12px;
          margin-bottom: 2px;
        }

        .bc-name {
          margin: 0;
          font-size: 1.05rem;
          line-height: 1.25;
          font-weight: 700;
          color: var(--text);
          display: -webkit-box;
          -webkit-line-clamp: 2;
          -webkit-box-orient: vertical;
          overflow: hidden;
          letter-spacing: -0.01em;
        }

        .bc-rating {
          display: flex;
          align-items: center;
          gap: 6px;
          background: linear-gradient(180deg,#fff8e6,#fff4d6);
          padding: 6px 10px;
          border-radius: 999px;
          min-width: 56px;
          justify-content: center;
          font-size: 13px;
          color: #7a3f00;
          flex-shrink: 0;
          border: 1px solid rgba(250, 204, 21, 0.12);
        }

        .star {
          width: 14px;
          height: 14px;
          fill: #f5b942;
          display: block;
        }

        .rating-value {
          font-weight: 700;
          font-size: 13px;
        }

        .bc-reviews {
          margin: 0;
          color: var(--muted);
          font-size: 13px;
          font-weight: 500;
        }

        .bc-address {
          margin: 0;
          color: var(--muted);
          font-size: 14px;
          line-height: 1.45;
          display: -webkit-box;
          -webkit-line-clamp: 2;
          -webkit-box-orient: vertical;
          overflow: hidden;
        }

        /* meta row */
        .bc-meta {
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 12px;
          margin-top: 8px;
          padding-top: 8px;
          border-top: 1px solid rgba(15,23,42,0.03);
        }

        .bc-distance {
          font-size: 13px;
          color: var(--text);
          font-weight: 600;
          display: flex;
          align-items: center;
          gap: 6px;
        }

        .bc-open {
          background: transparent;
          border: 1px solid rgba(15,23,42,0.08);
          padding: 8px 14px;
          border-radius: 8px;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.22s ease;
          font-size: 13px;
          color: var(--accent);
          display: inline-flex;
          align-items: center;
          gap: 8px;
        }

        .bc-open:hover {
          background: var(--accent);
          color: #fff;
          transform: translateX(2px);
          box-shadow: 0 6px 14px rgba(16,24,40,0.06);
          border-color: rgba(16,24,40,0.08);
        }

        .bc-open:focus {
          outline: 3px solid rgba(16,24,40,0.06);
          outline-offset: 2px;
        }

        .bc-open svg {
          transition: transform 0.28s ease;
        }

        .bc-open:hover svg {
          transform: translateX(3px);
        }

        /* accessibility helper */
        .visually-hidden {
          position: absolute !important;
          height: 1px;
          width: 1px;
          overflow: hidden;
          clip: rect(1px, 1px, 1px, 1px);
          white-space: nowrap;
        }
      `}</style>
    </div>
  );
}
