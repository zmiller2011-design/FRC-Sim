/**
 * Season-independent field description. Pure data: no Three.js, no physics engine.
 *
 * Units and frames
 * - All lengths are metres, all angles radians, unless a name says otherwise (`yawDeg`).
 * - Positions use the WPILib field frame: origin at the blue alliance wall / right guardrail
 *   corner, +X toward the red alliance wall, +Y toward the left guardrail (seen from blue),
 *   +Z up. 1 world unit = 1 m = 39.3701 in. See core/math/frames.ts for the world mapping.
 * - Field elements are placed with a {@link ElementPose}. Their geometry is described in a
 *   local frame whose +X points away from the element's own alliance wall. Red elements are
 *   the blue ones rotated 180° about the field centre (REBUILT is point-symmetric).
 */
import type { Vec3 } from '@/core';

export type Alliance = 'blue' | 'red';

export interface FieldVariantInfo {
  /** Official field construction this configuration describes. */
  id: 'welded' | 'andymark';
  label: string;
}

/** Position and heading of an element on the field (floor level). */
export interface ElementPose {
  x: number;
  y: number;
  yaw: number;
}

export interface TagPose {
  id: number;
  /** Centre of the tag, field frame. */
  x: number;
  y: number;
  z: number;
  /** Direction the tag faces (its outward normal), degrees CCW from +X. */
  yawDeg: number;
}

// ---------------------------------------------------------------------------
// Collision geometry (kept separate from visual meshes; simple primitives only)
// ---------------------------------------------------------------------------

interface ColliderBase {
  /** Element that owns this shape, for debugging and filtering. */
  owner: string;
}

/** Oriented box. `center` is the box centre; `yaw` rotates about +Z. */
export interface BoxCollider extends ColliderBase {
  kind: 'box';
  center: Vec3;
  /** Half sizes along the box's own x, y, z axes. */
  halfExtents: Vec3;
  yaw: number;
  /** Optional rotation about the box's own +Y axis (applied before yaw), radians. */
  pitch?: number;
}

/** Cylinder whose axis is horizontal (for rungs) or vertical (for posts). */
export interface CylinderCollider extends ColliderBase {
  kind: 'cylinder';
  center: Vec3;
  radius: number;
  halfLength: number;
  /** 'z' = vertical; 'horizontal' = lies along `yaw` direction. */
  axis: 'z' | 'horizontal';
  yaw: number;
}

/** Convex hull of field-frame points (used for wedge-shaped ramps). */
export interface ConvexCollider extends ColliderBase {
  kind: 'convex';
  points: Vec3[];
}

export type ColliderDesc = BoxCollider | CylinderCollider | ConvexCollider;

// ---------------------------------------------------------------------------
// Rules-facing geometry
// ---------------------------------------------------------------------------

/** Axis-aligned floor region, infinitely tall unless `maxZ` is given. */
export interface ZoneDef {
  id: string;
  alliance: Alliance | null;
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
  maxZ?: number;
}

export type ScoringTarget =
  | {
      kind: 'hubOpening';
      id: string;
      alliance: Alliance;
      /** Centre of the hexagonal opening at its top edge. */
      center: Vec3;
      /** Circumradius of the hexagonal opening. */
      radius: number;
    }
  | {
      kind: 'rung';
      id: string;
      alliance: Alliance;
      level: 1 | 2 | 3;
      /** Endpoints of the rung centreline. */
      start: Vec3;
      end: Vec3;
      radius: number;
    };

/** A floor tape line, drawn as a strip of `width` from `start` to `end`. */
export interface MarkingLine {
  id: string;
  color: 'white' | Alliance;
  start: { x: number; y: number };
  end: { x: number; y: number };
  width: number;
}

// ---------------------------------------------------------------------------
// Game pieces
// ---------------------------------------------------------------------------

export type PieceLocation = 'neutral' | 'depot' | 'outpost' | 'preload';

export interface PieceSpawn {
  /** Centre of the piece, field frame. */
  position: Vec3;
  location: PieceLocation;
  alliance: Alliance | null;
}

export interface GamePieceSpec {
  id: string;
  shape: 'sphere';
  radius: number;
  /** Nominal mass in kilograms. */
  massKg: number;
}

// ---------------------------------------------------------------------------
// Whole field
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Element dimensions (metres). Each element carries its own so renderers and
// physics builders need nothing but the config.
// ---------------------------------------------------------------------------

export interface HubDims {
  /** Square footprint side. */
  width: number;
  /** Height of the opening's front edge (top of the catcher). */
  height: number;
  /** Height where FUEL drops into the body (top of the box structure). */
  bodyHeight: number;
  /** Hexagonal opening size across flats. */
  openingAcrossFlats: number;
  /** Height of the AprilTag centres on the faces. */
  tagHeight: number;
  /** Top of the net on the back (neutral-zone) side. */
  netTop: number;
  exitCount: number;
  exitWidth: number;
  exitHeight: number;
}

export interface BumpDims {
  /** Along the element's local Y (across the field). */
  width: number;
  /** Along the element's local X (toward the opposite wall). */
  depth: number;
  height: number;
  rampThickness: number;
  /** Ramp angle from the floor, radians. */
  rampAngle: number;
}

export interface TrenchDims {
  /** Overall size along local Y (from the guardrail inward). */
  width: number;
  /** Overall size along local X. */
  depth: number;
  height: number;
  /** Clear opening robots drive through: from the guardrail along local Y. */
  openingWidth: number;
  openingHeight: number;
  /** Thickness of the tag-carrying arm across the opening. */
  armThickness: number;
  /** Width of the inner support leg between the opening and the neighbouring BUMP. */
  legWidth: number;
}

export interface TowerDims {
  /** Along local Y (parallel to the wall). */
  width: number;
  /** Along local X (out from the wall). */
  depth: number;
  height: number;
  uprightHeight: number;
  /** Clear distance between the uprights. */
  innerOpeningWidth: number;
  uprightSize: number;
  /** Distance of the uprights' front face from the alliance wall. */
  frontFaceX: number;
  /** Rung centre heights for LEVEL 1, 2 and 3. */
  rungHeights: readonly [number, number, number];
  rungRadius: number;
  basePlateThickness: number;
}

export interface DepotDims {
  /** Along local Y (parallel to the wall). */
  width: number;
  /** Along local X (out from the wall). */
  depth: number;
  barrierWidth: number;
  barrierHeight: number;
}

export interface OutpostDims {
  openingWidth: number;
  openingHeight: number;
  /** Height of the opening's bottom edge above the carpet. */
  openingBottom: number;
  /** Floor-level CORRAL opening robots push FUEL into. */
  corralOpeningWidth: number;
  corralOpeningHeight: number;
  /** Depth of the CHUTE behind the wall (into the alliance area). */
  chuteDepth: number;
}

export type WallSegmentKind = 'driverStation' | 'towerWall' | 'outpost';

export interface AllianceWallDims {
  /** Wall segments along local Y, measured from the right guardrail (seen by that alliance). */
  segments: readonly { kind: WallSegmentKind; from: number; to: number; label: string }[];
  /** Diamond-plate base height. */
  baseHeight: number;
  /** Transparent panel height above the base. */
  panelHeight: number;
  railHeight: number;
  thickness: number;
  shelfWidth: number;
  shelfDepth: number;
  shelfHeight: number;
  /** Depth of the ALLIANCE AREA behind the wall where drivers stand. */
  areaDepth: number;
  /** Distance of the HUMAN STARTING LINE from the wall. */
  humanLineOffset: number;
}

export interface GuardrailDims {
  height: number;
  /** Aluminium extrusion size (square) along the top and bottom. */
  extrusion: number;
  /** Spacing of the vertical support posts. */
  postSpacing: number;
}

/** Every element type the REBUILT field uses. Renderers dispatch on `type`. */
export type FieldElement =
  | { type: 'hub'; id: string; alliance: Alliance; pose: ElementPose; dims: HubDims }
  | { type: 'bump'; id: string; alliance: Alliance; pose: ElementPose; dims: BumpDims }
  | { type: 'trench'; id: string; alliance: Alliance; pose: ElementPose; dims: TrenchDims }
  | { type: 'tower'; id: string; alliance: Alliance; pose: ElementPose; dims: TowerDims }
  | { type: 'depot'; id: string; alliance: Alliance; pose: ElementPose; dims: DepotDims }
  | { type: 'outpost'; id: string; alliance: Alliance; pose: ElementPose; dims: OutpostDims }
  | {
      type: 'allianceWall';
      id: string;
      alliance: Alliance;
      pose: ElementPose;
      dims: AllianceWallDims;
    };

export type FieldElementType = FieldElement['type'];

export interface FieldConfig {
  season: string;
  gameName: string;
  variant: FieldVariantInfo;
  /** Inside dimensions of the carpeted playing area. */
  lengthM: number;
  widthM: number;
  guardrail: GuardrailDims;
  elements: FieldElement[];
  aprilTags: readonly TagPose[];
  /** Printed tag size (black square), metres. */
  aprilTagSizeM: number;
  markings: MarkingLine[];
  zones: ZoneDef[];
  scoringTargets: ScoringTarget[];
  colliders: ColliderDesc[];
  gamePiece: GamePieceSpec;
  /** Starting configuration of every game piece on and around the field. */
  pieceSpawns: PieceSpawn[];
}
