import { useState } from "react";
import { spinIngredients } from "../data/ingredients.js";
import { generateRecipe } from "../api/recipeGenerator.js";
import { palette, panel, stampButton, stampButtonActive, tag } from "../styles.js";
import RecipeCard, { CardButton } from "./RecipeCard.jsx";

// The Generator tab: spin the wheel, generate a recipe, rate it, save it.
export default function RecipeRoulette({ onSave }) {
  const [spun, setSpun] = useState(() => spinIngredients());
  const [recipe, setRecipe] = useState(null);
  const [rating, setRating] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);
  const [spinning, setSpinning] = useState(false);

  function handleSpin() {
    setSpinning(true);
    setSpun(spinIngredients());
    setRecipe(null);
    setRating(0);
    setSaved(false);
    setError("");
    setTimeout(() => setSpinning(false), 450);
  }

  async function handleGenerate() {
    setLoading(true);
    setError("");
    setRecipe(null);
    setRating(0);
    setSaved(false);
    try {
      const result = await generateRecipe(spun);
      setRecipe(result);
    } catch (err) {
      setError(err.message || "Something went wrong generating the recipe.");
    } finally {
      setLoading(false);
    }
  }

  function handleSave() {
    if (!recipe || saved) return;
    onSave({
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      ...recipe,
      spun,
      rating,
      savedAt: new Date().toISOString(),
    });
    setSaved(true);
  }

  return (
    <div style={{ display: "grid", gap: "1.25rem" }}>
      <section style={{ ...panel, textAlign: "center" }}>
        <h2 style={{ marginTop: 0, textTransform: "uppercase", letterSpacing: "0.1em" }}>
          🎰 The Wheel of Culinary Chaos
        </h2>
        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            justifyContent: "center",
            gap: "0.6rem",
            margin: "1rem 0 1.25rem",
          }}
        >
          {spun.map((ing, i) => (
            <span
              key={`${ing.pool}-${i}`}
              style={{
                ...tag,
                fontSize: "0.95rem",
                padding: "0.4rem 0.7rem",
                animation: spinning ? `rr-spin 0.45s ease ${i * 0.05}s` : "none",
              }}
            >
              <strong style={{ display: "block", fontSize: "0.65rem", opacity: 0.6 }}>
                {ing.emoji} {ing.label}
              </strong>
              {ing.name}
            </span>
          ))}
        </div>

        <div style={{ display: "flex", gap: "1rem", justifyContent: "center", flexWrap: "wrap" }}>
          <button
            type="button"
            onClick={handleSpin}
            disabled={loading}
            style={stampButton(palette.navy)}
            onMouseDown={(e) => Object.assign(e.currentTarget.style, stampButtonActive)}
            onMouseUp={(e) => (e.currentTarget.style.transform = "rotate(-2deg)")}
          >
            🎲 Spin
          </button>
          <button
            type="button"
            onClick={handleGenerate}
            disabled={loading}
            style={{ ...stampButton(palette.orange), opacity: loading ? 0.6 : 1 }}
          >
            {loading ? "🍳 Cooking…" : "✨ Generate Recipe"}
          </button>
        </div>
      </section>

      {error && (
        <p
          style={{
            ...panel,
            borderColor: palette.orange,
            color: palette.orange,
            margin: 0,
          }}
        >
          ⚠️ {error}
        </p>
      )}

      {recipe && (
        <RecipeCard
          recipe={recipe}
          spun={spun}
          rating={rating}
          onRate={setRating}
          animate
          action={
            <CardButton onClick={handleSave} accent={saved ? palette.navy : palette.orange}>
              {saved ? "✓ Saved" : "💾 Save to Favorites"}
            </CardButton>
          }
        />
      )}
    </div>
  );
}
