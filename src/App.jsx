import { useState } from "react";
import { useLocalStorage } from "./hooks/useLocalStorage.js";
import RecipeRoulette from "./components/RecipeRoulette.jsx";
import Favorites from "./components/Favorites.jsx";
import { palette, mono, stampButton } from "./styles.js";

const TABS = [
  { id: "generator", label: "🎰 Generator" },
  { id: "favorites", label: "⭐ Favorites" },
];

export default function App() {
  const [tab, setTab] = useState("generator");
  const [favorites, setFavorites] = useLocalStorage("rr.favorites", []);

  function saveFavorite(recipe) {
    setFavorites((prev) => [...prev, recipe]);
  }

  function rateFavorite(id, rating) {
    setFavorites((prev) => prev.map((f) => (f.id === id ? { ...f, rating } : f)));
  }

  function deleteFavorite(id) {
    setFavorites((prev) => prev.filter((f) => f.id !== id));
  }

  return (
    <div style={{ maxWidth: 820, margin: "0 auto", padding: "1.5rem 1rem 4rem" }}>
      <header style={{ textAlign: "center", marginBottom: "1.5rem" }}>
        <h1
          style={{
            fontFamily: mono,
            fontSize: "clamp(1.8rem, 6vw, 3rem)",
            margin: 0,
            textTransform: "uppercase",
            letterSpacing: "0.05em",
            color: palette.navy,
            textShadow: `3px 3px 0 ${palette.orange}`,
          }}
        >
          Random Recipe Roulette
        </h1>
        <p style={{ margin: "0.5rem 0 0", letterSpacing: "0.15em", textTransform: "uppercase", fontSize: "0.75rem" }}>
          ·  spin · generate · regret · repeat  ·
        </p>
      </header>

      <nav
        role="tablist"
        style={{ display: "flex", gap: "1rem", justifyContent: "center", marginBottom: "1.5rem" }}
      >
        {TABS.map((t) => {
          const active = tab === t.id;
          return (
            <button
              key={t.id}
              role="tab"
              aria-selected={active}
              onClick={() => setTab(t.id)}
              style={{
                ...stampButton(active ? palette.orange : palette.cream),
                color: active ? palette.cream : palette.navy,
                transform: active ? "rotate(-2deg)" : "rotate(-2deg) scale(0.95)",
                opacity: active ? 1 : 0.8,
              }}
            >
              {t.label}
              {t.id === "favorites" && favorites.length > 0 ? ` (${favorites.length})` : ""}
            </button>
          );
        })}
      </nav>

      <main>
        {tab === "generator" ? (
          <RecipeRoulette onSave={saveFavorite} />
        ) : (
          <Favorites favorites={favorites} onRate={rateFavorite} onDelete={deleteFavorite} />
        )}
      </main>
    </div>
  );
}
