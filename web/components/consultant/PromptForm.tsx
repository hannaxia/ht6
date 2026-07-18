"use client";

import { useState, type FormEvent } from "react";

export function PromptForm({
  onSubmit,
  pending,
}: {
  onSubmit: (prompt: string) => void;
  pending: boolean;
}) {
  const [value, setValue] = useState("");

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const trimmed = value.trim();
    if (!trimmed || pending) return;
    onSubmit(trimmed);
    setValue("");
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-2">
      <textarea
        value={value}
        onChange={(e) => setValue(e.target.value)}
        rows={3}
        placeholder='e.g. "Should I add coworking space?"'
        className="w-full resize-none rounded border border-slate-300 p-2 text-sm focus:border-slate-500 focus:outline-none"
      />
      <button
        type="submit"
        disabled={pending}
        className="w-full rounded bg-slate-800 px-3 py-2 text-sm font-medium text-white hover:bg-slate-700 disabled:opacity-50"
      >
        {pending ? "Consulting…" : "Ask"}
      </button>
    </form>
  );
}
