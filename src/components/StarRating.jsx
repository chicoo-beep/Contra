import { useState } from "react";
import { palette } from "../styles.js";

// 5-star rating. Controlled by `value`; reports clicks via `onRate`.
// Read-only mode (used in the Favorites list) disables interaction.
export default function StarRating({ value = 0, onRate, readOnly = false }) {
  const [hover, setHover] = useState(0);
  const shown = hover || value;

  return (
    <div role="group" aria-label="rating" style={{ display: "inline-flex", gap: "0.15rem" }}>
      {[1, 2, 3, 4, 5].map((star) => (
        <button
          key={star}
          type="button"
          disabled={readOnly}
          onClick={() => onRate?.(star)}
          onMouseEnter={() => !readOnly && setHover(star)}
          onMouseLeave={() => !readOnly && setHover(0)}
          aria-label={`${star} star${star > 1 ? "s" : ""}`}
          style={{
            background: "none",
            border: "none",
            padding: 0,
            cursor: readOnly ? "default" : "pointer",
            fontSize: "1.5rem",
            lineHeight: 1,
            filter: star <= shown ? "none" : "grayscale(1) opacity(0.35)",
            color: palette.orange,
          }}
        >
          {star <= shown ? "★" : "☆"}
        </button>
      ))}
    </div>
  );
}
