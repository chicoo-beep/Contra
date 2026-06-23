# 🎰 Random Recipe Roulette

Spin a wheel of six chaotic ingredient pools, get four random ingredients, and
let **Claude** invent a (genuinely cookable) recipe from them. Rate your
creations, save the keepers to favorites. A retro-futuristic React + Vite
playground for getting hands-on with Claude Code and the GitHub workflow.

![stack](https://img.shields.io/badge/React-18-1a2340) ![stack](https://img.shields.io/badge/Vite-5-c9551a) ![api](https://img.shields.io/badge/Anthropic-API-1a2340)

## Features

- **🎲 Spin** — randomizes 4 ingredients drawn from 6 pools: proteins, bases,
  vegetables, sauces, cuisines, and pure chaos.
- **✨ Generate** — real Anthropic API call turns the ingredients into a recipe
  (title, ingredients, steps, and a chef's note).
- **⭐ 5-star ratings** on every recipe.
- **💾 Favorites** — save/delete recipes; persisted in `localStorage`.
- **Two tabs** — Generator and Favorites.
- **Retro-futuristic UI** — aged cream, navy ink, muted orange, monospaced
  type, halftone dot background, and rubber-stamp buttons. All styling is
  CSS-in-JS (no Tailwind).

## ⚠️ Security — read this first

This app calls the Anthropic API **directly from the browser** using a
`VITE_CLAUDE_API_KEY` environment variable. Vite inlines any `VITE_*` variable
into the client bundle, so **the key is visible to anyone who opens the app**.
The Anthropic SDK is initialized with `dangerouslyAllowBrowser: true` for the
same reason.

This is fine for a **local learning prototype**. It is **not** safe to deploy
publicly with a real key — anyone could extract and abuse it. For production,
put the API call behind a small backend proxy and keep the key server-side. The
included GitHub Pages workflow deploys the static UI **without** a key (live
generation only works locally).

## Setup

Requires Node 18+ (tested on Node 22).

```bash
# 1. Install dependencies
npm install

# 2. Add your API key
cp .env.example .env
#   then edit .env and set VITE_CLAUDE_API_KEY=sk-ant-...
#   (get a key at https://console.anthropic.com/settings/keys)

# 3. Run the dev server
npm run dev
```

Open the printed local URL (default http://localhost:5173).

```bash
npm run build     # production build → dist/
npm run preview   # preview the production build locally
```

## Model

The model is a single constant in [`src/api/recipeGenerator.js`](src/api/recipeGenerator.js):

```js
export const MODEL = "claude-opus-4-1";
```

`claude-opus-4-1` was the requested model. Note it is **deprecated**
(retires 2026-08-05) — switch to **`claude-opus-4-8`** (current, most capable)
by changing just that line.

## Project structure

```
.
├── index.html
├── vite.config.js
├── .env.example
├── .github/workflows/deploy.yml   # optional CI → GitHub Pages
└── src/
    ├── main.jsx                   # entry; injects global CSS
    ├── App.jsx                    # tabs + favorites state (localStorage)
    ├── styles.js                  # palette + CSS-in-JS theme
    ├── api/
    │   └── recipeGenerator.js     # Anthropic API integration
    ├── data/
    │   └── ingredients.js         # the 6 chaotic pools + spin logic
    ├── hooks/
    │   └── useLocalStorage.js     # persistence hook
    └── components/
        ├── RecipeRoulette.jsx     # Generator tab
        ├── Favorites.jsx          # Favorites tab
        ├── RecipeCard.jsx         # shared recipe display
        └── StarRating.jsx         # 5-star rating
```

## How it works

1. `spinIngredients()` picks 4 of the 6 pools at random and draws one ingredient
   from each.
2. `generateRecipe()` sends those ingredients to Claude and parses the JSON
   recipe back out (defensively — it tolerates stray prose or code fences).
3. Ratings and saved favorites live in `localStorage` via `useLocalStorage`, so
   they survive a refresh.
