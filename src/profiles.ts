import type { Traits } from './roster';

/**
 * Each unit's profile for the select screens: what kind of fighter it is, where it comes
 * from, how it plays, and its stats. Every unit spends the same 12 points across its four
 * traits (3 each is standard), so nobody is simply better, just different. 2.0 refits keep
 * their original's profile and stats.
 */
export interface Profile {
  /** the fighter class, one or two words */
  role: string;
  /** home turf or team */
  origin: string;
  /** how it plays, in a few words */
  style: string;
  /** what it's best at (follows from its traits) */
  specialty: string;
  bio: string;
  traits: Traits;
}

export const PROFILES: Record<string, Profile> = {
  angel: {
    role: 'All-rounder',
    origin: 'Orbital Deck test squadron',
    style: 'Shield up, steady fire',
    specialty: 'No weak spot',
    bio: 'The first robot ever built, and the one all others are compared to. Seraph does everything well and nothing badly.',
    traits: { health: 3, speed: 4, fireRate: 3, agility: 4 },
  },
  dragon: {
    role: 'Brawler',
    origin: 'Lava Forge pit circuit',
    style: 'Close in, keep firing',
    specialty: 'Fast trigger',
    bio: 'Five dino machines locked into one. Wyvern blasts from its fist, keeps its power sword ready and never lets the trigger rest.',
    traits: { health: 5, speed: 2, fireRate: 2, agility: 1 },
  },
  pioneer: {
    role: 'Scout',
    origin: 'Frontier survey corps',
    style: 'Hit and reposition',
    specialty: 'Quick on the rail',
    bio: 'The League’s police robot. Light armour, but Pioneer slides out of a shot before the marble lands.',
    traits: { health: 3, speed: 5, fireRate: 3, agility: 5 },
  },
  liberty: {
    role: 'Guardian',
    origin: 'Island Beach honour guard',
    style: 'Hold the line',
    specialty: 'Takes a beating',
    bio: 'Teal-plated and parade-ready, Liberty was built to stand in front of others. Heavy armour, a sure shield, and no hurry.',
    traits: { health: 5, speed: 1, fireRate: 3, agility: 1 },
  },
  monoceros: {
    role: 'Striker',
    origin: 'Neo City prototype lab',
    style: 'Pressure from range',
    specialty: 'Sustained fire',
    bio: 'A giant thinking head with two cannons on its shoulders. Mandrill keeps up a heavy stream of shots and never stops talking.',
    traits: { health: 3, speed: 1, fireRate: 3, agility: 1 },
  },
  baron: {
    role: 'Ace',
    origin: 'Red squadron, rail racing league',
    style: 'Outrun every shot',
    specialty: 'Top speed',
    bio: 'A red flying robot that wins on speed alone. Crimson Baron moves three times faster than anyone, but it can’t take many hits.',
    traits: { health: 2, speed: 2, fireRate: 5, agility: 2 },
  },
  bastion: {
    role: 'Heavy gunner',
    origin: 'Snowfield fortress line',
    style: 'Plant and unload',
    specialty: 'Highest fire rate',
    bio: 'A walking gun emplacement with a gatling on its arm. Bastion barely moves, and it doesn’t have to.',
    traits: { health: 3, speed: 1, fireRate: 4, agility: 1 },
  },
  nightshade: {
    role: 'Assassin',
    origin: 'Night Forest',
    style: 'Dodge, then strike',
    specialty: 'Best dodger',
    bio: 'A plum robot with a scythe and pink eyes. You only see Nightshade once it has slipped your shot. Fragile, but very hard to hit.',
    traits: { health: 3, speed: 5, fireRate: 3, agility: 5 },
  },
  violet: {
    role: 'Berserker',
    origin: 'Geo-front cage, Unit 01',
    style: 'Soak it up, hit back',
    specialty: 'Tough and relentless',
    bio: 'A towering silverback that shrugs off hits and answers with palm blasters that don’t stop.',
    traits: { health: 5, speed: 2, fireRate: 4, agility: 2 },
  },
  kabuto: {
    role: 'Gunslinger',
    origin: 'Robattle street league',
    style: 'Fast draw, quick feet',
    specialty: 'Quick arm gun',
    bio: 'A lion on a floating throne with a gun on each arm. Leo King lives for the quick draw.',
    traits: { health: 3, speed: 2, fireRate: 4, agility: 4 },
  },
  tyrant: {
    role: 'Warlord',
    origin: 'Fallen empire',
    style: 'Walk through fire',
    specialty: 'Most armour',
    bio: 'A cruel robot with a wolf’s head on each fist and a tail it swings like a blade. Tyrant King is the hardest fighter to bring down.',
    traits: { health: 5, speed: 1, fireRate: 2, agility: 1 },
  },
  rex: {
    role: 'Juggernaut',
    origin: 'Desert badlands',
    style: 'Stomp forward',
    specialty: 'Heavy and steady',
    bio: 'A war machine shaped like a tyrannosaur, marbles roaring from its jaws. Rex Saur is armoured like a tank and still keeps pace.',
    traits: { health: 4, speed: 4, fireRate: 2, agility: 1 },
  },
  liger: {
    role: 'Hunter',
    origin: 'Highland plains',
    style: 'Circle and pounce',
    specialty: 'Fastest beast',
    bio: 'A black-and-gold robot hound. Fang Hound never stops moving and picks the moment to fire.',
    traits: { health: 3, speed: 5, fireRate: 3, agility: 4 },
  },
  ember: {
    role: 'Hothead',
    origin: 'Volcano nest',
    style: 'Spray and pray',
    specialty: 'Highest fire rate',
    bio: 'A little peach-orange axolotl with a big temper. Blossom spits marbles faster than anything its size.',
    traits: { health: 3, speed: 3, fireRate: 5, agility: 2 },
  },
};

/** a unit's profile: its own, or its original's for a 2.0 refit or a custom unit */
const strip = (id?: string) => id?.replace(/-2?1?$/, '').replace(/-2$/, '');
export const profileOf = (id: string, from?: string, base?: string) => PROFILES[id] ?? (from ? PROFILES[strip(from)!] : undefined) ?? (base ? PROFILES[strip(base)!] : undefined);

/**
 * Who each fighter is: a personality, a line they'd say, their story in the Marble League,
 * and the one they most want to beat. The League: since the old wars, machines settle
 * everything on the rail, across nine arenas; the arcade ladder climbs the Spire, where
 * Nightshade waits at the top.
 */
export interface Story {
  personality: string;
  quote: string;
  story: string;
  /** base id of their rival */
  rival: string;
}

export const STORIES: Record<string, Story> = {
  angel: {
    personality: 'Calm, disciplined, quietly proud',
    quote: 'Every robot since was measured against me.',
    story:
      'The first robot ever built, the one every robot after it is compared to. Its makers wiped its memory, so Seraph fights to learn what it was built for. It thinks the answer is at the top of the Spire, the giant tower at the top of the League.',
    rival: 'nightshade',
  },
  dragon: {
    personality: 'Loud, loyal, hot-headed',
    quote: 'Five engines, one grudge.',
    story:
      'The Lava Forge pit crews welded Wyvern together from five scrapped dino machines, and every part still remembers its old owner. When Tyrant King burned the Forge down, Wyvern swore the crews would get their name back on the board. It never stops firing, and it never lets go of a grudge.',
    rival: 'tyrant',
  },
  pioneer: {
    personality: 'By the book, fast-talking, never off duty',
    quote: 'Pull over. That marble is unlicensed.',
    story:
      'The League’s police robot, a patrol car that stands up to fight. Pioneer chases rule-breakers from arena to arena and reads them their rights mid-fight. Top of its wanted list: Crimson Baron, a flying smuggler.',
    rival: 'baron',
  },
  liberty: {
    personality: 'Stubborn, patient, honourable',
    quote: 'I don’t move. You do.',
    story:
      'A deep-sea diver robot that became the guard of Island Beach, rolling on heavy treads. Liberty once sank the lab that built Mandrill, and Mandrill has never forgiven it. It holds the line, lines up the long shot, and waits.',
    rival: 'monoceros',
  },
  monoceros: {
    personality: 'Brilliant, vain, theatrical',
    quote: 'I am the smartest thing in this arena. Possibly in any arena.',
    story:
      'A Neo City lab experiment that went too far: a giant thinking head with two cannons and little legs. Mandrill escaped when Liberty flooded its lab, and it has been planning revenge, out loud and at length, ever since.',
    rival: 'liberty',
  },
  baron: {
    personality: 'Charming, cocky, a showman',
    quote: 'Smile for the crowd, Pioneer!',
    story:
      'Banned from flying by the League, Crimson Baron smuggles rare marbles between arenas and plays to the crowd while it does. Its drum gun never seems to run dry. Pioneer has chased it through every arena and has never quite caught it.',
    rival: 'pioneer',
  },
  bastion: {
    personality: 'Silent, patient, predatory',
    quote: '…',
    story:
      'Nobody knows who built this mantis robot of the Rainy Forest, or if anyone did. Bastion waits without a sound until both scythes strike at once. In the arcade it is the first boss of the Spire. Only Silverback has ever stood its ground.',
    rival: 'violet',
  },
  nightshade: {
    personality: 'Cold, elegant, unknowable',
    quote: 'You climbed all this way to meet yourself.',
    story:
      'The second robot ever built, Seraph’s twin, taken before it was finished. Nightshade floats on a single tail at the top of the Spire, the final boss of the arcade, and it knows what Seraph has forgotten. It is waiting for Seraph to climb.',
    rival: 'angel',
  },
  violet: {
    personality: 'A gentle giant, until provoked',
    quote: 'Stand behind me.',
    story:
      'A giant ape robot built at the Snowfield to protect the survey bots, the tiny scout robots. Silverback is slow to anger and almost impossible to stop once it is angry, and its palm blasters fire left, right, left. It is the only one Bastion has never got past.',
    rival: 'bastion',
  },
  kabuto: {
    personality: 'Vain, scheming, all crown and no king',
    quote: 'A crown belongs to whoever is wearing it.',
    story:
      'Leo King is a fake. Three seasons ago it took the floating palace in one night while True Leo King was away, and it has sold keystones, the stones that keep the arena gates working, to Tyrant King ever since. It let the Lava Forge burn for gold, and its guard Fang Hound walked out. True Leo King is coming home.',
    rival: 'trueleo',
  },
  trueleo: {
    personality: 'Quiet, stubborn, rightful',
    quote: 'I left the crown once. I will not leave the kingdom twice.',
    story:
      'The real ruler of the League. It left the palace to renew the treaty, the old peace deal that ended the wars, and came home to find a fake, Leo King, wearing its crown and its face. Driven out for three seasons, it now wants its kingdom back, and every sold keystone put back in its gate.',
    rival: 'kabuto',
  },
  tyrant: {
    personality: 'Ruthless, ambitious, never satisfied',
    quote: 'Every arena will have my name on the gate.',
    story:
      'A black robot that wants to own the League, with a wolf’s head snarling on each fist. Tyrant King burned the Lava Forge to take its pits, and it teams up with Rex Saur when it needs the muscle. Wyvern is the one fighter it underestimated.',
    rival: 'dragon',
  },
  rex: {
    personality: 'Grumpy, tough, old-school',
    quote: 'Back in my day we bit things.',
    story:
      'Thawed out of the Snowfield ice still running, Rex Saur thinks every new robot is too soft and too shiny. It bites first and asks later. It rides with Tyrant King for the fights, not the plans, and it cannot stand cheerful little Blossom.',
    rival: 'ember',
  },
  liger: {
    personality: 'Fierce, loyal, restless',
    quote: 'I left the crown to earn my own.',
    story:
      'Once the royal guard of True Leo King, Fang Hound walked out of the palace the night the fake, Leo King, took the throne, and set out to prove it could win alone. It fires from its flanks, left then right, and its shots bounce where you least expect. It has never knelt to Leo King, and never will.',
    rival: 'kabuto',
  },
  ember: {
    personality: 'Cheerful, curious, a little chaotic',
    quote: 'Ooh, what does THIS button do?',
    story:
      'The smallest fighter in the League, a peach-orange axolotl hatched in the hot springs under the Lava Forge. Its head never stops turning to look at everything. Blossom is everyone’s favourite underdog, except Rex Saur’s. Its marbles go wherever it happens to be looking.',
    rival: 'rex',
  },
};

const baseKey = (id?: string) => id?.replace(/-\d+$/, '') ?? '';
export const storyOf = (id: string, from?: string, base?: string) => STORIES[baseKey(id)] ?? STORIES[baseKey(from)] ?? STORIES[baseKey(base)];
