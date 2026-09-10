"use client";

import {
  CSSProperties,
  MouseEvent,
  useEffect,
  useRef,
  useState,
} from "react";
import { LEXI_RELEASES, releaseIndexChange } from "@/lib/lexi/releases";

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
const FOUNDATION_INDEX = LEXI_RELEASES.findIndex((release) => release.foundation);
const FOUNDATION_TRANSITION_INDEX =
  FOUNDATION_INDEX >= 0 && FOUNDATION_INDEX + 1 < LEXI_RELEASES.length
    ? FOUNDATION_INDEX + 1
    : -1;

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
      const pixels = points.map((point) => ({
        x: (point.x / 100) * width,
        y: (point.y / 100) * height,
      }));

      if (FOUNDATION_TRANSITION_INDEX > 0) {
        const transitionX = pixels[FOUNDATION_TRANSITION_INDEX].x;
        context.fillStyle = "rgba(82, 87, 83, 0.055)";
        context.fillRect(0, 0, transitionX, height);
      }

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

      const lengths = pixels.slice(1).map((point, index) => {
        const previous = pixels[index];
        return Math.hypot(point.x - previous.x, point.y - previous.y);
      });
      const totalLength = lengths.reduce((sum, length) => sum + length, 0);
      const visibleLength = totalLength * progress;
      const foundationLength = FOUNDATION_TRANSITION_INDEX > 0
        ? lengths.slice(0, FOUNDATION_TRANSITION_INDEX).reduce((sum, length) => sum + length, 0)
        : 0;
      const strokeContext = context;

      function strokeProgress(
        startIndex: number,
        endIndex: number,
        budget: number,
        strokeStyle: string,
        dash: number[],
        shadowColor: string,
        shadowBlur: number,
      ) {
        if (budget <= 0 || endIndex <= startIndex) return;
        let remaining = budget;
        strokeContext.save();
        strokeContext.beginPath();
        strokeContext.moveTo(pixels[startIndex].x, pixels[startIndex].y);
        for (let index = startIndex + 1; index <= endIndex; index += 1) {
          const previous = pixels[index - 1];
          const current = pixels[index];
          const length = lengths[index - 1];
          if (remaining >= length) {
            strokeContext.lineTo(current.x, current.y);
            remaining -= length;
            continue;
          }
          if (remaining > 0) {
            const ratio = remaining / length;
            strokeContext.lineTo(
              previous.x + (current.x - previous.x) * ratio,
              previous.y + (current.y - previous.y) * ratio,
            );
          }
          break;
        }
        strokeContext.strokeStyle = strokeStyle;
        strokeContext.lineWidth = 1.7;
        strokeContext.lineCap = "round";
        strokeContext.lineJoin = "round";
        strokeContext.setLineDash(dash);
        strokeContext.shadowColor = shadowColor;
        strokeContext.shadowBlur = shadowBlur;
        strokeContext.stroke();
        strokeContext.restore();
      }

      if (FOUNDATION_TRANSITION_INDEX > 0) {
        strokeProgress(
          0,
          FOUNDATION_TRANSITION_INDEX,
          Math.min(visibleLength, foundationLength),
          "rgba(91, 96, 92, 0.78)",
          [2.5, 5.5],
          "rgba(91, 96, 92, 0.16)",
          5,
        );
      }
      strokeProgress(
        Math.max(FOUNDATION_TRANSITION_INDEX, 0),
        pixels.length - 1,
        Math.max(0, visibleLength - foundationLength),
        "rgba(70, 116, 89, 0.94)",
        [],
        "rgba(95, 153, 119, 0.22)",
        9,
      );
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
          <span className="release-axis release-axis-y">Audited capability maturity</span>
          <div
            ref={plotRef}
            className="release-plot"
            onMouseLeave={() => setActiveIndex(null)}
          >
            <canvas ref={canvasRef} className="release-line" aria-hidden="true" />
            {points.map((point, index) => {
              const release = LEXI_RELEASES[index];
              const indexChange = releaseIndexChange(index);
              const pointStyle = {
                "--point-x": `${point.x}%`,
                "--point-y": `${point.y}%`,
                "--release-order": index,
              } as CSSProperties;

              return (
                <div
                  className={`release-point-anchor ${release.foundation ? "is-foundation" : ""} ${
                    activeIndex === index ? "is-active" : ""
                  }`}
                  key={release.build}
                  style={pointStyle}
                >
                  <span className="release-point-label">
                    {release.shortLabel}
                    {release.extensionLevel ? (
                      <sup>+{release.extensionLevel}</sup>
                    ) : null}
                  </span>
                  <button
                    className={`release-point ${release.foundation ? "is-foundation" : ""} ${activeIndex === index ? "is-active" : ""}`}
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
                          <strong>
                            {release.label}
                            {release.extensionLevel ? (
                              <sup className="release-extension">+{release.extensionLevel}</sup>
                            ) : null}
                          </strong>
                          <time>{release.date}</time>
                          <span className="release-build-lineage">
                            Builds · {release.sourceBuilds.join(" · ")}
                          </span>
                        </div>
                        {release.metric ? (
                          <mark className="release-metric">{release.metric}</mark>
                        ) : null}
                      </div>
                      <div className="release-capability">
                        <span>Calibrated capability index</span>
                        <div className="release-capability-track" aria-hidden="true">
                          <i
                            style={{
                              "--capability": release.capabilityIndex / 100,
                            } as CSSProperties}
                          />
                        </div>
                        <strong>{release.capabilityIndex}</strong>
                      </div>
                      <p className="release-evidence-basis">
                        Evidence · {release.evidenceBasis}
                      </p>
                      <div className="release-focus" aria-label="Release focus">
                        {release.focus.map((focus, focusIndex) => (
                          <span
                            key={focus}
                            style={{ "--focus-order": focusIndex } as CSSProperties}
                          >
                            <i aria-hidden="true" />
                            {focus}
                          </span>
                        ))}
                      </div>
                      {release.measurements?.length ? (
                        <dl className="release-measurements">
                          {release.measurements.map((measurement, measurementIndex) => (
                            <div
                              key={measurement.label}
                              style={{
                                "--measurement-order": measurementIndex,
                              } as CSSProperties}
                            >
                              <dt>{measurement.label}</dt>
                              <dd>{measurement.value}</dd>
                            </div>
                          ))}
                        </dl>
                      ) : null}
                      <p className="release-summary">{release.notes.join(" ")}</p>
                      <div className="release-comparison">
                        <span>Index change</span>
                        {indexChange === null ? (
                          <strong>Baseline release</strong>
                        ) : indexChange === 0 ? (
                          <strong>
                            No engine-index change from {LEXI_RELEASES[index - 1].shortLabel}
                          </strong>
                        ) : (
                          <strong>
                            {indexChange > 0 ? "+" : ""}{indexChange} points from{" "}
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
          Calibrated engineering-capability index, not answer accuracy. It combines
          language, executable knowledge, reasoning, dialogue, evidence discipline,
          and runtime integration. No release yet has independent public-use coverage.
        </p>
      </section>
    </div>
  );
}
