/** Removes a dead zone around zero and rescales the rest back to the full ±1 range. */
export function deadband(value: number, threshold: number): number {
  const magnitude = Math.abs(value);
  if (magnitude <= threshold) return 0;
  return (Math.sign(value) * (magnitude - threshold)) / (1 - threshold);
}

/** Response curve: 1 = linear, 2 = squared (finer control near centre). Keeps the sign. */
export function curve(value: number, exponent: number): number {
  return Math.sign(value) * Math.abs(value) ** exponent;
}

/**
 * Applies a radial dead zone and curve to a 2D stick so diagonal movement isn't distorted.
 * Writes the shaped values into `out` [x, y].
 */
export function shapeStick(
  x: number,
  y: number,
  threshold: number,
  exponent: number,
  out: [number, number],
): void {
  const magnitude = Math.min(Math.hypot(x, y), 1);
  if (magnitude <= threshold) {
    out[0] = 0;
    out[1] = 0;
    return;
  }
  const shaped = curve((magnitude - threshold) / (1 - threshold), exponent);
  out[0] = (x / Math.hypot(x, y)) * shaped;
  out[1] = (y / Math.hypot(x, y)) * shaped;
}
