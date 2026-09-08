"use client";

import { FormEvent, KeyboardEvent, useEffect, useRef, useState } from "react";
import { ReleaseNotes } from "@/components/lexi/ReleaseNotes";
import { ResponseEvidence } from "@/components/lexi/ResponseEvidence";
import { appendTurn, type ConversationTurn } from "@/lib/lexi/conversation";
import { FailureExport } from "@/components/lexi/FailureExport";
import type { BrowserSession } from "@/lib/lexi/client";
import {
  LEXI_BASE_VERSION_LABEL,
  LEXI_EXTENSION_BADGE,
} from "@/lib/lexi/version";
import { hasUnsupportedWritingSystem } from "@/modules/search";

type ComposerState = "idle" | "thinking" | "stopping";

const DOCUMENTATION_QUOTE =
  "Lexi Language is Alphaine’s experiment in rule-based language understanding. Alphaine builds Lexi around explicit rules and recorded knowledge, with sources and reasoning you can inspect. Its English coverage is limited, and recorded sources can contain errors.";

const GITHUB_URL = "https://github.com/mxphwd";
const BRAND_LETTERS = [..."Alphaine"];

type LexiSessionHandle = BrowserSession;

export function LexiInterface() {
  const [input, setInput] = useState("");
  const [composerState, setComposerState] = useState<ComposerState>("idle");
  const [turns, setTurns] = useState<ConversationTurn[]>([]);
  const [pendingPrompt, setPendingPrompt] = useState("");
  const [privateValues,setPrivateValues]=useState<string[]>([]);
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
  const conversationRef = useRef<HTMLDivElement | null>(null);
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

  useEffect(() => {
    const conversation = conversationRef.current;
    if (conversation) conversation.scrollTop = conversation.scrollHeight;
  }, [turns, pendingPrompt]);

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

  function submitMessage(event?: FormEvent) {
    event?.preventDefault();
    if (!canSend) return;

    const prompt = input.trim();
    setPendingPrompt(prompt);
    const requestId = requestRef.current + 1;
    requestRef.current = requestId;
    abortControllerRef.current?.abort("superseded");
    const controller = new AbortController();
    abortControllerRef.current = controller;
    setComposerState("thinking");
    setAboutOpen(false);

    void loadSession()
      .then(async (session) => {
        const prepared = await session.prepareAsync(prompt, { signal: controller.signal });
        if (requestRef.current !== requestId || controller.signal.aborted) return;
        const accepted = session.commit(prepared, controller.signal);
        setPrivateValues(values => [...new Set([...values, ...session.snapshot().memories.map(m=>m.value)])]);
        setTurns(current => appendTurn(current, {id: requestId, prompt, reply: accepted}));
        setInput("");
        requestAnimationFrame(resizeTextarea);
      })
      .catch((error) => {
        if (controller.signal.aborted || (error instanceof DOMException && error.name === "AbortError")) return null;
        if (requestRef.current === requestId) setTurns(current => appendTurn(current, {id: requestId, prompt, reply: {
          text: error instanceof Error ? error.message : "Lexi could not complete the request. Your session was not changed.",
          trace: { normalizedInput: prompt, sentenceMode: "interrogative", interpretedIntent: "dv13:service-error", confidence: 0, confidenceAvailable: false, matchedExampleIds: [], matchedTerms: [], selectedStructure: "service-error", source: "safe-fallback", executionStatus: "error" },
        }}));
      })
      .finally(() => {
        if (requestRef.current !== requestId) return;
        setComposerState("idle");
        setPendingPrompt("");
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
    setPendingPrompt("");
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
      <section className={`lexi-stage ${turns.length ? "has-reply" : ""}`} aria-label="Talk to Lexi">
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

        {!turns.length && !pendingPrompt && <div className="capability-guide">
          <p>Ask about recorded facts, definitions, or calculations.</p>
          <div className="example-prompts" aria-label="Try an example">
            {['Which city is the capital of France?', 'What is 20 percent of 50?', 'Can penguins fly?'].map(prompt =>
              <button type="button" key={prompt} onClick={() => {setInput(prompt); textareaRef.current?.focus(); requestAnimationFrame(resizeTextarea);}}>{prompt}</button>)}
          </div>
          <p className="session-note">DV13 · Development build. English only. Public-use accuracy has not been established.</p>
        </div>}
        {(turns.length > 0 || pendingPrompt) && <>
          <div className="conversation-toolbar">
            <p>Conversation · Last 32 replies · Clears on reload</p>
            <button type="button" disabled={composerState !== 'idle'} onClick={() => {
              sessionRef.current = null; sessionLoadRef.current = null;
              setTurns([]); setPrivateValues([]); setInput('');
              textareaRef.current?.focus(); requestAnimationFrame(resizeTextarea);
            }}>Clear conversation &amp; memory</button>
          </div>
          <div ref={conversationRef} className="conversation" tabIndex={0} role="log" aria-label="Conversation with Lexi" aria-live="polite" aria-relevant="additions">
            {turns.map((turn, index) => <div className="conversation-turn" key={turn.id}>
              <p className="user-message"><span>You</span>{turn.prompt}</p>
              <article className="reply-card" aria-label="Lexi response">
                <p>{turn.reply.text}</p>
                <ResponseEvidence reply={turn.reply}/>
                <FailureExport prompt={turn.prompt} reply={turn.reply} privateValues={privateValues} turns={turns.slice(0,index).filter(t=>!['error','canceled'].includes(t.reply.trace.executionStatus??'')).map(t=>t.prompt)}/>
              </article>
            </div>)}
            {pendingPrompt && <div className="conversation-turn"><p className="user-message"><span>You</span>{pendingPrompt}</p><p role="status">Lexi is working…</p></div>}
          </div>
        </>}

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
              <span className="version-text">
                {LEXI_BASE_VERSION_LABEL}
                <sup className="version-extension">{LEXI_EXTENSION_BADGE}</sup>
              </span>
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
