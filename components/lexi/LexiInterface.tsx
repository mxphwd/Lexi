"use client";

import { FormEvent, KeyboardEvent, useEffect, useRef, useState } from "react";
import { ReleaseNotes } from "@/components/lexi/ReleaseNotes";
import { FailureExport } from "@/components/lexi/FailureExport";
import type { LexiReply } from "@/lib/lexi/types";
import type { BrowserSession } from "@/lib/lexi/client";
import {
  LEXI_BASE_VERSION_LABEL,
  LEXI_EXTENSION_BADGE,
} from "@/lib/lexi/version";
import { hasUnsupportedWritingSystem } from "@/modules/search/tokenize";

type ComposerState = "idle" | "thinking" | "stopping";
type ReadinessState = "checking" | "preparing" | "handoff" | "ready";
type DeveloperSplashState = "off" | "visible" | "handoff";

const DOCUMENTATION_QUOTE =
  "Lexi model, including Lexi Language is Alphaine’s approach to the next step of language models, challenging traditional AI-based LLM(or Large Language Model)s. Alphaine aims to create mechanical thinking language model using the fundamentals of linguistics that delivers exactly how it knows about it, without hallucination.";

const GITHUB_URL = "https://github.com/mxphwd";
const BRAND_LETTERS = [..."Alphaine"];
const SPLASH_TEST_COMMAND = /^splash\s+-([0-9]+(?:\.[0-9]+)?)$/i;
const MAX_SPLASH_TEST_SECONDS = 300;
const SPLASH_THRESHOLD_MS = 1500;

type LexiSessionHandle = BrowserSession;

export function LexiInterface() {
  const [input, setInput] = useState("");
  const [composerState, setComposerState] = useState<ComposerState>("idle");
  const [reply, setReply] = useState<LexiReply | null>(null);
  const [lastPrompt,setLastPrompt]=useState("");
  const [privateValues,setPrivateValues]=useState<string[]>([]);
  const [aboutOpen, setAboutOpen] = useState(false);
  const [showVersion, setShowVersion] = useState(false);
  const [releaseNotesOpen, setReleaseNotesOpen] = useState(false);
  const [brandEntrance, setBrandEntrance] = useState(true);
  const [readiness, setReadiness] = useState<ReadinessState>("checking");
  const [developerSplash, setDeveloperSplash] = useState<DeveloperSplashState>("off");
  const timerRef = useRef<ReturnType<typeof setTimeout> | number | null>(null);
  const stopTimerRef = useRef<ReturnType<typeof setTimeout> | number | null>(null);
  const brandTimerRef = useRef<ReturnType<typeof setTimeout> | number | null>(null);
  const developerSplashTimerRef = useRef<number | null>(null);
  const developerSplashHandoffTimerRef = useRef<number | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const requestRef = useRef(0);
  const sessionRef = useRef<LexiSessionHandle | null>(null);
  const sessionLoadRef = useRef<Promise<LexiSessionHandle> | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const unsupported = hasUnsupportedWritingSystem(input);
  const canSend = input.trim().length > 0 && !unsupported && composerState === "idle" && readiness === "ready" && developerSplash === "off";

  useEffect(() => {
    let canceled = false;
    let handoffTimer: number | null = null;
    let preparationThresholdTimer: number | null = null;
    let splashWasShown = false;

    preparationThresholdTimer = window.setTimeout(() => {
      if (canceled) return;
      splashWasShown = true;
      setReadiness("preparing");
    }, SPLASH_THRESHOLD_MS);

    void import("@/lib/lexi/client")
      .then(async ({ prepareLexiRuntime }) => {
        const outcome = await prepareLexiRuntime();
        if (canceled) return;
        if (preparationThresholdTimer) clearTimeout(preparationThresholdTimer);
        preparationThresholdTimer = null;
        if (!splashWasShown) {
          setReadiness("ready");
          return;
        }
        setReadiness("handoff");
        handoffTimer = window.setTimeout(() => {
          if (!canceled) setReadiness("ready");
        }, 460);
      })
      .catch(() => {
        // A failed preflight must never make Lexi unavailable; normal request
        // error handling remains the source of a user-visible service error.
        if (preparationThresholdTimer) clearTimeout(preparationThresholdTimer);
        preparationThresholdTimer = null;
        if (!canceled && splashWasShown) {
          setReadiness("handoff");
          handoffTimer = window.setTimeout(() => {
            if (!canceled) setReadiness("ready");
          }, 460);
        } else if (!canceled) setReadiness("ready");
      });

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
      if (developerSplashTimerRef.current) clearTimeout(developerSplashTimerRef.current);
      if (developerSplashHandoffTimerRef.current) clearTimeout(developerSplashHandoffTimerRef.current);
      if (preparationThresholdTimer) clearTimeout(preparationThresholdTimer);
      if (handoffTimer) clearTimeout(handoffTimer);
      canceled = true;
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
      sessionLoadRef.current = import("@/lib/lexi/client")
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

  function splashTestSeconds(prompt: string): number | null {
    const match = SPLASH_TEST_COMMAND.exec(prompt);
    if (!match) return null;
    const seconds = Number(match[1]);
    return Number.isFinite(seconds) && seconds > 0 && seconds <= MAX_SPLASH_TEST_SECONDS ? seconds : null;
  }

  function showDeveloperSplash(seconds: number) {
    if (developerSplashTimerRef.current) clearTimeout(developerSplashTimerRef.current);
    if (developerSplashHandoffTimerRef.current) clearTimeout(developerSplashHandoffTimerRef.current);
    setDeveloperSplash("visible");
    developerSplashTimerRef.current = window.setTimeout(() => {
      setDeveloperSplash("handoff");
      developerSplashHandoffTimerRef.current = window.setTimeout(() => {
        setDeveloperSplash("off");
        developerSplashHandoffTimerRef.current = null;
      }, 460);
      developerSplashTimerRef.current = null;
    }, seconds * 1000);
  }

  function submitMessage(event?: FormEvent) {
    event?.preventDefault();
    if (!canSend) return;

    const prompt = input.trim();
    const testSeconds = splashTestSeconds(prompt);
    if (testSeconds !== null) {
      setInput("");
      setReply(null);
      setAboutOpen(false);
      requestAnimationFrame(resizeTextarea);
      showDeveloperSplash(testSeconds);
      return;
    }
    setLastPrompt(prompt);
    const requestId = requestRef.current + 1;
    requestRef.current = requestId;
    abortControllerRef.current?.abort("superseded");
    const controller = new AbortController();
    abortControllerRef.current = controller;
    setComposerState("thinking");
    setAboutOpen(false);
    setReply(null);

    void loadSession()
      .then(async (session) => {
        const prepared = await session.prepareAsync(prompt, { signal: controller.signal });
        if (requestRef.current !== requestId || controller.signal.aborted) return;
        const accepted = session.commit(prepared, controller.signal);
        setPrivateValues(session.snapshot().memories.map(m=>m.value));
        setReply(accepted);
        setInput("");
        requestAnimationFrame(resizeTextarea);
      })
      .catch((error) => {
        if (controller.signal.aborted || (error instanceof DOMException && error.name === "AbortError")) return null;
        if (requestRef.current === requestId) setReply({
          text: error instanceof Error ? error.message : "Lexi could not complete the request. Your session was not changed.",
          trace: { normalizedInput: prompt, sentenceMode: "interrogative", interpretedIntent: "dv13:service-error", confidence: 0, confidenceAvailable: false, matchedExampleIds: [], matchedTerms: [], selectedStructure: "service-error", source: "safe-fallback", executionStatus: "error" },
        });
      })
      .finally(() => {
        if (requestRef.current !== requestId) return;
        setComposerState("idle");
        if (abortControllerRef.current === controller) abortControllerRef.current = null;
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
  const splashVisible = readiness === "preparing" || readiness === "handoff" || developerSplash !== "off";
  const splashHandoff = readiness === "handoff" || developerSplash === "handoff";

  return (
    <main className={`lexi-page lexi-readiness-${readiness}`} aria-busy={readiness !== "ready"}>
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
                disabled={readiness !== "ready"}
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
                    <div><dt>Confidence</dt><dd>{reply.trace.confidenceAvailable === false ? "Not yet calibrated" : Math.round(reply.trace.confidence * 100) + "%"}</dd></div>
                    <div><dt>Structure</dt><dd>{reply.trace.selectedStructure}</dd></div>
                    {reply.trace.clauseIntents ? (
                      <div><dt>Parts</dt><dd>{reply.trace.clauseIntents.join(" → ")}</dd></div>
                    ) : null}
                    <div><dt>Evidence</dt><dd>{reply.trace.matchedTerms.join(", ") || "safe fallback"}</dd></div>
                    <div><dt>Examples</dt><dd>{reply.trace.matchedExampleIds.join(", ")}</dd></div>
                    {reply.trace.propositionIds?.length ? <div><dt>Claims</dt><dd>{reply.trace.propositionIds.join(", ")}</dd></div> : null}
                    {reply.trace.liveKnowledge ? <div><dt>Live knowledge</dt><dd>{reply.trace.liveKnowledge.queryableClaims.toLocaleString()} queryable claims · {reply.trace.liveKnowledge.worldPropositions.toLocaleString()} world propositions · {reply.trace.liveKnowledge.lexicalClaims.toLocaleString()} lexical claims · {reply.trace.liveKnowledge.installedPackages.toLocaleString()} loaded packages</dd></div> : null}
                    {reply.trace.sources?.length ? <div><dt>Sources</dt><dd>{reply.trace.sources.map((source) => `${source.sourceId} · ${source.sourceLocation}`).join("; ")}</dd></div> : null}
                    {reply.trace.failureCode ? <div><dt>Failure</dt><dd>{reply.trace.failureStage} · {reply.trace.failureCode}</dd></div> : null}
                  </dl>
                  <p className="corpus-note">
                    DV15 executes compositional typed plans and lazily loads bounded Basic and Advanced data packs. Confidence and public-use answerability remain unverified until independently evaluated.
                    Evaluation-only failures are isolated from every runtime and development pack.
                  </p>
                </details>
                <FailureExport key={lastPrompt} prompt={lastPrompt} reply={reply} privateValues={privateValues}/>
              </article>
            ) : null}
          </div>
        </div>
      </section>

      <ReleaseNotes
        open={releaseNotesOpen}
        onClose={() => setReleaseNotesOpen(false)}
      />

      {splashVisible ? (
        <div className={`lexi-splash ${splashHandoff ? "is-handing-off" : ""}`} role="status" aria-label="Preparing Lexi">
          <span className="brand-word lexi-splash-brand reenter" aria-label="Alphaine trademark">
            {BRAND_LETTERS.map((letter, index) => (
              <span key={`splash-${letter}-${index}`} style={{ "--letter": index } as React.CSSProperties}>{letter}</span>
            ))}
            <sup>TM</sup>
          </span>
        </div>
      ) : null}

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
              <span className="version-text">
                {LEXI_BASE_VERSION_LABEL}
                <sup className="version-extension">{LEXI_EXTENSION_BADGE}</sup>
              </span>
            ) : (
              <span className={`brand-word ${brandEntrance && !splashVisible ? "reenter" : ""}`} aria-label="Alphaine trademark">
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
