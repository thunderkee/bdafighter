import type { FightBarks } from './storybarks';

/** what a story fight looks like this frame, for its opponent's lines */
export interface BarkFeed {
  /** the foe's health and yours, as shares (0..1) */
  foeFrac: number;
  meFrac: number;
  /** rounds won so far (the table duel only) */
  rounds?: [number, number];
  /** Action's screen (the bubbles sit below its objective and callouts) */
  action?: boolean;
}

type Kind = 'open' | 'hurt' | 'low' | 'winning' | 'losing' | 'lore0' | 'lore1';
/** a more urgent line goes first when two are due at once */
const RANK: Kind[] = ['low', 'winning', 'losing', 'hurt', 'open', 'lore0', 'lore1'];
/** a line stays up this long; then this much quiet before the next */
const SHOW = 3.8;
const GAP = 4.5;
/** a quiet spell this long brings out a story line */
const QUIET = 9;
/** your fighter answers this long after the foe's line, and its bubble stays this long */
const REPLY_AFTER = 1.7;
const REPLY_SHOW = 3.4;

/**
 * League Story's in-fight talk: the chapter's opponent speaks in a bubble by its face as the fight
 * goes (as it starts, when it's hurt and nearly beaten, when it's winning or losing a round, and in
 * the quiet spells a line of story), and your fighter answers back a moment later. The same two
 * bubbles serve the table duel and Action's fights.
 */
export class Barks {
  private box: HTMLElement;
  private el: HTMLElement;
  private you: HTMLElement;
  /** your fighter's comeback, waiting for its moment */
  private reply: string | null = null;
  private youSince = 99;
  private lines: FightBarks | null = null;
  private said = new Set<Kind>();
  private due = new Set<Kind>();
  private t = 0;
  /** seconds since the last line went up */
  private since = 99;
  private quiet = 0;
  private rounds: [number, number] = [0, 0];

  constructor(host: HTMLElement, private face: (id: string, el: HTMLElement) => void) {
    this.box = document.createElement('div');
    this.box.className = 'barks';
    this.box.setAttribute('aria-live', 'polite');
    const bubble = (cls: string) => {
      const el = document.createElement('div');
      el.className = `bark ${cls}`;
      el.innerHTML = '<span class="bark-face"></span><div><b></b><p></p></div>';
      this.box.appendChild(el);
      return el;
    };
    this.el = bubble('foe');
    this.you = bubble('you');
    host.appendChild(this.box);
  }

  /** a new fight: this foe, these lines (none: it stays quiet) */
  start(lines: FightBarks | null | undefined, foeId: string, foeName: string, heroId: string, heroName: string) {
    this.lines = lines ?? null;
    this.said.clear();
    this.due.clear();
    this.t = 0;
    this.since = 99;
    this.quiet = 0;
    this.rounds = [0, 0];
    this.hide();
    for (const [el, id, name] of [
      [this.el, foeId, foeName],
      [this.you, heroId, heroName],
    ] as const) {
      const f = el.querySelector<HTMLElement>('.bark-face')!;
      f.innerHTML = '';
      this.face(id, f);
      el.querySelector('b')!.textContent = name;
    }
  }

  stop() {
    this.lines = null;
    this.hide();
  }

  /** each frame of the fight (feed null: not fighting just now, e.g. paused or between rounds) */
  update(dt: number, feed: BarkFeed | null) {
    if (!this.lines) return;
    if (this.since < 99) this.since += dt;
    if (this.since > SHOW) this.el.classList.remove('on');
    if (this.youSince < 99) this.youSince += dt;
    if (this.youSince > REPLY_SHOW) this.you.classList.remove('on');
    // (no answer into a pause or the gap between rounds)
    if (!feed) this.reply = null;
    else if (this.reply && this.since >= REPLY_AFTER) {
      this.you.querySelector('p')!.textContent = this.reply;
      this.reply = null;
      this.youSince = 0;
      this.pop(this.you);
    }
    if (!feed) return;
    this.box.classList.toggle('action', !!feed.action);
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
    if (k === 'lore0' || k === 'lore1') {
      const i = k === 'lore0' ? 0 : 1;
      this.say(l.lore[i], l.reply.lore[i]);
    } else this.say(l[k], l.reply[k]);
  }

  private say(text: string, reply: string) {
    this.el.querySelector('p')!.textContent = text;
    this.pop(this.el);
    this.reply = reply;
    this.since = 0;
    this.quiet = 0;
  }

  private pop(el: HTMLElement) {
    el.classList.remove('on');
    void el.offsetWidth;
    el.classList.add('on');
  }

  private hide() {
    this.reply = null;
    this.el.classList.remove('on');
    this.you.classList.remove('on');
  }
}
