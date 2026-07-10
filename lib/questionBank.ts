// Fisher-Yates; used to show each player the bank in a different order
// so a big group doesn't all gravitate to the same top options.
export function shuffled<T>(items: T[]): T[] {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

// Preset question options per knowability level, phrased in the
// submitter's voice ("I/my") so they read correctly on the host board.
export const QUESTION_BANK: Record<1 | 2 | 3 | 4 | 5, string[]> = {
  1: [
    'What city do I live in?',
    'What do I do for work?',
    'How many siblings do I have?',
    'What kind of pet do I have (if any)?',
    'Where did I grow up?',
    'What month is my birthday?',
    'What car do I drive?',
    'What team or sport am I obsessed with?',
    'What is my go-to drink order?',
    'What is my favorite food?',
    'What phone do I use — iPhone or Android?',
    'Am I a morning person or a night owl?',
  ],
  2: [
    'Where did I go to school?',
    'What was my first job?',
    'What is my favorite movie of all time?',
    'Where did I go on my last vacation?',
    'What is my biggest pet peeve?',
    'What is my favorite band or artist?',
    'What is my usual coffee order?',
    'What is my go-to weekend activity?',
    'How did I meet my best friend in this room?',
    'What food could I eat every single day?',
    'What show am I currently bingeing?',
    'What is my most-used app besides messaging?',
  ],
  3: [
    'What is my middle name?',
    'What was the name of my first pet?',
    'What was my first car?',
    'What country have I always wanted to visit?',
    'What is my go-to karaoke song?',
    'What food do I secretly hate?',
    'What am I weirdly good at?',
    'What was my college major (or dream one)?',
    'What is my hidden talent?',
    'What is the best concert I have ever been to?',
    'What was my first screen name or gamertag?',
    'What is one thing always in my fridge?',
  ],
  4: [
    'What was my childhood nickname?',
    'What was the name of my childhood best friend?',
    'What did I collect as a kid?',
    'What poster was on my childhood bedroom wall?',
    'What is my irrational fear?',
    'What TV show have I rewatched the most?',
    'What is the weirdest job I have ever had?',
    'What food combination do I love that others find gross?',
    'What is the most embarrassing thing that happened to me at school?',
    'What is the strangest thing in my search history this week?',
    'What movie makes me cry every single time?',
    'What was my worst fashion phase?',
  ],
  5: [
    'What did I want to be when I was 7 years old?',
    'What was the name of my imaginary friend or favorite stuffed animal?',
    'What is a secret talent I have never shown this group?',
    'What is the most trouble I ever got into with my parents?',
    'What is my guilty-pleasure song I would never admit to?',
    'What celebrity have I actually met in real life?',
    'What is the weirdest thing I have ever eaten?',
    'What recurring dream do I keep having?',
    'What is something I have never told most people in this room?',
    'What did my childhood diary (or first email address) reveal about me?',
    'What is the biggest lie I ever told my parents that I got away with?',
    'What embarrassing thing am I banned from living down by my family?',
  ],
};
