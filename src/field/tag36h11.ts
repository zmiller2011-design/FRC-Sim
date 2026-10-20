/**
 * tag36h11 family data for IDs 0–32, from AprilRobotics/apriltag tag36h11.c
 * (BSD 2-Clause, Copyright 2013-2016 The Regents of The University of Michigan).
 * Only the codes needed for the 2026 field are included.
 */

/** 36-bit codes as hex strings (exceeds 32-bit integer ops), indexed by tag ID. */
export const TAG36H11_CODES: readonly string[] = [
  'd7e00984b',
  'dda664ca7',
  'dc4a1c821',
  'e17b470e9',
  'ef91d01b1',
  'f429cdd73',
  '5da29225',
  '1106cba43',
  '223bed79d',
  '21f51213c',
  '33eb19ca6',
  '3f76eb0f8',
  '469a97414',
  '45dcfe0b0',
  '4a6465f72',
  '51801db96',
  '5eb946b4e',
  '68a7cc2ec',
  '6f0ba2652',
  '78765559d',
  '87b83d129',
  '86cc4a5c5',
  '8b64df90f',
  '9c577b611',
  'a3810f2f5',
  'af4d75b83',
  'b59a03fef',
  'bb1096f85',
  'd1b92fc76',
  'd0dd509d2',
  'e2cfda160',
  '2ff497c63',
  '47240671b',
];

/** Cell coordinates of each code bit (MSB first) inside the 6×6 data area. */
export const TAG36H11_BIT_X: readonly number[] = [
  1, 2, 3, 4, 5, 2, 3, 4, 3, 6, 6, 6, 6, 6, 5, 5, 5, 4, 6, 5, 4, 3, 2, 5, 4, 3, 4, 1, 1, 1, 1, 1, 2,
  2, 2, 3,
];
export const TAG36H11_BIT_Y: readonly number[] = [
  1, 1, 1, 1, 1, 2, 2, 2, 3, 1, 2, 3, 4, 5, 2, 3, 4, 3, 6, 6, 6, 6, 6, 5, 5, 5, 4, 6, 5, 4, 3, 2, 5,
  4, 3, 4,
];

/** Full tag width in cells: 1 white + 1 black border on each side around the 6×6 data. */
export const TAG36H11_TOTAL_CELLS = 10;
/** Width of the black square in cells (the 6.5in printed size). */
export const TAG36H11_BORDER_CELLS = 8;

/**
 * Returns the tag's 10×10 cell pattern, row-major from the top-left, `true` = white.
 * Follows apriltag_to_image(): white outer ring, black ring, then the 36 data bits.
 */
export function tag36h11Cells(id: number): boolean[] {
  const hex = TAG36H11_CODES[id];
  if (hex === undefined) throw new RangeError(`No tag36h11 code bundled for id ${id}`);
  const code = BigInt(`0x${hex}`);
  const n = TAG36H11_TOTAL_CELLS;
  const cells = new Array<boolean>(n * n).fill(false);
  for (let i = 0; i < n; i++) {
    cells[i] = cells[(n - 1) * n + i] = cells[i * n] = cells[i * n + n - 1] = true;
  }
  const borderStart = (n - TAG36H11_BORDER_CELLS) / 2;
  for (let bit = 0; bit < 36; bit++) {
    if ((code >> BigInt(35 - bit)) & 1n) {
      const x = TAG36H11_BIT_X[bit]! + borderStart;
      const y = TAG36H11_BIT_Y[bit]! + borderStart;
      cells[y * n + x] = true;
    }
  }
  return cells;
}
