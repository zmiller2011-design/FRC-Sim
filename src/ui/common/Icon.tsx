const PATHS = {
  play: 'M7 5l12 7-12 7z',
  pause: 'M7 5h3.5v14H7zM13.5 5H17v14h-3.5z',
  back: 'M15 6l-6 6 6 6',
  camera: 'M4 12a8 8 0 1 0 2.3-5.7M4 4v4h4',
  panel: 'M4 5h16v14H4zM14 5v14',
  gauge: 'M4 16a8 8 0 1 1 16 0M12 16l4-5',
  robot: 'M5 7h14v10H5zM8 17v3M16 17v3M8 4v3M16 4v3M12 10v4',
  reset: 'M20 12a8 8 0 1 1-2.3-5.7M20 4v4h-4M9 12a3 3 0 1 0 6 0a3 3 0 1 0-6 0',
} as const;

export type IconName = keyof typeof PATHS;

/** Minimal stroke icon set (24×24). Decorative unless given a label by the parent control. */
export function Icon({ name }: { name: IconName }) {
  const filled = name === 'play' || name === 'pause';
  return (
    <svg
      className="icon"
      width="16"
      height="16"
      viewBox="0 0 24 24"
      aria-hidden="true"
      fill={filled ? 'currentColor' : 'none'}
      stroke={filled ? 'none' : 'currentColor'}
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d={PATHS[name]} />
    </svg>
  );
}
