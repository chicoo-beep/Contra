// Six chaotic ingredient pools. A "spin" picks 4 pools at random and draws one
// ingredient from each, so every roll is a different (often unhinged) combo.

export const POOLS = {
  proteins: {
    emoji: "🍗",
    label: "Protein",
    items: [
      "smoked tofu",
      "leftover rotisserie chicken",
      "canned sardines",
      "black beans",
      "halloumi",
      "pulled jackfruit",
      "a single fried egg",
      "spam",
    ],
  },
  bases: {
    emoji: "🍚",
    label: "Base",
    items: [
      "day-old rice",
      "instant ramen bricks",
      "mashed potatoes",
      "cauliflower gnocchi",
      "stale sourdough",
      "rice paper wrappers",
      "polenta",
      "frozen pierogi",
    ],
  },
  vegetables: {
    emoji: "🥦",
    label: "Vegetable",
    items: [
      "charred broccoli",
      "pickled red onion",
      "roasted beets",
      "raw kale",
      "sweet corn",
      "shaved fennel",
      "fire-roasted peppers",
      "kimchi",
    ],
  },
  sauces: {
    emoji: "🥫",
    label: "Sauce",
    items: [
      "gochujang",
      "browned butter",
      "tahini-lime drizzle",
      "chimichurri",
      "miso caramel",
      "harissa yogurt",
      "maple sriracha",
      "garlic confit oil",
    ],
  },
  cuisines: {
    emoji: "🌍",
    label: "Cuisine",
    items: [
      "Tex-Mex",
      "Sicilian",
      "Korean-Mexican fusion",
      "diner-American",
      "Levantine",
      "Japanese izakaya",
      "Ethiopian-inspired",
      "Nordic",
    ],
  },
  chaos: {
    emoji: "🌀",
    label: "Chaos",
    items: [
      "a fistful of crushed potato chips",
      "edible flowers",
      "instant espresso powder",
      "blue cheese crumbles",
      "candied ginger",
      "a splash of pickle brine",
      "toasted marshmallow",
      "everything bagel seasoning",
    ],
  },
};

export const POOL_KEYS = Object.keys(POOLS);

function pick(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

// Returns 4 ingredients drawn from 4 randomly chosen distinct pools.
export function spinIngredients(count = 4) {
  const keys = [...POOL_KEYS].sort(() => Math.random() - 0.5).slice(0, count);
  return keys.map((key) => ({
    pool: key,
    label: POOLS[key].label,
    emoji: POOLS[key].emoji,
    name: pick(POOLS[key].items),
  }));
}
