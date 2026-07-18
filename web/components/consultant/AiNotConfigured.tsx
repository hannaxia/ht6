export function AiNotConfigured() {
  return (
    <div className="rounded border border-slate-300 bg-slate-100 p-4 text-sm text-slate-700">
      <p className="font-medium">Gemini is not configured.</p>
      <p className="mt-1">
        Add <code className="font-mono text-xs">GEMINI_API_KEY</code> to the
        root <code className="font-mono text-xs">.env</code>, then restart the
        API. Steps: <span className="font-medium">README.md → Setup checklist
        → Gemini</span> (repo root).
      </p>
    </div>
  );
}
