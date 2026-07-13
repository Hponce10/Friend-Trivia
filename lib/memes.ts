// Curated verdict-reveal GIFs, hotlinked from Giphy's CDN (no API key —
// the search API needs one, direct media URLs don't). Every id below was
// HTTP-checked AND eyeballed before shipping; if one ever 404s the overlay
// falls back to a big emoji, so a dead link can't break the reveal.
// Tone: adult game night — cheeky is in, explicit and political are out.

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
  '26gsjCZpPolPr3sBy', // Seth Meyers — megaphone THANK YOU!
  'l0HlvtIPzPdt2usKs', // crowd losing it — OHHHH!
  'chzz1FQgqhytWRWbp3', // Minions — mass celebration
  '3o84sq21TxDH6PyYms', // Palpatine — UNLIMITED POWER!
  '3rgXBOmTlzyFCURutG', // Jack Nicholson — devil grin
  '26tOZ42Mg6pbTUPHW', // fireworks finale
  '8UF0EXzsc0Ckg', // Kronk — mission accomplished
  '1GrsfWBDiTN60', // pageant kid — victory shimmy
  '3o6fJ1BM7R2EBRDnxK', // The Office — CONGRATS!
  '26FLdmIp6wJr91JAI', // Patrick Star — heart eyes
  'o75ajIFH0QnQC3nCeD', // Pam — shocked delight
  '26ufdipQqU2lhNA4g', // head explodes — mind blown
  '5xtDarmwsuR9sDRObyU', // The Office — conference room eruption
  '3o7TKF1fSIs1R19B8k', // Denzel — my man
  'xT5LMzIK1AdZJ4cYW4', // Homer — big-brain head tap
  'l0MYEqEzwMWFCg8rm', // Chris Pratt — hyped
  '26tPghhb310muUkEw', // Muppets — full chaos celebration
  'xT0xezQGU5xCDJuCPe', // Minions — Congratulations!
  'xTiTnqUxyWbsAXq7Ju', // Donald Duck — swimming in cash
  '3oEduOnl5IHM5NRodO', // baby — unhinged joy
  '3o6gDWzmAzrpi5DQU8', // Kim K — counting money
  'xT77XWum9yH7zNkFW0', // award-show gasp — HOW?!
  'l4pTfx2qLszoacZRS', // gnome in a mankini — victory dance
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
  'l1J9EdzfOSgfyueLm', // TV static — no signal up there
  'QW5nKIoebG8y4', // Peanuts — everyone laughing at you
  '13CoXDiaCcCoyk', // cat — silently judging
  'Vuw9m5wXviFIQ', // Rick Astley — you've been rickrolled
  'l2Je66zG6mAAZxgqI', // Homer — hits the dictionary
  '6yRVg0HWzgS88', // Simon Cowell — unimpressed
  'QMHoU66sBXqqLqYvGO', // this is fine — dog in fire
  'd2lcHJTG5Tscg', // grown man — couch sobbing
  '7SF5scGB2AFrgsXP63', // Pikachu — deflated
  '32mC2kXYWCsg0', // Jordan Peele — nervous sweat
  '3og0IPxMM0erATueVW', // dog — maximum guilt
  'l1J9u3TZfpmeDLkD6', // kid — disgusted "ew, no"
  'BBkKEBJkmFbTG', // Homer's brain — cymbal monkey
  '3oEjHAUOqG3lSS0f1C', // Muttley — wheezing snicker
  '3o7btPCcdNniyf0ArS', // math overlay — does not compute
  '3o7TKtnuHOHHUjR38Y', // brain buffering — loading spinner
  'l0IykOsxLECVejOzm', // Charlie Day — conspiracy board logic
  'l2SpZkQ0XT1XtKus0', // Colbert — stamped DENIED
  'QBd2kLB5qDmysEXre9', // Mr. Bean — still waiting for a right answer
].map(GIPHY);

export function randomVerdictGif(correct: boolean): string {
  const pool = correct ? CORRECT_GIFS : WRONG_GIFS;
  return pool[Math.floor(Math.random() * pool.length)];
}
