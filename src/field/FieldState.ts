import type { FieldConfig, PieceLocation } from './types';

/**
 * Mutable game-piece state for one field, kept in flat typed arrays so a future physics
 * step can write positions without allocating. `revision` increases on every change so
 * views can cheaply check whether they need to redraw.
 */
export class FieldState {
  readonly count: number;
  /** x, y, z per piece, field frame. */
  readonly positions: Float32Array;
  readonly locations: PieceLocation[];
  revision = 0;

  private readonly initialPositions: Float32Array;

  constructor(readonly config: FieldConfig) {
    const spawns = config.pieceSpawns;
    this.count = spawns.length;
    this.initialPositions = new Float32Array(this.count * 3);
    spawns.forEach((spawn, i) => {
      this.initialPositions[i * 3] = spawn.position.x;
      this.initialPositions[i * 3 + 1] = spawn.position.y;
      this.initialPositions[i * 3 + 2] = spawn.position.z;
    });
    this.positions = new Float32Array(this.initialPositions);
    this.locations = spawns.map((s) => s.location);
  }

  /** Restores every game piece to its official starting position. */
  reset(): void {
    this.positions.set(this.initialPositions);
    this.config.pieceSpawns.forEach((spawn, i) => (this.locations[i] = spawn.location));
    this.revision++;
  }

  /** Records that positions were changed externally (e.g. by a physics step). */
  markChanged(): void {
    this.revision++;
  }
}
