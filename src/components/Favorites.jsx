import { palette, panel } from "../styles.js";
import RecipeCard, { CardButton } from "./RecipeCard.jsx";

// The Favorites tab: saved recipes from localStorage, with editable ratings
// and delete. `onRate` / `onDelete` are owned by App so storage stays in sync.
export default function Favorites({ favorites, onRate, onDelete }) {
  if (favorites.length === 0) {
    return (
      <div style={{ ...panel, textAlign: "center", padding: "2.5rem 1.25rem" }}>
        <p style={{ fontSize: "2.5rem", margin: 0 }}>🗒️</p>
        <p style={{ marginBottom: 0 }}>
          No favorites yet. Spin the wheel, generate something cursed, and hit{" "}
          <strong>Save</strong>.
        </p>
      </div>
    );
  }

  // Newest first.
  const ordered = [...favorites].sort((a, b) => (a.savedAt < b.savedAt ? 1 : -1));

  return (
    <div style={{ display: "grid", gap: "1.25rem" }}>
      <p style={{ margin: 0, textTransform: "uppercase", letterSpacing: "0.1em" }}>
        ⭐ {favorites.length} saved recipe{favorites.length > 1 ? "s" : ""}
      </p>
      {ordered.map((fav) => (
        <RecipeCard
          key={fav.id}
          recipe={fav}
          spun={fav.spun}
          rating={fav.rating}
          onRate={(value) => onRate(fav.id, value)}
          action={
            <CardButton onClick={() => onDelete(fav.id)} accent={palette.navy}>
              🗑️ Delete
            </CardButton>
          }
        />
      ))}
    </div>
  );
}
