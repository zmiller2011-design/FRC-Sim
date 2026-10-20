/**
 * 2026 REBUILT field dimensions.
 *
 * Every value is in INCHES as published, converted once with `inches()`. Each carries a
 * source tag:
 *   [GM]    2026 Game Manual (TU22), section 5 ARENA, as quoted in published excerpts
 *   [WPI]   WPILib 2026.2.2 official AprilTag layout JSON (derived from the field CAD)
 *   [6328]  FRC 6328 RobotCode2026Public FieldConstants.java (CAD-derived, MIT licence)
 *   [AM]    AndyMark official FUEL product listing
 *   [QA]    Official 2026 Q&A
 *   [APPROX] not verified against an official drawing; chosen to look and behave plausibly
 *
 * Per the manual, dimensions are nominal; the official drawings and CAD are authoritative.
 */
import { INCHES_TO_METERS } from '@/core';

export const inches = (value: number): number => value * INCHES_TO_METERS;

export const FIELD_IN = {
  /** [GM] guardrails form the long edges, 20.0in tall transparent polycarbonate. */
  guardrailHeight: 20.0,
  /** [APPROX] extrusion profile size and support spacing. */
  guardrailExtrusion: 1.5,
  guardrailPostSpacing: 78.0,
  /** [GM] 2in gaffer-style cloth tape unless stated otherwise. */
  tapeWidth: 2.0,
  /** [GM] NEUTRAL ZONE is 283in deep, centred on the CENTER LINE. */
  neutralZoneDepth: 283.0,
} as const;

export const HUB_IN = {
  /** [GM][6328] 47in × 47in rectangular prism. */
  width: 47.0,
  /** [GM][6328] front edge of the opening is 72in off the carpet (includes the catcher). */
  height: 72.0,
  /** [6328] "inner height" where FUEL enters the body. */
  bodyHeight: 56.5,
  /** [GM][6328] 41.7in hexagonal opening. Interpreted as across-flats. [APPROX] */
  openingAcrossFlats: 41.7,
  /** [WPI] HUB tag centres are 44.25in high. */
  tagHeight: 44.25,
  /** [APPROX] the manual describes a net at the back of the HUB but no height was found. */
  netTop: 108.0,
  /** [GM] four exits at the base facing the NEUTRAL ZONE. Exit size [APPROX]. */
  exitCount: 4,
  exitWidth: 9.0,
  exitHeight: 7.5,
} as const;

export const BUMP_IN = {
  /** [GM][6328] 73.0in wide, 44.4in deep, 6.513in tall, either side of the HUB. */
  width: 73.0,
  depth: 44.4,
  height: 6.513,
  /** [GM] top surface: 0.5in alliance-coloured HDPE ramps at 15°. */
  rampThickness: 0.5,
  rampAngleDeg: 15,
} as const;

export const TRENCH_IN = {
  /** [GM][6328] 65.65in wide, 47.0in deep, 40.25in tall; ROBOTS drive underneath. */
  width: 65.65,
  depth: 47.0,
  height: 40.25,
  /** [GM][6328] space under each arm is 50.34in wide and 22.25in tall. */
  openingWidth: 50.34,
  openingHeight: 22.25,
  /** [6328] arm (tag bar) thickness; [WPI] the back-to-back tags are 2.95in apart. */
  armThickness: 2.95,
} as const;

export const TOWER_IN = {
  /** [GM][6328] 49.25in wide, 45.0in deep, 78.25in tall. */
  width: 49.25,
  depth: 45.0,
  height: 78.25,
  /** [GM][6328] uprights 72.1in tall with 32.25in between them. */
  uprightHeight: 72.1,
  innerOpeningWidth: 32.25,
  /** [6328] upright centres sit 0.75in outside the opening ⇒ 1.5in uprights. */
  uprightSize: 1.5,
  /** [6328] front face of the uprights is 43.51in from the alliance wall. */
  frontFaceX: 43.51,
  /** [GM][6328] LOW, MID and HIGH RUNG centres: 27, 45 and 63in (18in apart). */
  rungHeights: [27.0, 45.0, 63.0],
  /** [APPROX] rung diameter (1.66in OD pipe) and base plate thickness. */
  rungDiameter: 1.66,
  basePlateThickness: 0.75,
} as const;

export const DEPOT_IN = {
  /** [GM][6328] 42.0in wide, 27.0in deep, along the ALLIANCE WALL. */
  width: 42.0,
  depth: 27.0,
  /** [GM] 3.0in wide, 1.0in tall steel barriers; hook fastener makes them ~1.125in. */
  barrierWidth: 3.0,
  barrierHeight: 1.125,
  /** [6328] depot centre is 75.93in left of the field's centre line (blue view). */
  centerOffsetY: 75.93,
} as const;

export const OUTPOST_IN = {
  /** [GM][6328] 31.8in wide × 7.0in tall opening, bottom edge 28.1in off the floor. */
  openingWidth: 31.8,
  openingHeight: 7.0,
  openingBottom: 28.1,
  /** [APPROX] CORRAL floor opening and CHUTE depth. */
  corralOpeningWidth: 31.8,
  corralOpeningHeight: 11.0,
  chuteDepth: 36.0,
} as const;

export const WALL_IN = {
  /** [GM] DRIVER STATION: 36.8in diamond-plate base, 42in transparent sheet, top rail. */
  baseHeight: 36.8,
  panelHeight: 42.0,
  /** [APPROX] rail height and wall thickness. */
  railHeight: 1.5,
  thickness: 2.5,
  /** [GM] operator shelf 69in wide × 12.25in deep. Mount height [APPROX]. */
  shelfWidth: 69.0,
  shelfDepth: 12.25,
  shelfHeight: 36.8,
  /** [APPROX] depth of the ALLIANCE AREA behind the wall. */
  areaDepth: 120.0,
  /** [GM] HUMAN STARTING LINE is 24in from the base of the ALLIANCE WALL. */
  humanLineOffset: 24.0,
  /** [APPROX] width of the OUTPOST wall section from the guardrail. */
  outpostSectionWidth: 50.0,
} as const;

export const FUEL_IN = {
  /** [AM][6328] 5.91in diameter high-density foam ball. */
  diameter: 5.91,
} as const;

export const FUEL = {
  /** [AM] 0.448–0.5 lb; midpoint used. */
  massKg: 0.474 * 0.45359237,
  /** [GM summary] 504 FUEL in total. */
  total: 504,
  /** [GM summary] 24 per DEPOT. */
  perDepot: 24,
  /** [GM summary] 24 per OUTPOST CHUTE ([QA] gives "approx. 25"; 24 keeps the 504 total). */
  perOutpost: 24,
  /** [GM] up to 8 per ROBOT, 48 in total; the rest are staged in the NEUTRAL ZONE. */
  maxPreloadPerRobot: 8,
} as const;

/** [6328] NEUTRAL ZONE starting FUEL area, centred on the field: 181.9in wide × 71.9in deep. */
export const FUEL_POOL_IN = { width: 181.9, depth: 71.9 } as const;

/** [6328] AprilTag printed size (black square). */
export const APRILTAG_SIZE_IN = 6.5;

/** Tag IDs used as anchors, blue side ([WPI]; usage per [6328]). */
export const ANCHOR_TAGS = {
  hubNearFace: 26,
  hubFarFace: 20,
  towerCenter: 31,
  outpostCenter: 29,
} as const;
