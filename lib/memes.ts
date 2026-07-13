// Curated verdict-reveal GIFs, hotlinked from Giphy's CDN (no API key —
// the search API needs one, direct media URLs don't). Every id below was
// HTTP-checked AND eyeballed before shipping; if one ever 404s the overlay
// falls back to a big emoji, so a dead link can't break the reveal.

const GIPHY = (id: string) => `https://media.giphy.com/media/${id}/giphy.gif`;

export const CORRECT_GIFS = [
  'l0MYt5jPR6QX5pnqM', // The Office — group celebration dance
  'g9582DNuQppxC', // Leo DiCaprio — Gatsby cheers
  '111ebonMs90YLu', // kid at computer — thumbs up
  '3oz8xAFtqoOUUrsh7W', // sunglasses flower — YEAH!
  'YTbZzCkRQCEJa', // kid going wild with joy
  '26u4cqiYI30juCOGY', // trophy + confetti shower
  'artj92V8o75VPL7AeQ', // confetti celebration
  'xT0xeJpnrWC4XWblEk', // galaxy-brain mind blown
  '3o7abKhOpu0NwenH3O', // SpongeBob — victory flex
  '26tPplGWjN0xLybiU', // Bart — happy table dance
  'xT5LMHxhOfscxPfIfm', // Homer — WOO HOO!
  '3o7btNa0RUYa5E7iiQ', // Seth Meyers — "there it is!"
].map(GIPHY);

export const WRONG_GIFS = [
  '6nWhy3ulBL7GSCvKw6', // Surprised Pikachu
  'l2JehQ2GitHGdVG9y', // Homer backs into the bushes
  'd10dMmzqCYqQ0', // Michael Scott — dead stare
  'rvDtLCABDMaqY', // Taylor Swift — sad sign
  'ISOckXUybVfQ4', // SpongeBob — alone in the diner
  '12XMGIWtrHBl5e', // Don Draper — pained wince
  'TJawtKM6OCKkvwCIqX', // Picard facepalm
  'l4FGpP4lxGGgK5CBW', // "sending you a hug" bunny
  '26ybwvTX4DTkwst6U', // sad Bart
  '55itGuoAJiZEEen9gg', // Ralph — *chuckles* I'm in danger
].map(GIPHY);

export function randomVerdictGif(correct: boolean): string {
  const pool = correct ? CORRECT_GIFS : WRONG_GIFS;
  return pool[Math.floor(Math.random() * pool.length)];
}
