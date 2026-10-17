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
    bio: 'Gold-trimmed and parade-ready, Liberty was built to stand in front of others. Heavy armour, a sure shield, and no hurry.',
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
    bio: 'A black frame with a scythe and green eyes that you only see once it has slipped your shot. Fragile, but very hard to hit.',
    traits: { health: 3, speed: 5, fireRate: 3, agility: 5 },
  },
  violet: {
    role: 'Berserker',
    origin: 'Geo-front cage, Unit 01',
    style: 'Soak it up, hit back',
    specialty: 'Tough and relentless',
    bio: 'A bio-frame that fights like it has a mind of its own. Unit Violet shrugs off hits and answers with a rifle that doesn’t stop.',
    traits: { health: 3, speed: 4, fireRate: 4, agility: 2 },
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
