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

/** `at`: cue (ms from form()); `dur`: morph length; `buildAt`: when to
 * measure the source (default: up front for the title, at the cue else). */
export type Beat = { at: number; dur: number; buildAt?: number };

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
  form(
    main: HTMLElement,
    beats: { title: Beat; support: Beat },
    source: () => Side,
    supportSource: () => Side = source,
  ) {
    const t0 = performance.now();
    const run = (sel: string, b: Beat, salt: number, src: () => Side) => {
      const els = [...main.querySelectorAll<HTMLElement>(sel)];
      if (!els.length) return;
      // the title is measured up front so it bursts exactly on its cue; the
      // support copy measures at its cue (its source is where the title is)
      const early = b === beats.title;
      let m: DotMorph | null = null;
      let ready: Promise<unknown> = Promise.resolve();
      const build = () => {
        m = new DotMorph({ from: src(), to: { text: els }, salt });
        this.morphs.push(m);
        ready = m.measure();
      };
      if (b.buildAt !== undefined)
        this.timers.push(window.setTimeout(() => this.live && !m && build(), b.buildAt));
      else if (early) build();
      this.timers.push(
        window.setTimeout(() => {
          if (!this.live) return;
          if (!m) build();
          const mm = m!;
          mm.update(0);
          // from here the morph's --dt holds the text (see globals.css)
          for (const e of els) e.dataset.forming = "";
          this.forming.push(...els);
          const go = () => {
            if (!this.live) return;
            // a late start (slow measure) still lands by its cue
            const late = Math.max(0, performance.now() - t0 - b.at);
            this.stops.push(play(Math.max(220, b.dur - late), (p) => mm.update(p)));
          };
          ready.then(go, go);
        }, b.at),
      );
    };
    run('[data-intro="title"]', beats.title, 31, source);
    run('[data-intro="support"]', beats.support, 37, supportSource);
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
