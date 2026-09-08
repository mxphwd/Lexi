import type { LexiReply } from '@/lib/lexi/types';

const statuses: Record<string, string> = {
  supported: 'Answered', contradicted: 'Evidence contradicts the claim',
  unknown: 'Not enough information', insufficient: 'Evidence is incomplete',
  ambiguous: 'Clarification needed', partial: 'Partly answered',
  canceled: 'Canceled', error: 'Could not complete this request',
};

export function ResponseEvidence({ reply }: { reply: LexiReply }) {
  const { trace } = reply;
  const sources = [...new Map((trace.sources ?? []).map(s => [s.sourceId + ':' + s.sourceLocation, s])).values()];
  const steps = trace.evidenceSteps ?? [];
  const claims = [...new Set(trace.propositionIds ?? [])];
  const reviewLabel = (value: string) => ({
    'source-attested': 'Recorded in the source; not independently reviewed',
    reviewed: 'Marked as reviewed in the knowledge collection',
    derived: 'Mechanically derived',
  }[value] ?? value.replaceAll('-', ' '));
  return <details className="trace response-evidence">
    <summary>Why this response</summary>
    <p>{statuses[trace.executionStatus ?? 'unknown'] ?? 'Response available'}.
      {sources.length ? ` Used ${claims.length} recorded claim${claims.length === 1 ? '' : 's'} from ${sources.length} source record${sources.length === 1 ? '' : 's'}.`
        : steps.length ? ' Based on the steps below.' : 'This response has no recorded factual evidence attached.'}</p>
    {steps.length > 0 && <ol className="evidence-steps">{steps.map(step => <li key={step.id}>
      {step.description}{step.details.length > 0 && <span className="evidence-detail">{step.details.join('; ')}</span>}
    </li>)}</ol>}
    {sources.length > 0 && <ul className="evidence-sources">{sources.map(source => {
      // Imported source locations are data, never executable or arbitrary URL schemes.
      const href = /^https?:\/\//i.test(source.sourceLocation) ? source.sourceLocation : undefined;
      return <li key={source.sourceId + source.sourceLocation}>
        <strong>{source.sourceId}</strong>
        {href ? <a href={href} target="_blank" rel="noreferrer">{source.sourceLocation}</a> : <span>{source.sourceLocation}</span>}
        <span>{reviewLabel(source.reviewStatus)}</span>
      </li>;
    })}</ul>}
    <p className="evidence-note">{trace.confidenceAvailable === true
      ? `Calibrated confidence: ${Math.round(trace.confidence * 100)}%.`
      : 'Confidence is not yet calibrated. Recorded sources can still contain errors.'}</p>
    {trace.failureCode && <p className="evidence-note">Diagnostic: {trace.failureCode}</p>}
  </details>;
}
