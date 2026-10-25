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
    bio: 'The first frame off the line and the yardstick every other unit is measured against. Seraph Zero does everything well and nothing badly.',
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
    bio: 'A survey frame that learned to fight. Light plating, but it slides along the rail and out of a shot before the marble lands.',
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
    bio: 'A one-horned prototype whose frame glows red when it runs hot. Monoceros keeps up a heavy stream of shots from behind its big shoulders.',
    traits: { health: 3, speed: 1, fireRate: 3, agility: 1 },
  },
  baron: {
    role: 'Ace',
    origin: 'Red squadron, rail racing league',
    style: 'Outrun every shot',
    specialty: 'Top speed',
    bio: 'The red mono-eye ace who wins on speed alone. Crimson Baron covers the rail three times faster than anyone, but it can’t take many hits.',
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
    bio: 'A plum frame with a scythe and pink eyes that you only see once it has slipped your shot. Fragile, but very hard to hit.',
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
    bio: 'A beetle-type street fighter with launchers on its head and a gun on each arm. Kabuto Bee lives for the quick draw.',
    traits: { health: 3, speed: 2, fireRate: 4, agility: 4 },
  },
  tyrant: {
    role: 'Warlord',
    origin: 'Fallen empire',
    style: 'Walk through fire',
    specialty: 'Most armour',
    bio: 'The would-be king with a T-rex head on his fist and a tail he swings like a blade. Tyrant King is the hardest unit to bring down.',
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
    bio: 'A great blue cat frame with golden fangs. Fang Liger never stops moving and picks the moment to fire.',
    traits: { health: 3, speed: 5, fireRate: 3, agility: 4 },
  },
  ember: {
    role: 'Hothead',
    origin: 'Volcano nest',
    style: 'Spray and pray',
    specialty: 'Highest fire rate',
    bio: 'A little fire lizard with a flame on its tail and a temper to match. Ember Lizard spits marbles faster than anything its size.',
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
    quote: 'Every frame since was measured against me.',
    story:
      'The first unit off the Orbital Deck line, built to be the yardstick for every machine after it. Its makers wiped its memory before the League began, so Seraph Zero fights to learn what it was really built for. The answer, it suspects, is at the top of the Spire.',
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
      'Neo City’s League marshal, a patrol car that stands up to fight. Pioneer chases rule-breakers from arena to arena and tosses its blaster from hand to hand while it reads them their rights. Top of its wanted list: the smuggler ace Crimson Baron.',
    rival: 'baron',
  },
  liberty: {
    personality: 'Stubborn, patient, honourable',
    quote: 'I don’t move. You do.',
    story:
      'A deep-sea salvage diver that became Island Beach’s honour guard, rolling on treads taken off a sea-floor crawler. Liberty once sank the lab that built Mandrill, and the giant head has never forgiven it. It holds the line, lines up the long shot, and waits.',
    rival: 'monoceros',
  },
  monoceros: {
    personality: 'Brilliant, vain, theatrical',
    quote: 'I am the smartest thing on this rail. Possibly on any rail.',
    story:
      'A Neo City lab experiment that went too far: a giant thinking head with two cannons bolted over its shoulders and little legs to carry it. Mandrill escaped when Liberty flooded its lab, and it has been planning its revenge, out loud and at length, ever since.',
    rival: 'liberty',
  },
  baron: {
    personality: 'Charming, cocky, a showman',
    quote: 'Smile for the crowd, marshal!',
    story:
      'A flying ace grounded by the League, the Crimson Baron runs rare marbles between arenas and plays to the crowd while it does. Its drum gun never seems to run dry. Pioneer has chased it through every city on the circuit and has never quite caught it.',
    rival: 'pioneer',
  },
  bastion: {
    personality: 'Silent, patient, predatory',
    quote: '…',
    story:
      'Nobody knows who built the mantis walker of the Rainy Forest, or whether anyone did. Bastion waits without a sound until both scythes strike at once, and the marble forms where they cross. Arcade climbers meet it as the first boss of the Spire. Only Unit Violet has ever stood its ground.',
    rival: 'violet',
  },
  nightshade: {
    personality: 'Cold, elegant, unknowable',
    quote: 'You climbed all this way to meet yourself.',
    story:
      'The second prototype from the Orbital Deck line, Seraph Zero’s twin, taken before it was finished. Nightshade drifts on a single floating tail at the top of the Spire, the final boss of the arcade, and it knows what Seraph Zero has forgotten. It has been waiting for its sibling to climb.',
    rival: 'angel',
  },
  violet: {
    personality: 'A gentle giant, until provoked',
    quote: 'Stand behind me.',
    story:
      'A silverback guardian built at the Snowfield research base to protect the little survey bots. Unit Violet is slow to anger and almost impossible to stop once it is angry, and its palm blasters fire left, right, left. It is the only one Bastion has never got past, and it travels as a trio when it has to.',
    rival: 'bastion',
  },
  kabuto: {
    personality: 'Regal, generous, a born leader',
    quote: 'A crown is earned every season.',
    story:
      'The lion king of the League, Leo King defends its title every season, fist cannons blazing and its royal cape snapping. It rules fairly and fights fairly. The one thing it cannot forgive is Fang Liger, the guard who left its side to prove itself alone.',
    rival: 'liger',
  },
  tyrant: {
    personality: 'Ruthless, ambitious, never satisfied',
    quote: 'Every arena will have my name on the gate.',
    story:
      'A hellhound that wants to own the League outright, with a wolf’s head snarling on each fist. Tyrant King burned the Lava Forge to take its pits, and it teams up with Rex Saur as the Dino Kings when it needs the muscle. Wyvern is the one fighter it underestimated.',
    rival: 'dragon',
  },
  rex: {
    personality: 'Grumpy, tough, old-school',
    quote: 'Back in my day we bit things.',
    story:
      'Thawed out of the Snowfield glacier still running, Rex Saur thinks every new machine is too soft and too shiny. It bites first and asks later, its orange plates bristling down its sky-blue back. It rides with Tyrant King for the fights, not the plans, and it cannot stand that cheerful little Blossom.',
    rival: 'ember',
  },
  liger: {
    personality: 'Fierce, loyal, restless',
    quote: 'I left the crown to earn my own.',
    story:
      'Once the royal guard of Leo King, Fang Liger walked out of the palace to prove it could win alone. The black-and-gold war hound fires from its flanks, left then right, and its shots ricochet where you least expect. It still respects the King, but it won’t say so.',
    rival: 'kabuto',
  },
  ember: {
    personality: 'Cheerful, curious, a little chaotic',
    quote: 'Ooh, what does THIS button do?',
    story:
      'The smallest fighter in the League a pink axolotl hatched in the hot springs under the Lava Forge, and its head never stops turning to look at everything. Blossom is everyone’s favourite underdog, except Rex Saur’s. Its marbles go wherever its head happens to be looking, and that’s usually somewhere surprising.',
    rival: 'rex',
  },
};

const baseKey = (id?: string) => id?.replace(/-\d+$/, '') ?? '';
export const storyOf = (id: string, from?: string, base?: string) => STORIES[baseKey(id)] ?? STORIES[baseKey(from)] ?? STORIES[baseKey(base)];
