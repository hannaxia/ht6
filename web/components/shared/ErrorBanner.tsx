export function ErrorBanner({
  errorCode,
  message,
}: {
  errorCode: string;
  message?: string;
}) {
  return (
    <div
      role="alert"
      className="rounded border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-800"
    >
      <span className="font-mono text-xs">{errorCode}</span>
      {message ? <span className="ml-2">{message}</span> : null}
    </div>
  );
}
