import { palette, panel, tag, stampButton } from "../styles.js";
import StarRating from "./StarRating.jsx";

// Renders one recipe: the ingredients it was spun from, the generated content,
// a star rating, and a primary action (Save in the generator, Delete in
// favorites). `animate` triggers the rubber-stamp entrance.
export default function RecipeCard({
  recipe,
  spun = [],
  rating = 0,
  onRate,
  action,
  animate = false,
}) {
  return (
    <article
      style={{
        ...panel,
        animation: animate ? "rr-stamp 0.4s ease-out both" : "none",
      }}
    >
      <header style={{ borderBottom: `2px dashed ${palette.navy}`, paddingBottom: "0.6rem" }}>
        <h2 style={{ margin: "0 0 0.25rem", fontSize: "1.5rem", textTransform: "uppercase" }}>
          {recipe.title}
        </h2>
        {recipe.tagline && (
          <p style={{ margin: 0, fontStyle: "italic", opacity: 0.85 }}>{recipe.tagline}</p>
        )}
      </header>

      {spun.length > 0 && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: "0.4rem", margin: "0.75rem 0" }}>
          {spun.map((ing, i) => (
            <span key={i} style={tag}>
              {ing.emoji} {ing.name}
            </span>
          ))}
        </div>
      )}

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr",
          gap: "1rem",
          marginTop: "0.5rem",
        }}
      >
        <section>
          <h3 style={{ margin: "0 0 0.35rem", textTransform: "uppercase", letterSpacing: "0.08em" }}>
            🧺 Ingredients
          </h3>
          <ul style={{ margin: 0, paddingLeft: "1.2rem", lineHeight: 1.6 }}>
            {recipe.ingredients.map((item, i) => (
              <li key={i}>{item}</li>
            ))}
          </ul>
        </section>

        <section>
          <h3 style={{ margin: "0 0 0.35rem", textTransform: "uppercase", letterSpacing: "0.08em" }}>
            👩‍🍳 Method
          </h3>
          <ol style={{ margin: 0, paddingLeft: "1.2rem", lineHeight: 1.6 }}>
            {recipe.steps.map((step, i) => (
              <li key={i} style={{ marginBottom: "0.3rem" }}>
                {step}
              </li>
            ))}
          </ol>
        </section>
      </div>

      {recipe.chefNote && (
        <p
          style={{
            marginTop: "1rem",
            padding: "0.6rem 0.8rem",
            background: palette.creamDark,
            border: `2px solid ${palette.navy}`,
          }}
        >
          <strong>💡 Chef's note:</strong> {recipe.chefNote}
        </p>
      )}

      <footer
        style={{
          marginTop: "1rem",
          display: "flex",
          flexWrap: "wrap",
          gap: "0.75rem",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <label style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
          <span style={{ textTransform: "uppercase", fontSize: "0.8rem", letterSpacing: "0.08em" }}>
            Rate:
          </span>
          <StarRating value={rating} onRate={onRate} readOnly={!onRate} />
        </label>
        {action}
      </footer>
    </article>
  );
}

// Shared small stamp action button used inside cards.
export function CardButton({ children, onClick, accent }) {
  return (
    <button type="button" onClick={onClick} style={{ ...stampButton(accent), fontSize: "0.85rem" }}>
      {children}
    </button>
  );
}
