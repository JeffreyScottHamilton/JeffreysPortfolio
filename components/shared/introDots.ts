/**
 * The opening's text forms from dots (first-visit intro and the short replay
 * after a mode switch), and the outgoing page's text dissolves into dots as
 * the switch cover forms. Built on components/shared/dotText.ts.
 *
 * Title and support copy (`[data-intro="title|support"]` inside <main>) are
 * held hidden by CSS until their morph runs (globals.css); each morph starts
 * from its cue, measures the text at rest and plays on the frame clock; the
 * text is handed back to plain CSS by `cancel()` once the beats are over.
 */
import { DotMorph, play, visibleTextBlocks, type Side } from "./dotText";

export type Beat = { at: number; dur: number };

export class IntroDots {
  private morphs: DotMorph[] = [];
  private timers: number[] = [];
  private stops: (() => void)[] = [];
  private forming: HTMLElement[] = [];
  private live = true;

  /**
   * Form the opening of `main`: title at `title.at` ms from now, support
   * copy at `support.at`, dots coming from `source()`.
   */
  form(main: HTMLElement, beats: { title: Beat; support: Beat }, source: () => Side) {
    const t0 = performance.now();
    const run = (sel: string, b: Beat, salt: number) => {
      const els = [...main.querySelectorAll<HTMLElement>(sel)];
      if (!els.length) return;
      this.timers.push(
        window.setTimeout(() => {
          if (!this.live) return;
          const m = new DotMorph({ from: source(), to: { text: els }, salt });
          this.morphs.push(m);
          m.update(0);
          // from here the morph's --dt holds the text (see globals.css)
          for (const e of els) e.dataset.forming = "";
          this.forming.push(...els);
          const go = () => {
            if (!this.live) return;
            // a late start (slow measure) still lands by its cue
            const late = Math.max(0, performance.now() - t0 - b.at);
            this.stops.push(play(Math.max(220, b.dur - late), (p) => m.update(p)));
          };
          m.measure().then(go, go);
        }, b.at),
      );
    };
    run('[data-intro="title"]', beats.title, 31);
    run('[data-intro="support"]', beats.support, 37);
  }

  /** Whatever text of `main` is on screen dissolves into dots over `ms`. */
  dissolve(main: HTMLElement, ms: number) {
    const els = visibleTextBlocks(main);
    if (!els.length) return;
    const t0 = performance.now();
    const m = new DotMorph({ from: { text: els }, to: { scatter: 150 }, salt: 43 });
    this.morphs.push(m);
    m.update(0);
    const go = () => {
      if (!this.live) return;
      const left = ms - (performance.now() - t0);
      this.stops.push(play(Math.max(160, left), (p) => m.update(p)));
    };
    m.measure().then(go, go);
  }

  /** Stop everything; text goes back to plain CSS. */
  cancel() {
    this.live = false;
    this.timers.forEach(clearTimeout);
    this.stops.forEach((s) => s());
    this.morphs.forEach((m) => m.release());
    this.forming.forEach((e) => delete e.dataset.forming);
    this.forming = [];
    this.timers = [];
    this.stops = [];
    this.morphs = [];
  }
}
