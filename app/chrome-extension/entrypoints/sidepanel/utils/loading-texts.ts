/**
 * Random loading texts
 * Used by the TimelineStatusStep component for playful waiting hints
 */

const loadingTexts = [
  // Internet classics
  'Should have been calm and unhurried',
  "Now it's a mad scramble",
  "I know you're in a hurry, but hold on",
  'Dog-paddling through the ocean of knowledge',
  'Let the bullet fly a little longer',
  'Hand-crafting your answer',
  'Little monsters of Langlang Mountain, assembling',
  "Don't rush me, already writing (creating new folder)",
  "Thinking so hard I'm sweating",
  'About to fry my CPU',
  // Everyday life
  'Village coffee slow-roasting, good things take time',
  'Flipping the knowledge pancake',
  'Toasting myself, almost ready',
  'Putting inspiration into the oven',
  'Letting the answer steep a little longer',
  'Loading maximum good vibes',
  'Knitting you a sweater out of words',
  // Wild imagination
  'Neurons are clubbing',
  'The catgirl is thinking',
  'Coloring in the answer',
  'Frantically flipping through the knowledge base',
  'The brain circus is now performing',
  'Squishing 0s and 1s together',
  'Charging up a big move',
  'The magnifying glass is fogging up, wiping it',
  'Trying to understand this absurd request',
  // Fantasy
  'Casting a spell, do not disturb',
  'Waking up my silicon friends',
  'Connecting to cyberspace wisdom',
  'Fellow daoist, hold on, still deducing',
  'Crossing the knowledge black hole',
  'Reverse-engineering human intent',
  'The crystal ball is blurry, giving it a tap',
  // Workplace
  'Code running faster than a reporter',
  'Your host is online, please hold',
  'Galloping over at full speed',
  'Moving knowledge at light speed',
  'Last piece of the puzzle',
  'The answer is about to wrap',
  'Launch countdown',
  'Target locking',
];

/**
 * Get a random loading text
 */
export function getRandomLoadingText(): string {
  return loadingTexts[Math.floor(Math.random() * loadingTexts.length)];
}
