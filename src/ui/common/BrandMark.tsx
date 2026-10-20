/** Product mark: a robot-chassis square with a heading arrow. Decorative. */
export function BrandMark({ size = 24 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden="true" className="brand-mark">
      <rect width="32" height="32" rx="7" fill="var(--surface-3)" />
      <rect x="7" y="9" width="18" height="14" rx="2.5" fill="var(--accent)" />
      <path d="M14 12.5l6 3.5-6 3.5z" fill="var(--surface-0)" />
    </svg>
  );
}
