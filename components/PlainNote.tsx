export function PlainNote({ text }: { text: string }) {
  return (
    <div className="border border-brand-border bg-brand-card p-4 mb-6">
      <div className="text-brand-accent uppercase text-xs font-semibold mb-2">What this means for you</div>
      <div className="text-brand-text text-sm">{text}</div>
    </div>
  );
}
