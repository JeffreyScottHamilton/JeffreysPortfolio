"use client";
import { useEffect, useRef, useState } from "react";
import { Play } from "lucide-react";
import type { LifeVideo as Config } from "@/content/media";

type HlsInstance = { destroy(): void };

/** hls.js (light build) only for browsers without native HLS, and only once
 *  someone presses play; hovering the button warms it up */
const loadHls = () => import("hls.js/light").then((m) => m.default);

const saveData = () =>
  typeof navigator !== "undefined" &&
  Boolean((navigator as Navigator & { connection?: { saveData?: boolean } }).connection?.saveData);

/**
 * About's life video, in the same tilted frame the photos used. Until the
 * visitor presses play only the poster loads (no video bytes, no player
 * code). The stream adapts to the visitor's connection and the frame size,
 * buffers a short way ahead, and pauses when scrolled out of view.
 */
export default function LifeVideo({ video, className = "" }: { video: Config; className?: string }) {
  const root = useRef<HTMLElement>(null);
  const vid = useRef<HTMLVideoElement>(null);
  const hls = useRef<HlsInstance | null>(null);
  const [started, setStarted] = useState(false);
  const [failed, setFailed] = useState(false);
  const yt = video.youtubeId;

  // pause when it leaves the screen (the page keeps scrolling around it)
  useEffect(() => {
    const el = root.current;
    if (!el || !started || yt) return;
    const io = new IntersectionObserver(
      ([e]) => {
        const v = vid.current;
        if (e && !e.isIntersecting && v && !v.paused) v.pause();
      },
      { threshold: 0 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [started, yt]);

  useEffect(() => () => hls.current?.destroy(), []);

  // attach the source once the <video> exists (after the first click)
  useEffect(() => {
    const v = vid.current;
    if (!started || yt || !v) return;
    let dead = false;
    const go = () => void v.play().catch(() => {}); // native controls remain
    const fallback = () => {
      hls.current?.destroy();
      hls.current = null;
      if (video.mp4 && !v.src.endsWith(video.mp4)) {
        v.src = video.mp4;
        go();
      } else setFailed(true);
    };
    // Apple's own HLS player is excellent (and the only option on older
    // iPhones); elsewhere hls.js, which sizes the stream to the frame
    const apple = /Apple/.test(navigator.vendor);
    const mse = "MediaSource" in window || "ManagedMediaSource" in window;
    if (video.hls && v.canPlayType("application/vnd.apple.mpegurl") && (apple || !mse)) {
      v.src = video.hls;
      go();
    } else if (video.hls) {
      loadHls()
        .then((Hls) => {
          if (dead) return;
          if (!Hls.isSupported()) return fallback();
          const h = new Hls({
            capLevelToPlayerSize: true, // never fetch more pixels than the frame shows
            maxDevicePixelRatio: 2, // 3x phone screens don't need 3x the data
            startLevel: saveData() ? 0 : -1,
            maxBufferLength: 20, // seconds ahead: stopping early wastes little
            maxMaxBufferLength: 40,
          });
          h.on(Hls.Events.ERROR, (_e, d) => {
            if (d.fatal) fallback();
          });
          h.loadSource(video.hls!);
          h.attachMedia(v);
          hls.current = h;
          go();
        })
        .catch(fallback);
    } else fallback();
    return () => {
      dead = true;
    };
  }, [started, yt, video]);

  const shape = { aspectRatio: String(video.aspect) };

  return (
    <figure
      ref={root}
      className={`photo-wave is-film${started ? " is-playing" : ""} ${className}`}
      data-life-video=""
    >
      <figcaption className="photo-wave-label">{video.title}</figcaption>
      <div className="photo-wave-tilt">
        <div className="photo-wave-view" style={shape}>
          {/* the poster stays underneath: Contact turns it into dots */}
          <img
            className="photo-wave-img"
            src={video.poster}
            alt=""
            decoding="async"
            draggable={false}
          />
          {started && yt ? (
            <iframe
              className="life-video-media"
              src={`https://www.youtube-nocookie.com/embed/${yt}?autoplay=1&rel=0&playsinline=1`}
              title={video.title}
              allow="autoplay; encrypted-media; fullscreen; picture-in-picture"
              allowFullScreen
            />
          ) : started ? (
            <video
              ref={vid}
              className="life-video-media"
              poster={video.poster}
              controls
              playsInline
              preload="none"
              aria-label={video.alt}
            >
              {video.captions ? (
                <track kind="captions" src={video.captions} srcLang="en" label="English" default />
              ) : null}
            </video>
          ) : (
            <button
              type="button"
              className="life-video-play"
              onClick={() => setStarted(true)}
              onPointerEnter={yt ? undefined : () => void loadHls().catch(() => {})}
              onFocus={yt ? undefined : () => void loadHls().catch(() => {})}
            >
              <span className="life-video-disc" aria-hidden="true">
                <Play size={26} strokeWidth={1.8} fill="currentColor" />
              </span>
              <span className="life-video-meta">
                Play<span className="sr-only"> {video.title},</span>
                <span aria-hidden="true"> · </span>
                {video.length}
              </span>
            </button>
          )}
          {failed ? (
            <p className="life-video-error" role="status">
              This video can&rsquo;t play in this browser.
            </p>
          ) : null}
        </div>
      </div>
    </figure>
  );
}
