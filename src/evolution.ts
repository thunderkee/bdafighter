import type { CharacterDef } from './robot';

/**
 * Each fighter's evolution line: five forms on its own road, unlocked by levelling it up. The skin
 * slot holds them (standard, vanguard, striker, phantom, legend are forms I to V). Every form adds
 * armour from the fighter's own kit and grows; the last two change colour on the way to the final form.
 */
export interface Line {
  /** forms II to V */
  names: [string, string, string, string];
  /** the final form's colours: body, trim, accent, joints, eyes */
  peak: [number, number, number, number, number];
}

export const LINES: Record<string, Line> = {
  angel: { names: ['Seraph Vow', 'Archon', 'Archon Prime', 'Empyrean'], peak: [0xfff6e0, 0xf0b82e, 0x7ae0ff, 0x2a2a5a, 0x7affff] },
  dragon: { names: ['Scalewyrm', 'Cinderdrake', 'Infernodrake', 'Ashwing Sovereign'], peak: [0x2a1c20, 0xff5a1a, 0xffd23e, 0x120c10, 0xffee58] },
  pioneer: { names: ['Sergeant Pioneer', 'Captain Pioneer', 'Commissioner', 'High Marshal'], peak: [0x1e2c66, 0xffd24a, 0xff3b4e, 0x10162e, 0x7ae0ff] },
  liberty: { names: ['Liberty Vigil', 'Beacon', 'Lighthouse', 'Colossus of Dawn'], peak: [0xd8a03a, 0x3a2a14, 0xfff0b0, 0x2a1e10, 0xffffff] },
  monoceros: { names: ['Mad Mandrill', 'Doctor Drill', 'Professor Primate', 'Apex Simian'], peak: [0x6a2ca0, 0x5aff9a, 0xffd23e, 0x26123a, 0x5aff9a] },
  baron: { names: ['Crimson Ace', 'Red Squadron', 'Sky Duke', 'Scarlet Emperor'], peak: [0x1e1c24, 0xff2a3a, 0xffc84a, 0x100e14, 0xff4a4a] },
  bastion: { names: ['Thorn Bastion', 'Scythemantis', 'Hive Reaper', 'Mantis Regent'], peak: [0x1e6a4a, 0xb8ff5a, 0xff5ad0, 0x102a20, 0xff5ad0] },
  nightshade: { names: ['Dusk Veil', 'Belladonna', 'Wraith Bloom', 'Eclipse Nocturne'], peak: [0xe8e0ff, 0x6a3aff, 0xffd84a, 0x2a1a5a, 0xffffff] },
  violet: { names: ['Ironback', 'Steelback', 'Titanback', 'Peakback Primal'], peak: [0xdfe8f4, 0x4a6aff, 0xffd84a, 0x2a3050, 0x4af0ff] },
  kabuto: { names: ['Gilded Leo', 'Gold Pretender', 'False Emperor', 'Usurper Absolute'], peak: [0xffc83a, 0xfff0a0, 0xff3a5a, 0x6a3a10, 0xffffff] },
  tyrant: { names: ['Tyrant Regent', 'Hellmaster', 'Tyrant Ascendant', 'Cerberus Rex'], peak: [0x3a0e16, 0xff2a3a, 0xffb02e, 0x160508, 0xffd84a] },
  rex: { names: ['Frost Rex', 'Glacier Rex', 'Permafrost Rex', 'Ice Age'], peak: [0xdff4ff, 0x3a7ab8, 0x8ae8ff, 0x24305e, 0x3a7aff] },
  liger: { names: ['Fang Striker', 'Razorhound', 'Warhound Alpha', 'Fenris Prime'], peak: [0x1a1a22, 0xffc83a, 0xff5a2a, 0x0c0c10, 0xff5a2a] },
  ember: { names: ['Petal', 'Bloomling', 'Spring Empress', 'Everbloom'], peak: [0xffc4dc, 0xffffff, 0xffd84a, 0xc45a8a, 0x2a1a3a] },
  trueleo: { names: ['Exile Leo', 'Returning King', 'Lion Restored', 'Rightful Sovereign'], peak: [0xb8202e, 0xffd24a, 0xfff4d0, 0x2a1014, 0x7affb0] },
};

export const lineOf = (def: Pick<CharacterDef, 'id' | 'base'>): Line | undefined => LINES[def.id.replace(/-\d+$/, '')] ?? LINES[(def.base ?? def.id).replace(/-\d+$/, '')];

/** how large each form stands */
export const FORM_SCALE = [1, 1.05, 1.1, 1.17, 1.26];
/** how far towards the final colours each form has come */
const FORM_COLOUR = [0, 0, 0.15, 0.55, 1];

const mix = (a: number, b: number, t: number) => {
  const c = (s: number) => Math.round(((a >> s) & 255) + (((b >> s) & 255) - ((a >> s) & 255)) * t);
  return (c(16) << 16) | (c(8) << 8) | c(0);
};
/** a form's palette, on the way from the fighter's own to its final colours */
export function formPalette(def: CharacterDef, form: number): CharacterDef['palette'] {
  const line = lineOf(def);
  const t = FORM_COLOUR[form] ?? 0;
  if (!line || !t) return def.palette;
  const [body, trim, accent, joint, eye] = line.peak;
  const p = def.palette;
  return { ...p, body: mix(p.body, body, t), trim: mix(p.trim, trim, t), accent: mix(p.accent, accent, t), joint: mix(p.joint, joint, t), eye: mix(p.eye, eye, t), wing: mix(p.wing, body, t), wingTip: mix(p.wingTip, trim, t) };
}
