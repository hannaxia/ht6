export function MapNotConfigured() {
  return (
    <div className="flex h-full min-h-[420px] items-center justify-center rounded border border-dashed border-slate-300 bg-slate-100">
      <div className="max-w-sm p-6 text-center text-sm text-slate-600">
        <p className="font-medium">Map not configured</p>
        <p className="mt-1">
          Add{" "}
          <code className="font-mono text-xs">
            NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN
          </code>{" "}
          to the root <code className="font-mono text-xs">.env</code> and
          restart. Steps:{" "}
          <span className="font-medium">
            README.md → Setup checklist → Mapbox
          </span>{" "}
          (repo root).
        </p>
      </div>
    </div>
  );
}
