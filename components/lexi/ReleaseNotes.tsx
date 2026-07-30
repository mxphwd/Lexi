"use client";

import {
  CSSProperties,
  MouseEvent,
  useEffect,
  useRef,
  useState,
} from "react";
import { LEXI_RELEASES, releaseImprovement } from "@/lib/lexi/releases";

type ReleaseNotesProps = {
  open: boolean;
  onClose: () => void;
};

type PlotPoint = {
  x: number;
  y: number;
};

function makePlotPoints(): PlotPoint[] {
  return LEXI_RELEASES.map((release, index) => ({
    x: 5 + (index / (LEXI_RELEASES.length - 1)) * 90,
    y: 94 - release.capabilityIndex * 0.84,
  }));
}

const PLOT_POINTS = makePlotPoints();

function formatImprovement(value: number) {
  return value >= 100 ? Math.round(value).toString() : value.toFixed(1);
}

export function ReleaseNotes({ open, onClose }: ReleaseNotesProps) {
  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const plotRef = useRef<HTMLDivElement | null>(null);
  const closeRef = useRef<HTMLButtonElement | null>(null);
  const points = PLOT_POINTS;

  function closeReleaseNotes() {
    setActiveIndex(null);
    onClose();
  }

  useEffect(() => {
    if (!open) return;
    const previousFocus = document.activeElement as HTMLElement | null;
    const focusTimer = window.setTimeout(() => closeRef.current?.focus(), 40);

    function handleKeyDown(event: globalThis.KeyboardEvent) {
      if (event.key === "Escape") {
        setActiveIndex(null);
        onClose();
      }
    }

    document.addEventListener("keydown", handleKeyDown);
    return () => {
      window.clearTimeout(focusTimer);
      document.removeEventListener("keydown", handleKeyDown);
      previousFocus?.focus();
    };
  }, [onClose, open]);

  useEffect(() => {
    if (!open) return;
    const canvas = canvasRef.current;
    const plot = plotRef.current;
    if (!canvas || !plot) return;

    const context = canvas.getContext("2d");
    if (!context) return;

    let animationFrame = 0;
    let animationStart = performance.now();

    function draw(progress: number) {
      if (!canvas || !plot || !context) return;
      const bounds = plot.getBoundingClientRect();
      const scale = Math.min(window.devicePixelRatio || 1, 2);
      const width = Math.max(1, bounds.width);
      const height = Math.max(1, bounds.height);
      const pixelWidth = Math.round(width * scale);
      const pixelHeight = Math.round(height * scale);

      if (canvas.width !== pixelWidth || canvas.height !== pixelHeight) {
        canvas.width = pixelWidth;
        canvas.height = pixelHeight;
      }

      context.setTransform(scale, 0, 0, scale, 0, 0);
      context.clearRect(0, 0, width, height);

      context.save();
      context.strokeStyle = "rgba(48, 58, 50, 0.105)";
      context.lineWidth = 1;
      context.setLineDash([2, 7]);
      [20, 40, 60, 80].forEach((capability) => {
        const y = height * ((94 - capability * 0.84) / 100);
        context.beginPath();
        context.moveTo(0, y);
        context.lineTo(width, y);
        context.stroke();
      });
      context.restore();

      const pixels = points.map((point) => ({
        x: (point.x / 100) * width,
        y: (point.y / 100) * height,
      }));
      const lengths = pixels.slice(1).map((point, index) => {
        const previous = pixels[index];
        return Math.hypot(point.x - previous.x, point.y - previous.y);
      });
      const totalLength = lengths.reduce((sum, length) => sum + length, 0);
      let remaining = totalLength * progress;

      context.save();
      context.beginPath();
      context.moveTo(pixels[0].x, pixels[0].y);
      for (let index = 1; index < pixels.length; index += 1) {
        const previous = pixels[index - 1];
        const current = pixels[index];
        const length = lengths[index - 1];
        if (remaining >= length) {
          context.lineTo(current.x, current.y);
          remaining -= length;
          continue;
        }
        if (remaining > 0) {
          const ratio = remaining / length;
          context.lineTo(
            previous.x + (current.x - previous.x) * ratio,
            previous.y + (current.y - previous.y) * ratio,
          );
        }
        break;
      }
      context.strokeStyle = "rgba(70, 116, 89, 0.94)";
      context.lineWidth = 1.7;
      context.lineCap = "round";
      context.lineJoin = "round";
      context.shadowColor = "rgba(95, 153, 119, 0.22)";
      context.shadowBlur = 9;
      context.stroke();
      context.restore();
    }

    function animate(now: number) {
      const elapsed = Math.min(1, (now - animationStart) / 980);
      const eased = 1 - Math.pow(1 - elapsed, 3);
      draw(eased);
      if (elapsed < 1) animationFrame = requestAnimationFrame(animate);
    }

    function restart() {
      cancelAnimationFrame(animationFrame);
      animationStart = performance.now();
      animationFrame = requestAnimationFrame(animate);
    }

    const observer = new ResizeObserver(restart);
    observer.observe(plot);
    restart();

    return () => {
      observer.disconnect();
      cancelAnimationFrame(animationFrame);
    };
  }, [open, points]);

  if (!open) return null;

  function closeFromBackdrop(event: MouseEvent<HTMLDivElement>) {
    if (event.target === event.currentTarget) closeReleaseNotes();
  }

  return (
    <div className="release-overlay" onMouseDown={closeFromBackdrop}>
      <section
        className="release-window"
        role="dialog"
        aria-modal="true"
        aria-labelledby="release-title"
        aria-describedby="release-index-note"
      >
        <header className="release-header">
          <div>
            <span className="release-kicker">Alphaine / development record</span>
            <h1 id="release-title">Release notes</h1>
          </div>
          <button
            ref={closeRef}
            className="release-close"
            type="button"
            aria-label="Close release notes"
            onClick={closeReleaseNotes}
          >
            <span aria-hidden="true" />
          </button>
        </header>

        <div className="release-chart-shell">
          <span className="release-axis release-axis-y">Capability of Lexi</span>
          <div
            ref={plotRef}
            className="release-plot"
            onMouseLeave={() => setActiveIndex(null)}
          >
            <canvas ref={canvasRef} className="release-line" aria-hidden="true" />
            {points.map((point, index) => {
              const release = LEXI_RELEASES[index];
              const improvement = releaseImprovement(index);
              const pointStyle = {
                "--point-x": `${point.x}%`,
                "--point-y": `${point.y}%`,
                "--release-order": index,
              } as CSSProperties;

              return (
                <div
                  className={`release-point-anchor ${
                    activeIndex === index ? "is-active" : ""
                  }`}
                  key={release.build}
                  style={pointStyle}
                >
                  <span className="release-point-label">{release.shortLabel}</span>
                  <button
                    className={`release-point ${activeIndex === index ? "is-active" : ""}`}
                    type="button"
                    aria-label={`Open notes for ${release.label}`}
                    aria-expanded={activeIndex === index}
                    onMouseEnter={() => setActiveIndex(index)}
                    onMouseLeave={() =>
                      setActiveIndex((current) => (current === index ? null : current))
                    }
                    onFocus={() => setActiveIndex(index)}
                    onBlur={() => setActiveIndex(null)}
                    onClick={() =>
                      setActiveIndex((current) => (current === index ? null : index))
                    }
                  >
                    <span />
                  </button>

                  {activeIndex === index ? (
                    <aside
                      className={`release-tooltip ${
                        index >= LEXI_RELEASES.length - 2 ? "opens-left" : "opens-right"
                      } ${point.y > 68 ? "opens-up" : ""}`}
                    >
                      <div className="release-tooltip-heading">
                        <div>
                          <strong>{release.label}</strong>
                          <time>{release.date}</time>
                        </div>
                        {release.metric ? (
                          <mark className="release-metric">{release.metric}</mark>
                        ) : null}
                      </div>
                      <ul>
                        {release.notes.map((note) => <li key={note}>{note}</li>)}
                      </ul>
                      <div className="release-comparison">
                        <span>Overall improvement</span>
                        {improvement === null ? (
                          <strong>Baseline release</strong>
                        ) : (
                          <strong>
                            +{formatImprovement(improvement)}% compared with{" "}
                            {LEXI_RELEASES[index - 1].shortLabel}
                          </strong>
                        )}
                      </div>
                    </aside>
                  ) : null}
                </div>
              );
            })}
          </div>
          <span className="release-axis release-axis-x">Development progress</span>
        </div>

        <p className="release-index-note" id="release-index-note">
          Relative capability index · deterministic reach, contextual precision,
          lexical coverage, and model transparency · 0–100
        </p>
      </section>
    </div>
  );
}
