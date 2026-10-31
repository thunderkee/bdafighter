import type { AddonSlot, Fit, PartSpec } from './addons';
import type { CharacterDef } from './robot';

/**
 * Each fighter's own wardrobe: three head pieces, three back pieces, three shoulder pieces and
 * three paint jobs, made for that fighter alone (its theme, its colours). Nothing is shared
 * across the roster. A fighter not listed here (a custom unit) has none.
 */
export interface KitPart extends PartSpec {
  id: string;
  name: string;
}
export interface KitPaint {
  id: string;
  name: string;
  palette: Partial<CharacterDef['palette']>;
}
export type Kit = Record<AddonSlot, KitPart[]> & { paint: KitPaint[] };

const P = (id: string, name: string, shape: string, a?: number, b?: number): KitPart => ({ id, name, shape, a, b });
/** a paint job: body, trim, accent, joints, eyes (the wings follow the body and trim) */
const paint = (id: string, name: string, body: number, trim: number, accent: number, joint: number, eye: number): KitPaint => ({
  id,
  name,
  palette: { body, trim, accent, joint, eye, wing: body, wingTip: trim },
});

export const KITS: Record<string, Kit> = {
  // Seraph Zero: a sword angel
  angel: {
    hat: [P('halo', 'Seraph Halo', 'halo', 0xfff2a8), P('vfin', 'Gold V-Fin', 'vfin', 0xe8b43a, 0x24305e), P('star', 'Guiding Star', 'star', 0x8ae8ff, 0xdfe6ee)],
    back: [P('feathers', 'Angel Wings', 'feathers', 0xf4f3ef, 0xb8d8ff), P('swords', 'Twin Excalibur', 'swords', 0xdfe6ee, 0xe8b43a), P('thrusters', 'Light Ring', 'thrusters', 0x8ae8ff, 0x24305e)],
    shoulder: [P('blade', 'Sword Guards', 'blade', 0xdfe6ee, 0x24305e), P('orb', 'Holy Orbs', 'orb', 0xfff2a8, 0xe8b43a), P('epaulette', 'Knight Epaulettes', 'epaulette', 0xe8b43a, 0xe8312f)],
    paint: [paint('dawn', 'Dawn Knight', 0xfff6e0, 0xe8b43a, 0xff8a4a, 0x5a4a3a, 0x7affb0), paint('azure', 'Azure Frame', 0x4aa8f0, 0xf4f3ef, 0xe8b43a, 0x1f2a4a, 0xffffff), paint('fallen', 'Fallen Seraph', 0x2a2734, 0xc8323a, 0xb8bfcc, 0x14121a, 0xff3a4a)],
  },
  // Wyvern: the red dragon combiner
  dragon: {
    hat: [P('horns', 'Dragon Horns', 'horns', 0xf2ead8), P('crown', 'Dragon Crown', 'crown', 0xe8b43a, 0x3aff6a), P('spikering', 'Fang Ring', 'spikering', 0xf2ead8, 0x3a3c44)],
    back: [P('wings', 'Wyvern Wings', 'wings', 0xc8202a, 0xf2b632), P('spines', 'Dragon Spines', 'spines', 0xf2b632, 0xc8202a), P('thrusters', 'Fire Core', 'thrusters', 0xff7a1a, 0x3a3c44)],
    shoulder: [P('flames', 'Dragon Flames', 'flames', 0xff7a1a, 0xffd23e), P('claw', 'Talon Guards', 'claw', 0xf2ead8, 0x3a3c44), P('spikes', 'Scale Spikes', 'spikes', 0xf2b632)],
    paint: [paint('jade', 'Jade Dragon', 0x2a9a5a, 0x1e1e24, 0xf2b632, 0x1a2a20, 0xffe14d), paint('obsidian', 'Obsidian', 0x24222a, 0xc8202a, 0xff7a1a, 0x101014, 0xff3a1a), paint('gold', 'Golden Wyvern', 0xe8b43a, 0x5a2a10, 0xc8202a, 0x3a2410, 0x7affb0)],
  },
  // Pioneer: the police robot
  pioneer: {
    hat: [P('siren', 'Light Bar', 'siren'), P('cap', 'Chief Cap', 'cap', 0x1f2a5a, 0xe8b43a), P('beacon', 'Rooftop Beacon', 'beacon', 0xff3a3a, 0x1f1c2a)],
    back: [P('jetpack', 'Pursuit Boosters', 'jetpack', 0x2f5fe0, 0x1f1c2a), P('missiles', 'Riot Launchers', 'missiles', 0xff8a1a, 0x1f1c2a), P('backpack', 'Radio Pack', 'backpack', 0x2f5fe0, 0x3a3c44)],
    shoulder: [P('wheel', 'Hubcap Wheels', 'wheel', 0xdfe6ee), P('disc', 'Badge Shields', 'disc', 0xe8b43a, 0x2f5fe0), P('gun', 'Patrol Guns', 'gun', 0x1f1c2a, 0x3a3c44)],
    paint: [paint('swat', 'SWAT Black', 0x2a2c34, 0x14141a, 0x5ad0ff, 0x1a1a20, 0x5af0ff), paint('highway', 'Highway Patrol', 0xf4c25b, 0x1f1c2a, 0x2f5fe0, 0x2a2420, 0x7ff0ff), paint('interceptor', 'Interceptor Red', 0xe8312f, 0xf4f3ef, 0x1f1c2a, 0x2a1418, 0xffffff)],
  },
  // Liberty: the plume-helmed sniper on treads
  liberty: {
    hat: [P('plume', 'Knight Plume', 'plume', 0xf2ead8, 0xee5466), P('goggles', 'Scope Goggles', 'goggles', 0x7affb0, 0x22b8a8), P('antenna', 'Rangefinder', 'antenna', 0xff3a3a, 0x1f1c2a)],
    back: [P('cannon', 'Long Rifle', 'cannon', 0x3a3c44, 0x22b8a8), P('banner', 'Liberty Banner', 'banner', 0xf4c25b, 0x22b8a8), P('tanks', 'Coolant Tanks', 'tanks', 0xf2ead8, 0x3a3c44)],
    shoulder: [P('pads', 'Tower Pads', 'pads', 0xf4c25b, 0x22b8a8), P('disc', 'Buckler', 'disc', 0x22b8a8, 0xf4c25b), P('gem', 'Lens Gems', 'gem', 0x7affb0, 0x3a3c44)],
    paint: [paint('bronze', 'Statue Bronze', 0xb8763a, 0x3a2a1a, 0x7affb0, 0x2a1e14, 0xffd23e), paint('patina', 'Old Patina', 0x7ad0b8, 0x2a4a44, 0xf2ead8, 0x1e2a28, 0xff8a4a), paint('desert', 'Desert Ops', 0xd8c49a, 0x5a6a3a, 0xe8762a, 0x3a3428, 0x7ff0ff)],
  },
  // Mandrill: a giant ape head with shell cannons
  monoceros: {
    hat: [P('unihorn', 'Unicorn Horn', 'unihorn', 0xf4c25b, 0xee5466), P('crown', 'Jungle Crown', 'crown', 0xf4c25b, 0x3aff6a), P('sprout', 'Banana Leaf', 'sprout', 0x5ad05a, 0x5a3a1a)],
    back: [P('shell', 'Turtle Shell', 'shell', 0x7a5a3a, 0xf4c25b), P('tanks', 'Water Tanks', 'tanks', 0x5a7ab8, 0x1f1c2a), P('cannon', 'Hydro Cannon', 'cannon', 0x5a7ab8, 0xee5466)],
    shoulder: [P('gun', 'Spout Guns', 'gun', 0xb8bfcc, 0x5a7ab8), P('pads', 'Bark Pads', 'pads', 0xee5466, 0x5a3a1a), P('leaves', 'Palm Fronds', 'leaves', 0x5ad05a, 0x3aa04a)],
    paint: [paint('tide', 'High Tide', 0x2a8ac8, 0xf2ead8, 0x8ae8ff, 0x1a2a3a, 0xffd84a), paint('baboon', 'Baboon Red', 0xc8503a, 0x4a7ad8, 0xf4c25b, 0x2a1a14, 0xffffff), paint('silver', 'Silverback', 0x5a5a64, 0xb8bfcc, 0xee5466, 0x1f1c22, 0xffd84a)],
  },
  // Crimson Baron: the flying ace
  baron: {
    hat: [P('goggles', 'Flying Goggles', 'goggles', 0xffd84a, 0x5a3a2a), P('cap', 'Ace Cap', 'cap', 0x2a2734, 0xe8b43a), P('plume', 'Victory Plume', 'plume', 0xf2ead8, 0xc8323a)],
    back: [P('rotor', 'Propeller', 'rotor', 0x8a5a3a, 0x2a2734), P('wings', 'Biplane Wings', 'wings', 0xc8323a, 0xf2ead8), P('banner', 'Squadron Flag', 'banner', 0xc8323a, 0xf2ead8)],
    shoulder: [P('gun', 'Wing Guns', 'gun', 0x2a2734, 0x3a3c44), P('epaulette', 'Ace Epaulettes', 'epaulette', 0xe8b43a, 0xc8323a), P('rockets', 'Rocket Pods', 'rockets', 0xf4c25b, 0x2a2734)],
    paint: [paint('bluemax', 'Blue Max', 0x2a5ac8, 0xf2ead8, 0xf4c25b, 0x1a2234, 0xffd84a), paint('camo', 'Field Camo', 0x6a7a3a, 0x3a3a24, 0xf2ead8, 0x24261a, 0xff8a3a), paint('checker', 'Checker Ace', 0xf2ead8, 0x1f1c2a, 0xc8323a, 0x2a2734, 0x5af0ff)],
  },
  // Bastion: the leaf-green mantis
  bastion: {
    hat: [P('feelers', 'Mantis Feelers', 'feelers', 0xf4c25b, 0x3fae5a), P('sprout', 'Leaf Sprout', 'sprout', 0x8ad83a, 0x3fae5a), P('spikering', 'Thorn Ring', 'spikering', 0xf2ead8, 0x3a5a2a)],
    back: [P('petals', 'Leaf Fan', 'petals', 0x8ad83a, 0x3fae5a), P('swords', 'Scythe Pair', 'swords', 0xdfe6ee, 0x3fae5a), P('spines', 'Thorn Ridge', 'spines', 0x3fae5a, 0xf4c25b)],
    shoulder: [P('leaves', 'Leaf Guards', 'leaves', 0x8ad83a, 0x3fae5a), P('blade', 'Scythe Fins', 'blade', 0xdfe6ee, 0x3fae5a), P('claw', 'Hook Claws', 'claw', 0xf4c25b, 0x3a5a2a)],
    paint: [paint('orchid', 'Orchid Mantis', 0xf2b8d8, 0xffffff, 0xee5466, 0x5a3a4a, 0x7affb0), paint('autumn', 'Autumn Leaf', 0xe8762a, 0x8a3a14, 0xf4c25b, 0x3a2010, 0x7affb0), paint('jungle', 'Deep Jungle', 0x2a6a3a, 0x14301a, 0xf4c25b, 0x10180e, 0xff5a3a)],
  },
  // Nightshade: the hooded wisp
  nightshade: {
    hat: [P('hood', 'Shadow Hood', 'hood', 0x3e2a6a, 0xff6a9a), P('horns', 'Imp Horns', 'horns', 0x1f1c2a), P('halo', 'Dark Halo', 'halo', 0xff3a4a)],
    back: [P('moonring', 'Moon Ring', 'thrusters', 0xff6a9a, 0x1f1c2a), P('crystals', 'Soul Shards', 'crystals', 0xff6a9a, 0xb07aff), P('feathers', 'Raven Wings', 'feathers', 0x24222a, 0x3e2a6a)],
    shoulder: [P('orb', 'Wisp Orbs', 'orb', 0xff6a9a, 0x1f1c2a), P('flames', 'Ghost Fire', 'flames', 0xb07aff, 0xff6a9a), P('spikes', 'Bone Spikes', 'spikes', 0xf2ead8)],
    paint: [paint('moon', 'Moonlit', 0xb8c8e8, 0x2a3458, 0x8ae8ff, 0x1a2034, 0xffffff), paint('crimson', 'Crimson Shade', 0x6a1a2a, 0x1f1c2a, 0xffd84a, 0x140a10, 0xffd84a), paint('void', 'Void', 0x14121a, 0x3a3448, 0x5af0ff, 0x08080c, 0x5af0ff)],
  },
  // Unit Violet: the silverback gorilla
  violet: {
    hat: [P('crown', 'Kong Crown', 'crown', 0xe8b43a, 0xee5466), P('horns', 'Demon Horns', 'horns', 0xb8bfcc), P('spikering', 'Brawler Ring', 'spikering', 0xb8bfcc, 0x1f1c2a)],
    back: [P('spines', 'Silver Ridge', 'spines', 0xb8bfcc, 0x4a2f9a), P('thrusters', 'Rage Core', 'thrusters', 0xff3a1a, 0x1f1c2a), P('banner', 'Jungle Banner', 'banner', 0xee5466, 0x4a2f9a)],
    shoulder: [P('pads', 'Boulder Pads', 'pads', 0xb8bfcc, 0x4a2f9a), P('spikes', 'Iron Spikes', 'spikes', 0xb8bfcc), P('flames', 'Rage Flames', 'flames', 0xff3a1a, 0xffb02e)],
    paint: [paint('volcano', 'Volcano', 0x2a1a1a, 0xff5a1a, 0xffd23e, 0x140a0a, 0xffd23e), paint('yeti', 'Yeti', 0xeaf2ff, 0x8aa8c8, 0x5ad0ff, 0x3a4a5a, 0x3a7aff), paint('emerald', 'Emerald Ape', 0x1e6a4a, 0xb8bfcc, 0xffd84a, 0x10241a, 0xff3a2a)],
  },
  // Leo King: the royal lion
  kabuto: {
    hat: [P('crown', 'Lion Crown', 'crown', 0xe8b43a, 0xee5466), P('mane', 'Royal Mane', 'mane', 0xe8b43a, 0xc8762a), P('ears', 'Lion Ears', 'ears', 0xee5466, 0xe8b43a)],
    back: [P('cape', 'King\'s Cape', 'cape', 0x8a1a2a, 0xe8b43a), P('banner', 'Royal Standard', 'banner', 0xe8b43a, 0xee5466), P('wings', 'Griffin Wings', 'wings', 0xe8b43a, 0xf2ead8)],
    shoulder: [P('epaulette', 'Royal Epaulettes', 'epaulette', 0xe8b43a, 0xee5466), P('gem', 'Crown Jewels', 'gem', 0xff3a5a, 0xe8b43a), P('claw', 'Lion Claws', 'claw', 0xf2ead8, 0xee5466)],
    paint: [paint('snow', 'Snow Lion', 0xf4f3ef, 0x8aa8c8, 0xe8b43a, 0x3a4a5a, 0x5af0ff), paint('shadow', 'Shadow King', 0x2a2734, 0xe8b43a, 0xc8323a, 0x14121a, 0xff3a2a), paint('savanna', 'Savanna', 0xd8a85a, 0x6a3a1a, 0xf2ead8, 0x2a1a10, 0x7affb0)],
  },
  // Tyrant King: the three-headed hellhound
  tyrant: {
    hat: [P('horns', 'Hellhorns', 'horns', 0xc8323a), P('spikering', 'Chain Collar', 'spikering', 0xb8bfcc, 0x1f1c2a), P('crown', 'Tyrant Crown', 'crown', 0x2a2734, 0xff3a1a)],
    back: [P('spines', 'Hellspines', 'spines', 0xc8323a, 0x24305e), P('saw', 'Buzzsaw', 'saw', 0xb8bfcc, 0xc8323a), P('thrusters', 'Inferno Ring', 'thrusters', 0xff3a1a, 0x24305e)],
    shoulder: [P('spikes', 'Spiked Pauldrons', 'spikes', 0xb8bfcc), P('flames', 'Hellfire', 'flames', 0xff3a1a, 0xffb02e), P('claw', 'Rending Claws', 'claw', 0xf2ead8, 0x24305e)],
    paint: [paint('brimstone', 'Brimstone', 0x3a1a14, 0xff5a1a, 0xffd23e, 0x140806, 0xffd23e), paint('ghost', 'Ghost Hound', 0xc8d8e8, 0x24305e, 0x5af0ff, 0x2a3448, 0x5af0ff), paint('bone', 'Bone King', 0xf2ead8, 0x2a2734, 0xc8323a, 0x3a342a, 0xff3a2a)],
  },
  // Rex Saur: the sky-blue dinosaur
  rex: {
    hat: [P('icecrown', 'Ice Crown', 'icecrown', 0x8ae8ff, 0x24305e), P('spikering', 'Frill Spikes', 'spikering', 0xee7b4c, 0x24305e), P('horns', 'Tri Horns', 'horns', 0xf2ead8)],
    back: [P('spines', 'Stego Plates', 'spines', 0xee7b4c, 0x24305e), P('crystals', 'Glacier Shards', 'crystals', 0x8ae8ff, 0xd8f4ff), P('cannon', 'Freeze Cannon', 'cannon', 0x24305e, 0x8ae8ff)],
    shoulder: [P('shards', 'Frost Shards', 'shards', 0x8ae8ff, 0xd8f4ff), P('claw', 'Raptor Claws', 'claw', 0xf2ead8, 0x24305e), P('pads', 'Fossil Pads', 'pads', 0xf2ead8, 0xee7b4c)],
    paint: [paint('fossil', 'Fossil', 0xd8c8a8, 0x6a5a4a, 0xee7b4c, 0x2a2420, 0x5af0ff), paint('glacier', 'Glacier', 0xeaf8ff, 0x3a7ab8, 0x8ae8ff, 0x24305e, 0x3a7aff), paint('raptor', 'Raptor Green', 0x4a8a3a, 0x24301a, 0xf4c25b, 0x14200e, 0xffd84a)],
  },
  // Fang Liger: the black-and-gold war hound
  liger: {
    hat: [P('ears', 'Hound Ears', 'ears', 0x2a2734, 0xe8b43a), P('vfin', 'Fang Crest', 'vfin', 0xe8b43a, 0x1f1c2a), P('antenna', 'Tracker', 'antenna', 0x5af0ff, 0x1f1c2a)],
    back: [P('missiles', 'Flank Launchers', 'missiles', 0xe8b43a, 0x2a2734), P('jetpack', 'Pounce Boosters', 'jetpack', 0xe8b43a, 0x2a2734), P('saw', 'Fang Wheel', 'saw', 0xe8b43a, 0x2a2734)],
    shoulder: [P('blade', 'Fang Blades', 'blade', 0xe8b43a, 0x2a2734), P('gun', 'Flank Blasters', 'gun', 0x2a2734, 0xe8b43a), P('claw', 'War Claws', 'claw', 0xe8b43a, 0x2a2734)],
    paint: [paint('tiger', 'Tiger Stripe', 0xe8762a, 0x1f1c2a, 0xf2ead8, 0x2a1a10, 0x5af0ff), paint('ice', 'Ice Fang', 0xeaf2ff, 0x3a7ab8, 0x8ae8ff, 0x24305e, 0x3a7aff), paint('blood', 'Blood Moon', 0x5a1a24, 0xff3a4a, 0xe8b43a, 0x200a10, 0xffd84a)],
  },
  // Blossom: the axolotl
  ember: {
    hat: [P('flower', 'Cherry Blossom', 'flower', 0xff9ac0, 0xffd84a), P('sprout', 'Lily Pad', 'sprout', 0x5ad05a, 0x3aa04a), P('crown', 'Petal Crown', 'crown', 0xff6a9a, 0x7affb0)],
    back: [P('petals', 'Blossom Fan', 'petals', 0xff9ac0, 0xffd8e8), P('shell', 'Pond Shell', 'shell', 0xf2ead8, 0xff6a9a), P('feathers', 'Fairy Wings', 'feathers', 0xd8f4ff, 0xff9ac0)],
    shoulder: [P('leaves', 'Spring Leaves', 'leaves', 0x7ad05a, 0x5ab04a), P('orb', 'Bubble Orbs', 'orb', 0x8ae8ff, 0xf2ead8), P('gem', 'Dew Drops', 'gem', 0x7affb0, 0xf2ead8)],
    paint: [paint('sakura', 'Sakura Pink', 0xffb8d0, 0xf2ead8, 0xff6a9a, 0x5a3040, 0x3a2a30), paint('wild', 'Wild Axolotl', 0x5a4a3a, 0xd8c8a8, 0xff8a4a, 0x1f1a14, 0xffd84a), paint('lagoon', 'Lagoon', 0x5ad0d8, 0xf2ead8, 0xffd84a, 0x1a3a40, 0x1f1c2a)],
  },
};

const baseOf = (def: CharacterDef) => (def.base ?? def.id).replace(/-\d+$/, '');
/** a fighter's own wardrobe (none for a fighter outside the roster) */
export const kitOf = (def: CharacterDef): Kit | undefined => KITS[baseOf(def)];

/**
 * Where each fighter wears its parts, measured off its model: the top of its head, the middle
 * of its back, the top of its right shoulder (mirrored for the left), and a size for each.
 * In its upper body's space (the turret), except a four-legged hound's back and shoulders,
 * which sit on its body (its head alone turns).
 */
export const FITS: Record<string, Fit> = {
  angel: { hat: { p: [0, 1.15, -0.13], s: 1.05 }, back: { p: [0, 0.45, 0.6], s: 1.1 }, shoulder: { p: [0.72, 0.76, 0], s: 1 } },
  dragon: { hat: { p: [0, 1.19, -0.12], s: 1.05 }, back: { p: [0, 0.5, 0.84], s: 1.1 }, shoulder: { p: [0.77, 0.79, 0], s: 1.05 } },
  pioneer: { hat: { p: [0, 1.26, -0.03], s: 1 }, back: { p: [0, 0.5, 0.62], s: 1 }, shoulder: { p: [0.61, 0.7, 0], s: 0.9 } },
  liberty: { hat: { p: [0, 1.16, -0.03], s: 1 }, back: { p: [0, 0.45, 0.88], s: 1.05 }, shoulder: { p: [0.77, 0.72, 0], s: 1 } },
  monoceros: { hat: { p: [0, 0.97, -0.05], s: 1.3 }, back: { p: [0, 0.5, 0.62], s: 1.2 }, shoulder: { p: [0.84, 0.66, 0], s: 1.1 } },
  baron: { hat: { p: [0, 1.14, 0.02], s: 0.9 }, back: { p: [0, 0.6, 0.45], s: 0.9 }, shoulder: { p: [0.8, 0.64, -0.13], s: 0.9 } },
  bastion: { hat: { p: [0, 1.29, -0.35], s: 0.9 }, back: { p: [0, 0.5, 0.62], s: 1.05 }, shoulder: { p: [0.8, 0.77, 0], s: 1 } },
  nightshade: { hat: { p: [0, 1.35, -0.01], s: 1 }, back: { p: [0, 0.55, 0.8], s: 1 }, shoulder: { p: [0.66, 0.78, 0], s: 0.95 } },
  violet: { hat: { p: [0, 0.8, -0.02], s: 1.05 }, back: { p: [0, 0.45, 0.66], s: 1.3 }, shoulder: { p: [0.85, 0.66, 0], s: 1.2 } },
  kabuto: { hat: { p: [0, 1.96, 0.0], s: 0.75 }, back: { p: [0, 1.1, 0.6], s: 0.95 }, shoulder: { p: [0.38, 1.36, 0.04], s: 0.8 } },
  tyrant: { hat: { p: [0, 0.2, -0.1], s: 0.65 }, back: { p: [0, 0.92, 0.1], s: 0.75, body: true }, shoulder: { p: [0.27, 1.0, -0.3], s: 0.7, body: true } },
  rex: { hat: { p: [0, 0.5, -1.08], s: 0.6 }, back: { p: [0, 0.46, 0.15], s: 0.7 }, shoulder: { p: [0.3, 0.36, -0.16], s: 0.7 } },
  liger: { hat: { p: [0, 0.18, -0.14], s: 0.6 }, back: { p: [0, 0.92, 0.1], s: 0.75, body: true }, shoulder: { p: [0.27, 1.0, -0.3], s: 0.7, body: true } },
  ember: { hat: { p: [0, 0.92, -0.04], s: 0.9 }, back: { p: [0, 0.4, 0.32], s: 0.8 }, shoulder: { p: [0.3, 0.45, 0], s: 0.7 } },
};
