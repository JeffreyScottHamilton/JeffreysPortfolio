import { Fragment, type ReactNode } from "react";

/**
 * Splits a line into inline-block word spans (`.wk-w`) so each word can be
 * moved on its own (absorbed into / emerging from the portrait's dots).
 * Spaces stay real text, so wrapping and the accessible text are unchanged.
 * `ghost` draws the words via CSS (decorative copies must not duplicate
 * real page text). `end` is appended inside the last word (e.g. a red dot).
 */
export default function Words({
  text,
  ghost = false,
  end,
}: {
  text: string;
  ghost?: boolean;
  end?: ReactNode;
}) {
  const ws = text.split(" ");
  return (
    <>
      {ws.map((w, i) => {
        const last = i === ws.length - 1;
        return (
          <Fragment key={i}>
            {ghost ? (
              <span className="wk-w wk-ghost" data-text={w}>
                {last ? end : null}
              </span>
            ) : (
              <span className="wk-w">
                {w}
                {last ? end : null}
              </span>
            )}
            {last ? null : " "}
          </Fragment>
        );
      })}
    </>
  );
}
