/** Plain text — no avatar bubbles, no typing indicators, no gradients. */
export function ConsultantMessage({ text }: { text: string }) {
  return (
    <p className="whitespace-pre-wrap border-l-2 border-slate-300 pl-3 text-sm text-slate-700">
      {text}
    </p>
  );
}
