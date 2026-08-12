"use client";

import { FormEvent, KeyboardEvent, useEffect, useRef, useState } from "react";
import { ReleaseNotes } from "@/components/lexi/ReleaseNotes";
import type { LexiReply } from "@/lib/lexi/types";
import { LEXI_VERSION_LABEL } from "@/lib/lexi/version";
import { hasUnsupportedWritingSystem } from "@/modules/search";

type ComposerState = "idle" | "thinking" | "stopping";

const DOCUMENTATION_QUOTE =
  "Lexi model, including Lexi Language is Alphaine’s approach to the next step of language models, challenging traditional AI-based LLM(or Large Language Model)s. Alphaine aims to create mechanical thinking language model using the fundamentals of linguistics that delivers exactly how it knows about it, without hallucination.";

const GITHUB_URL = "https://github.com/mxphwd";
const BRAND_LETTERS = [..."Alphaine"];

type LexiSessionHandle = {
  respond(input: string): LexiReply;
  respondAsync(input: string, options?: { signal?: AbortSignal }): Promise<LexiReply>;
};

export function LexiInterface() {
  const [input, setInput] = useState("");
  const [composerState, setComposerState] = useState<ComposerState>("idle");
  const [reply, setReply] = useState<LexiReply | null>(null);
  const [aboutOpen, setAboutOpen] = useState(false);
  const [showVersion, setShowVersion] = useState(false);
  const [releaseNotesOpen, setReleaseNotesOpen] = useState(false);
  const [brandEntrance, setBrandEntrance] = useState(true);
  const timerRef = useRef<ReturnType<typeof setTimeout> | number | null>(null);
  const stopTimerRef = useRef<ReturnType<typeof setTimeout> | number | null>(null);
  const brandTimerRef = useRef<ReturnType<typeof setTimeout> | number | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const requestRef = useRef(0);
  const sessionRef = useRef<LexiSessionHandle | null>(null);
  const sessionLoadRef = useRef<Promise<LexiSessionHandle> | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const unsupported = hasUnsupportedWritingSystem(input);
  const canSend = input.trim().length > 0 && !unsupported && composerState === "idle";

  useEffect(() => {
    brandTimerRef.current = setTimeout(() => {
      setBrandEntrance(false);
      brandTimerRef.current = null;
    }, 1300);

    return () => {
      requestRef.current += 1;
      abortControllerRef.current?.abort("component-unmounted");
      if (timerRef.current) clearTimeout(timerRef.current);
      if (stopTimerRef.current) clearTimeout(stopTimerRef.current);
      if (brandTimerRef.current) clearTimeout(brandTimerRef.current);
    };
  }, []);

  function resizeTextarea() {
    const textarea = textareaRef.current;
    if (!textarea) return;
    textarea.style.height = "0px";
    textarea.style.height = `${Math.min(textarea.scrollHeight, 90)}px`;
  }

  function loadSession(): Promise<LexiSessionHandle> {
    if (sessionRef.current) return Promise.resolve(sessionRef.current);
    if (!sessionLoadRef.current) {
      sessionLoadRef.current = import("@/lib/lexi/engine")
        .then(({ createLexiSession }) => {
          const session = createLexiSession();
          sessionRef.current = session;
          return session;
        })
        .finally(() => {
          sessionLoadRef.current = null;
        });
    }
    return sessionLoadRef.current;
  }

  function submitMessage(event?: FormEvent) {
    event?.preventDefault();
    if (!canSend) return;

    const prompt = input.trim();
    const requestId = requestRef.current + 1;
    const startedAt = performance.now();
    const minimumThinkingTime = Math.min(1650, 840 + prompt.length * 11);
    requestRef.current = requestId;
    abortControllerRef.current?.abort("superseded");
    const controller = new AbortController();
    abortControllerRef.current = controller;
    setComposerState("thinking");
    setAboutOpen(false);
    setReply(null);

    void loadSession()
      .then((session) => session.respondAsync(prompt, { signal: controller.signal }))
      .catch((error) => {
        if (controller.signal.aborted || (error instanceof DOMException && error.name === "AbortError")) return null;
        return sessionRef.current?.respond(prompt) ?? null;
      })
      .then((preparedReply) => {
        if (!preparedReply || requestRef.current !== requestId || controller.signal.aborted) return;

        const remainingDelay = Math.max(
          0,
          minimumThinkingTime - (performance.now() - startedAt),
        );
        timerRef.current = setTimeout(() => {
          if (requestRef.current !== requestId) return;
          setReply(preparedReply);
          setComposerState("idle");
          setInput("");
          requestAnimationFrame(resizeTextarea);
          timerRef.current = null;
          if (abortControllerRef.current === controller) abortControllerRef.current = null;
        }, remainingDelay);
      });
  }

  function stopThinking() {
    if (composerState !== "thinking") return;
    requestRef.current += 1;
    abortControllerRef.current?.abort("user-canceled");
    abortControllerRef.current = null;
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = null;
    setComposerState("stopping");
    stopTimerRef.current = window.setTimeout(() => {
      setComposerState("idle");
      stopTimerRef.current = null;
    }, 680);
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
            <div className="stop-light" aria-hidden="true" />
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
                maxLength={12000}
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
                className={`send-button ${composerState !== "idle" ? "is-pause" : ""}`}
                type={composerState === "thinking" ? "button" : "submit"}
                disabled={composerState !== "thinking" && !canSend}
                aria-label={
                  composerState === "thinking"
                    ? "Stop Lexi"
                    : composerState === "stopping"
                      ? "Stopping Lexi"
                      : "Send message"
                }
                onClick={composerState === "thinking" ? stopThinking : undefined}
              >
                {composerState !== "idle" ? (
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
                    {reply.trace.executionStatus ? <div><dt>Status</dt><dd>{reply.trace.executionStatus}</dd></div> : null}
                    <div><dt>Confidence</dt><dd>{Math.round(reply.trace.confidence * 100)}%</dd></div>
                    <div><dt>Structure</dt><dd>{reply.trace.selectedStructure}</dd></div>
                    {reply.trace.clauseIntents ? (
                      <div><dt>Parts</dt><dd>{reply.trace.clauseIntents.join(" → ")}</dd></div>
                    ) : null}
                    <div><dt>Evidence</dt><dd>{reply.trace.matchedTerms.join(", ") || "safe fallback"}</dd></div>
                    <div><dt>Examples</dt><dd>{reply.trace.matchedExampleIds.join(", ")}</dd></div>
                    {reply.trace.propositionIds?.length ? <div><dt>Claims</dt><dd>{reply.trace.propositionIds.join(", ")}</dd></div> : null}
                    {reply.trace.sources?.length ? <div><dt>Sources</dt><dd>{reply.trace.sources.map((source) => `${source.sourceId} · ${source.sourceLocation}`).join("; ")}</dd></div> : null}
                    {reply.trace.failureCode ? <div><dt>Failure</dt><dd>{reply.trace.failureStage} · {reply.trace.failureCode}</dd></div> : null}
                  </dl>
                  <p className="corpus-note">
                    DV11 executes typed plans against lazily loaded indexed propositions.
                    Evaluation-only failures are isolated from every runtime and development pack.
                  </p>
                </details>
              </article>
            ) : null}
          </div>
        </div>
      </section>

      <ReleaseNotes
        open={releaseNotesOpen}
        onClose={() => setReleaseNotesOpen(false)}
      />

      <footer className="brand-footer">
        <div className={`brand-footer-inner ${showVersion ? "shows-version" : ""}`}>
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
              <span className="version-text">{LEXI_VERSION_LABEL}</span>
            ) : (
              <span className={`brand-word ${brandEntrance ? "reenter" : ""}`} aria-label="Alphaine trademark">
                {BRAND_LETTERS.map((letter, index) => (
                  <span key={`${letter}-${index}`} style={{ "--letter": index } as React.CSSProperties}>{letter}</span>
                ))}
                <sup>TM</sup>
              </span>
            )}
          </a>
          {showVersion ? (
            <>
              <span className="version-divider" aria-hidden="true">·</span>
              <button
                className="release-trigger"
                type="button"
                onClick={() => {
                  setAboutOpen(false);
                  setReleaseNotesOpen(true);
                }}
              >
                Release notes
              </button>
            </>
          ) : null}
        </div>
      </footer>
    </main>
  );
}
