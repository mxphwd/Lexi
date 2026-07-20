"use client";

import { FormEvent, KeyboardEvent, useEffect, useRef, useState } from "react";
import { corpusStats, respond } from "@/lib/lexi/engine";
import type { LexiReply } from "@/lib/lexi/types";
import { hasUnsupportedWritingSystem } from "@/modules/search";

type ComposerState = "idle" | "thinking" | "stopping";

const DOCUMENTATION_QUOTE =
  "Lexi model, including Lexi Language is Alphaine’s approach to the next step of language models, challenging traditional AI-based LLM(or Large Language Model)s. Alphaine aims to create mechanical thinking language model using the fundamentals of linguistics that delivers exactly how it knows about it, without hallucination.";

const GITHUB_URL = "https://github.com/mxphwd";
const BRAND_LETTERS = [..."Alphaine"];
const stats = corpusStats();

export function LexiInterface() {
  const [input, setInput] = useState("");
  const [composerState, setComposerState] = useState<ComposerState>("idle");
  const [reply, setReply] = useState<LexiReply | null>(null);
  const [aboutOpen, setAboutOpen] = useState(false);
  const [showVersion, setShowVersion] = useState(false);
  const [brandEntrance, setBrandEntrance] = useState(true);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const brandTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const unsupported = hasUnsupportedWritingSystem(input);
  const canSend = input.trim().length > 0 && !unsupported && composerState === "idle";

  useEffect(() => {
    brandTimerRef.current = setTimeout(() => {
      setBrandEntrance(false);
      brandTimerRef.current = null;
    }, 1300);

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      if (brandTimerRef.current) clearTimeout(brandTimerRef.current);
    };
  }, []);

  function resizeTextarea() {
    const textarea = textareaRef.current;
    if (!textarea) return;
    textarea.style.height = "0px";
    textarea.style.height = `${Math.min(textarea.scrollHeight, 90)}px`;
  }

  function submitMessage(event?: FormEvent) {
    event?.preventDefault();
    if (!canSend) return;

    const prompt = input.trim();
    const preparedReply = respond(prompt);
    setComposerState("thinking");
    setAboutOpen(false);
    setReply(null);

    timerRef.current = setTimeout(() => {
      setReply(preparedReply);
      setComposerState("idle");
      setInput("");
      requestAnimationFrame(resizeTextarea);
      timerRef.current = null;
    }, Math.min(1650, 840 + prompt.length * 11));
  }

  function stopThinking() {
    if (composerState !== "thinking") return;
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = null;
    setComposerState("stopping");
    window.setTimeout(() => setComposerState("idle"), 680);
  }

  function handleComposerKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      submitMessage();
    }
  }

  function handleBrandClick(event: React.MouseEvent<HTMLAnchorElement>) {
    if (!event.shiftKey) return;
    event.preventDefault();
    const returningToLogo = showVersion;
    setShowVersion((current) => !current);
    if (returningToLogo) {
      if (brandTimerRef.current) clearTimeout(brandTimerRef.current);
      setBrandEntrance(true);
      brandTimerRef.current = setTimeout(() => {
        setBrandEntrance(false);
        brandTimerRef.current = null;
      }, 1300);
    } else {
      setBrandEntrance(false);
    }
  }

  const shellState = unsupported
    ? "unsupported"
    : composerState === "thinking"
      ? "thinking"
      : composerState === "stopping"
        ? "stopping"
        : "idle";

  return (
    <main className="lexi-page">
      <section className={`lexi-stage ${reply ? "has-reply" : ""}`} aria-label="Talk to Lexi">
        <form className="composer-form" onSubmit={submitMessage}>
          <div className={`composer-frame state-${shellState}`}>
            <div className="composer-glow" aria-hidden="true" />
            <div className="composer-inner">
              <button
                className="about-trigger"
                type="button"
                aria-label="About Lexi"
                aria-expanded={aboutOpen}
                aria-controls="lexi-about"
                onClick={() => setAboutOpen((current) => !current)}
              >
                i
              </button>
              <textarea
                ref={textareaRef}
                value={input}
                rows={1}
                maxLength={600}
                className="composer-input"
                placeholder="Talk to Lexi..."
                aria-label="Message Lexi"
                aria-describedby={unsupported ? "language-warning" : undefined}
                onChange={(event) => {
                  setInput(event.target.value);
                  requestAnimationFrame(resizeTextarea);
                }}
                onKeyDown={handleComposerKeyDown}
              />
              <button
                className={`send-button ${composerState === "thinking" ? "is-pause" : ""}`}
                type={composerState === "thinking" ? "button" : "submit"}
                disabled={composerState !== "thinking" && !canSend}
                aria-label={composerState === "thinking" ? "Stop Lexi" : "Send message"}
                onClick={composerState === "thinking" ? stopThinking : undefined}
              >
                {composerState === "thinking" ? (
                  <span className="pause-glyph" aria-hidden="true"><i /><i /></span>
                ) : (
                  <span className="send-glyph" aria-hidden="true" />
                )}
              </button>
            </div>
            <aside
              id="lexi-about"
              className={`about-popover ${aboutOpen ? "is-open" : ""}`}
              aria-hidden={!aboutOpen}
            >
              <span className="about-label">Lexi / definition</span>
              <blockquote>
                “{DOCUMENTATION_QUOTE.split(/(Alphaine)/g).map((part, index) =>
                  part === "Alphaine" ? (
                    <a
                      key={`alphaine-${index}`}
                      className="about-alphaine-link"
                      href={GITHUB_URL}
                      target="_blank"
                      rel="noreferrer"
                    >
                      <strong>{part}</strong>
                    </a>
                  ) : part,
                )}”
              </blockquote>
            </aside>
          </div>
          <p
            id="language-warning"
            className={`language-warning ${unsupported ? "is-visible" : ""}`}
            role={unsupported ? "alert" : undefined}
          >
            Currently, languages apart from English are unsupported.
          </p>
        </form>

        <div className={`reply-region ${reply ? "is-visible" : ""}`} aria-live="polite">
          <div className="reply-shell">
            {reply ? (
              <article className="reply-card">
                <p>{reply.text}</p>
                <details className="trace">
                  <summary>Why this response</summary>
                  <dl>
                    <div><dt>Context</dt><dd>{reply.trace.interpretedIntent}</dd></div>
                    <div><dt>Confidence</dt><dd>{Math.round(reply.trace.confidence * 100)}%</dd></div>
                    <div><dt>Structure</dt><dd>{reply.trace.selectedStructure}</dd></div>
                    <div><dt>Evidence</dt><dd>{reply.trace.matchedTerms.join(", ") || "safe fallback"}</dd></div>
                    <div><dt>Examples</dt><dd>{reply.trace.matchedExampleIds.join(", ")}</dd></div>
                  </dl>
                  <p className="corpus-note">
                    Matched against {stats.examples} examples across {stats.pages} context pages.
                  </p>
                </details>
              </article>
            ) : null}
          </div>
        </div>
      </section>

      <footer className="brand-footer">
        <a
          href={GITHUB_URL}
          target="_blank"
          rel="noreferrer"
          className={`brand-link ${showVersion ? "show-version" : "show-logo"}`}
          onClick={handleBrandClick}
          aria-label={
            showVersion
              ? "Alphaine Lexi Language version. Shift-click to show the Alphaine logo."
              : "Alphaine on GitHub. Shift-click to show the Lexi version."
          }
          title="Open GitHub · Shift-click for build information"
        >
          {showVersion ? (
            <span className="version-text">Alphaine™ Lexi Language 1.0 Pre-build 260720-1A</span>
          ) : (
            <span className={`brand-word ${brandEntrance ? "reenter" : ""}`} aria-label="Alphaine trademark">
              {BRAND_LETTERS.map((letter, index) => (
                <span key={`${letter}-${index}`} style={{ "--letter": index } as React.CSSProperties}>{letter}</span>
              ))}
              <sup>TM</sup>
            </span>
          )}
        </a>
      </footer>
    </main>
  );
}
