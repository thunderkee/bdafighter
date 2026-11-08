import type { FightBarks } from './storybarks';

/** what a story fight looks like this frame, for its opponent's lines */
export interface BarkFeed {
  /** the foe's health and yours, as shares (0..1) */
  foeFrac: number;
  meFrac: number;
  /** rounds won so far (the table duel only) */
  rounds?: [number, number];
}

type Kind = 'open' | 'hurt' | 'low' | 'winning' | 'losing' | 'lore0' | 'lore1';
/** a more urgent line goes first when two are due at once */
const RANK: Kind[] = ['low', 'winning', 'losing', 'hurt', 'open', 'lore0', 'lore1'];
/** a line stays up this long; then this much quiet before the next */
const SHOW = 3.8;
const GAP = 4.5;
/** a quiet spell this long brings out a story line */
const QUIET = 9;

/**
 * League Story's in-fight talk: the chapter's opponent speaks in a bubble by its face as the fight
 * goes (as it starts, when it's hurt and nearly beaten, when it's winning or losing a round, and in
 * the quiet spells a line of story). One bubble, shared by the table duel and Action's fights.
 */
export class Barks {
  private el: HTMLElement;
  private lines: FightBarks | null = null;
  private said = new Set<Kind>();
  private due = new Set<Kind>();
  private t = 0;
  /** seconds since the last line went up */
  private since = 99;
  private quiet = 0;
  private rounds: [number, number] = [0, 0];

  constructor(host: HTMLElement, private face: (id: string, el: HTMLElement) => void) {
    this.el = document.createElement('div');
    this.el.className = 'bark';
    this.el.setAttribute('aria-live', 'polite');
    this.el.innerHTML = '<span class="bark-face"></span><div><b></b><p></p></div>';
    host.appendChild(this.el);
  }

  /** a new fight: this foe, these lines (none: it stays quiet) */
  start(lines: FightBarks | null | undefined, foeId: string, foeName: string) {
    this.lines = lines ?? null;
    this.said.clear();
    this.due.clear();
    this.t = 0;
    this.since = 99;
    this.quiet = 0;
    this.rounds = [0, 0];
    this.hide();
    const f = this.el.querySelector<HTMLElement>('.bark-face')!;
    f.innerHTML = '';
    this.face(foeId, f);
    this.el.querySelector('b')!.textContent = foeName;
  }

  stop() {
    this.lines = null;
    this.hide();
  }

  /** each frame of the fight (feed null: not fighting just now, e.g. paused or between rounds) */
  update(dt: number, feed: BarkFeed | null) {
    if (!this.lines) return;
    if (this.since < 99) this.since += dt;
    if (this.since > SHOW) this.hide();
    if (!feed) return;
    this.t += dt;
    this.quiet += dt;
    const once = (k: Kind, when: boolean) => {
      if (when && !this.said.has(k)) this.due.add(k);
    };
    once('open', this.t > 1.2);
    once('hurt', feed.foeFrac < 0.55);
    once('low', feed.foeFrac < 0.25 && feed.foeFrac > 0);
    once('winning', feed.meFrac < 0.3 && feed.meFrac > 0);
    once('losing', feed.foeFrac < feed.meFrac - 0.4);
    // a round taken (the duel): its line again, whoever took it
    if (feed.rounds) {
      if (feed.rounds[1] > this.rounds[1]) this.due.add('winning');
      if (feed.rounds[0] > this.rounds[0]) this.due.add('losing');
      this.rounds = [...feed.rounds];
    }
    if (this.quiet > QUIET) {
      once('lore0', true);
      if (this.said.has('lore0')) once('lore1', true);
    }
    if (this.since < SHOW + GAP) return;
    const k = RANK.find((x) => this.due.has(x));
    if (!k) return;
    this.due.delete(k);
    this.said.add(k);
    const l = this.lines;
    this.say(k === 'lore0' ? l.lore[0] : k === 'lore1' ? l.lore[1] : l[k]);
  }

  private say(text: string) {
    this.el.querySelector('p')!.textContent = text;
    this.el.classList.remove('on');
    void this.el.offsetWidth;
    this.el.classList.add('on');
    this.since = 0;
    this.quiet = 0;
  }

  private hide() {
    this.el.classList.remove('on');
  }
}
