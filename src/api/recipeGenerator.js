// Recipe generation via the Anthropic API (real integration).
//
// ⚠️  This calls the API directly from the browser using a VITE_ env var, which
// means the key is visible to anyone who opens devtools. That's acceptable for a
// local learning prototype only. For anything public, move this call behind a
// backend proxy and keep the key server-side.

import Anthropic from "@anthropic-ai/sdk";

// Single knob for the model. `claude-opus-4-1` was explicitly requested.
// NOTE: it is deprecated (retires 2026-08-05) — switch to "claude-opus-4-8"
// (current, most capable) by changing just this line.
export const MODEL = "claude-opus-4-1";

const apiKey = import.meta.env.VITE_CLAUDE_API_KEY;

const client = new Anthropic({
  apiKey,
  // Required to run in the browser. See the security note above.
  dangerouslyAllowBrowser: true,
});

function buildPrompt(ingredients) {
  const list = ingredients.map((i) => `- ${i.name} (${i.label})`).join("\n");
  return `You are a fearless, witty chef on a chaotic cooking game show. The
roulette wheel just dealt these 4 ingredients:

${list}

Invent ONE genuinely cookable recipe that uses all of them. Be creative and a
little funny, but keep it actually edible.

Respond with ONLY a JSON object (no markdown, no code fences) of this exact shape:
{
  "title": "punchy dish name",
  "tagline": "one playful sentence",
  "ingredients": ["item with rough quantity", "..."],
  "steps": ["step 1", "step 2", "..."],
  "chefNote": "one short tip or joke"
}`;
}

// Pulls the first balanced JSON object out of a string, tolerating stray prose
// or code fences the model might add.
function extractJson(text) {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start === -1 || end === -1 || end < start) {
    throw new Error("No JSON object found in the model response.");
  }
  return JSON.parse(text.slice(start, end + 1));
}

/**
 * Generate a recipe for the given spun ingredients.
 * @param {Array<{name:string,label:string}>} ingredients
 * @returns {Promise<{title,tagline,ingredients,steps,chefNote}>}
 */
export async function generateRecipe(ingredients) {
  if (!apiKey) {
    throw new Error(
      "Missing VITE_CLAUDE_API_KEY. Copy .env.example to .env and add your key, then restart the dev server.",
    );
  }

  const response = await client.messages.create({
    model: MODEL,
    max_tokens: 1024,
    messages: [{ role: "user", content: buildPrompt(ingredients) }],
  });

  const text = response.content
    .filter((block) => block.type === "text")
    .map((block) => block.text)
    .join("");

  const recipe = extractJson(text);

  // Normalize so the UI never crashes on a missing field.
  return {
    title: recipe.title || "Mystery Dish",
    tagline: recipe.tagline || "",
    ingredients: Array.isArray(recipe.ingredients) ? recipe.ingredients : [],
    steps: Array.isArray(recipe.steps) ? recipe.steps : [],
    chefNote: recipe.chefNote || "",
  };
}
