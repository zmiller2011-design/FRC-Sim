import type { Vec3 } from '@/core';
import {
  localBox,
  localConvex,
  localCylinderY,
  localToField,
  mirrorPose,
} from '@/field/transforms';
import type {
  Alliance,
  AllianceWallDims,
  BumpDims,
  ColliderDesc,
  DepotDims,
  ElementPose,
  FieldConfig,
  FieldElement,
  HubDims,
  MarkingLine,
  OutpostDims,
  ScoringTarget,
  TagPose,
  TowerDims,
  TrenchDims,
  ZoneDef,
} from '@/field/types';
import { ANDYMARK_FIELD, ANDYMARK_TAGS, WELDED_FIELD, WELDED_TAGS } from './aprilTags';
import {
  ANCHOR_TAGS,
  APRILTAG_SIZE_IN,
  BUMP_IN,
  DEPOT_IN,
  FIELD_IN,
  FUEL,
  FUEL_IN,
  FUEL_POOL_IN,
  HUB_IN,
  inches,
  OUTPOST_IN,
  TOWER_IN,
  TRENCH_IN,
  WALL_IN,
} from './dimensions';
import { generateFuelSpawns } from './fuel';

export type RebuiltVariant = 'welded' | 'andymark';

export interface RebuiltFieldOptions {
  variant?: RebuiltVariant;
  /** FUEL preloaded into robots; it is taken out of the NEUTRAL ZONE allotment (max 48). */
  preloadedFuel?: number;
}

const VARIANTS = {
  welded: { field: WELDED_FIELD, tags: WELDED_TAGS, label: 'Welded field' },
  andymark: { field: ANDYMARK_FIELD, tags: ANDYMARK_TAGS, label: 'AndyMark field' },
} as const;

function tag(tags: readonly TagPose[], id: number): TagPose {
  const found = tags.find((t) => t.id === id);
  if (!found) throw new Error(`AprilTag ${id} missing from the layout`);
  return found;
}

/** Element dimensions in metres. */
export const REBUILT_DIMS = {
  hub: {
    width: inches(HUB_IN.width),
    height: inches(HUB_IN.height),
    bodyHeight: inches(HUB_IN.bodyHeight),
    openingAcrossFlats: inches(HUB_IN.openingAcrossFlats),
    tagHeight: inches(HUB_IN.tagHeight),
    netTop: inches(HUB_IN.netTop),
    exitCount: HUB_IN.exitCount,
    exitWidth: inches(HUB_IN.exitWidth),
    exitHeight: inches(HUB_IN.exitHeight),
  } satisfies HubDims,
  bump: {
    width: inches(BUMP_IN.width),
    depth: inches(BUMP_IN.depth),
    height: inches(BUMP_IN.height),
    rampThickness: inches(BUMP_IN.rampThickness),
    rampAngle: (BUMP_IN.rampAngleDeg * Math.PI) / 180,
  } satisfies BumpDims,
  trench: {
    width: inches(TRENCH_IN.width),
    depth: inches(TRENCH_IN.depth),
    height: inches(TRENCH_IN.height),
    openingWidth: inches(TRENCH_IN.openingWidth),
    openingHeight: inches(TRENCH_IN.openingHeight),
    armThickness: inches(TRENCH_IN.armThickness),
  },
  tower: {
    width: inches(TOWER_IN.width),
    depth: inches(TOWER_IN.depth),
    height: inches(TOWER_IN.height),
    uprightHeight: inches(TOWER_IN.uprightHeight),
    innerOpeningWidth: inches(TOWER_IN.innerOpeningWidth),
    uprightSize: inches(TOWER_IN.uprightSize),
    frontFaceX: inches(TOWER_IN.frontFaceX),
    rungHeights: [
      inches(TOWER_IN.rungHeights[0]),
      inches(TOWER_IN.rungHeights[1]),
      inches(TOWER_IN.rungHeights[2]),
    ],
    rungRadius: inches(TOWER_IN.rungDiameter / 2),
    basePlateThickness: inches(TOWER_IN.basePlateThickness),
  } satisfies TowerDims,
  depot: {
    width: inches(DEPOT_IN.width),
    depth: inches(DEPOT_IN.depth),
    barrierWidth: inches(DEPOT_IN.barrierWidth),
    barrierHeight: inches(DEPOT_IN.barrierHeight),
  } satisfies DepotDims,
  outpost: {
    openingWidth: inches(OUTPOST_IN.openingWidth),
    openingHeight: inches(OUTPOST_IN.openingHeight),
    openingBottom: inches(OUTPOST_IN.openingBottom),
    corralOpeningWidth: inches(OUTPOST_IN.corralOpeningWidth),
    corralOpeningHeight: inches(OUTPOST_IN.corralOpeningHeight),
    chuteDepth: inches(OUTPOST_IN.chuteDepth),
  } satisfies OutpostDims,
} as const;

/** Key positions on the blue half, derived from the official tag layout. */
export interface RebuiltAnchors {
  lengthM: number;
  widthM: number;
  hubCenterX: number;
  startingLineX: number;
  towerCenterY: number;
  outpostCenterY: number;
  depotCenterY: number;
}

export function rebuiltAnchors(variant: RebuiltVariant): RebuiltAnchors {
  const { field, tags } = VARIANTS[variant];
  const widthM = field.widthM;
  const near = tag(tags, ANCHOR_TAGS.hubNearFace);
  const far = tag(tags, ANCHOR_TAGS.hubFarFace);
  return {
    lengthM: field.lengthM,
    widthM,
    // Midpoint of the near- and far-face tags. (Near face + 23.5in is 6.8 mm short because
    // the tag plates stand slightly proud of the 47in structure.)
    hubCenterX: (near.x + far.x) / 2,
    startingLineX: near.x,
    towerCenterY: tag(tags, ANCHOR_TAGS.towerCenter).y,
    outpostCenterY: tag(tags, ANCHOR_TAGS.outpostCenter).y,
    depotCenterY: widthM / 2 + inches(DEPOT_IN.centerOffsetY),
  };
}

function wallDims(a: RebuiltAnchors): AllianceWallDims {
  const towerHalf = REBUILT_DIMS.tower.width / 2;
  const towerFrom = a.towerCenterY - towerHalf;
  const towerTo = a.towerCenterY + towerHalf;
  const outpostTo = inches(WALL_IN.outpostSectionWidth);
  // [APPROX] The manual lists the wall as 3 DRIVER STATIONS, an OUTPOST and a TOWER WALL.
  // Segment widths are not published; the two stations left of the tower split that span.
  const leftSplit = (towerTo + a.widthM) / 2;
  return {
    segments: [
      { kind: 'outpost', from: 0, to: outpostTo, label: 'Outpost' },
      { kind: 'driverStation', from: outpostTo, to: towerFrom, label: 'Driver Station' },
      { kind: 'towerWall', from: towerFrom, to: towerTo, label: 'Tower Wall' },
      { kind: 'driverStation', from: towerTo, to: leftSplit, label: 'Driver Station' },
      { kind: 'driverStation', from: leftSplit, to: a.widthM, label: 'Driver Station' },
    ],
    baseHeight: inches(WALL_IN.baseHeight),
    panelHeight: inches(WALL_IN.panelHeight),
    railHeight: inches(WALL_IN.railHeight),
    thickness: inches(WALL_IN.thickness),
    shelfWidth: inches(WALL_IN.shelfWidth),
    shelfDepth: inches(WALL_IN.shelfDepth),
    shelfHeight: inches(WALL_IN.shelfHeight),
    areaDepth: inches(WALL_IN.areaDepth),
    humanLineOffset: inches(WALL_IN.humanLineOffset),
  };
}

/** Blue-side element placements. Red placements are their point reflections. */
function blueElements(a: RebuiltAnchors): FieldElement[] {
  const d = REBUILT_DIMS;
  const midY = a.widthM / 2;
  const bumpOffset = d.hub.width / 2 + d.bump.width / 2;
  // The BUMP's outer edge, measured from the guardrail. The leg fills the gap between the
  // TRENCH opening and the BUMP: 12.0in on the welded field (6328: "12in"). The published
  // 65.65in overall width would overlap the BUMP by 3.3in, so the remainder is assumed to be
  // mounting outside the guardrail. [APPROX]
  const bumpEdge = midY - d.hub.width / 2 - d.bump.width;
  const trench: TrenchDims = { ...d.trench, legWidth: bumpEdge - d.trench.openingWidth };
  const alliance: Alliance = 'blue';
  return [
    { type: 'allianceWall', id: 'wall', alliance, pose: { x: 0, y: 0, yaw: 0 }, dims: wallDims(a) },
    { type: 'hub', id: 'hub', alliance, pose: { x: a.hubCenterX, y: midY, yaw: 0 }, dims: d.hub },
    {
      type: 'bump',
      id: 'bump-right',
      alliance,
      pose: { x: a.hubCenterX, y: midY - bumpOffset, yaw: 0 },
      dims: d.bump,
    },
    {
      type: 'bump',
      id: 'bump-left',
      alliance,
      pose: { x: a.hubCenterX, y: midY + bumpOffset, yaw: 0 },
      dims: d.bump,
    },
    // Trench local +Y runs from its guardrail inward, so the left one is turned around.
    {
      type: 'trench',
      id: 'trench-right',
      alliance,
      pose: { x: a.hubCenterX, y: 0, yaw: 0 },
      dims: trench,
    },
    {
      type: 'trench',
      id: 'trench-left',
      alliance,
      pose: { x: a.hubCenterX, y: a.widthM, yaw: Math.PI },
      dims: trench,
    },
    {
      type: 'tower',
      id: 'tower',
      alliance,
      pose: { x: 0, y: a.towerCenterY, yaw: 0 },
      dims: d.tower,
    },
    {
      type: 'depot',
      id: 'depot',
      alliance,
      pose: { x: 0, y: a.depotCenterY, yaw: 0 },
      dims: d.depot,
    },
    {
      type: 'outpost',
      id: 'outpost',
      alliance,
      pose: { x: 0, y: a.outpostCenterY, yaw: 0 },
      dims: d.outpost,
    },
  ];
}

function mirrorElement(e: FieldElement, a: RebuiltAnchors): FieldElement {
  return {
    ...e,
    alliance: 'red',
    pose: mirrorPose(e.pose, a.lengthM, a.widthM),
  } as FieldElement;
}

// ---------------------------------------------------------------------------
// Collision geometry
// ---------------------------------------------------------------------------

const v = (x: number, y: number, z: number): Vec3 => ({ x, y, z });

function elementColliders(e: FieldElement): ColliderDesc[] {
  const owner = `${e.alliance}-${e.id}`;
  const p = e.pose;
  switch (e.type) {
    case 'hub': {
      const { width: w, bodyHeight: bh, height: h, netTop } = e.dims;
      const wall = inches(1);
      const catcher = h - bh;
      return [
        localBox(owner, p, v(0, 0, bh / 2), v(w, w, bh)),
        // Catcher rim: four thin walls around the opening.
        localBox(owner, p, v(-w / 2 + wall / 2, 0, bh + catcher / 2), v(wall, w, catcher)),
        localBox(owner, p, v(w / 2 - wall / 2, 0, bh + catcher / 2), v(wall, w, catcher)),
        localBox(owner, p, v(0, -w / 2 + wall / 2, bh + catcher / 2), v(w, wall, catcher)),
        localBox(owner, p, v(0, w / 2 - wall / 2, bh + catcher / 2), v(w, wall, catcher)),
        // Net on the neutral-zone side.
        localBox(owner, p, v(w / 2, 0, (h + netTop) / 2), v(wall, w, netTop - h)),
      ];
    }
    case 'bump': {
      const { width, depth, height } = e.dims;
      const hy = width / 2;
      const hx = depth / 2;
      return [
        localConvex(owner, p, [
          v(-hx, -hy, 0),
          v(hx, -hy, 0),
          v(0, -hy, height),
          v(-hx, hy, 0),
          v(hx, hy, 0),
          v(0, hy, height),
        ]),
      ];
    }
    case 'trench': {
      const t = e.dims;
      const legWidth = t.legWidth;
      const armHeight = t.height - t.openingHeight;
      return [
        // Arm spanning the opening (robots pass beneath it).
        localBox(
          owner,
          p,
          v(0, t.openingWidth / 2, t.openingHeight + armHeight / 2),
          v(t.depth, t.openingWidth, armHeight),
        ),
        // Inner leg between the opening and the BUMP.
        localBox(
          owner,
          p,
          v(0, t.openingWidth + legWidth / 2, t.height / 2),
          v(t.depth, legWidth, t.height),
        ),
      ];
    }
    case 'tower': {
      const t = e.dims;
      const halfSpan = t.innerOpeningWidth / 2 + t.uprightSize / 2;
      const ux = t.frontFaceX - t.uprightSize / 2;
      const rungLength = t.innerOpeningWidth + 2 * t.uprightSize;
      return [
        localBox(
          owner,
          p,
          v(t.depth / 2, 0, t.basePlateThickness / 2),
          v(t.depth, t.width, t.basePlateThickness),
        ),
        localBox(
          owner,
          p,
          v(ux, -halfSpan, t.uprightHeight / 2),
          v(t.uprightSize, t.uprightSize, t.uprightHeight),
        ),
        localBox(
          owner,
          p,
          v(ux, halfSpan, t.uprightHeight / 2),
          v(t.uprightSize, t.uprightSize, t.uprightHeight),
        ),
        // Back frame from the uprights to the wall.
        localBox(
          owner,
          p,
          v(ux / 2, 0, (t.uprightHeight + t.height) / 2),
          v(ux, t.width, t.height - t.uprightHeight),
        ),
        ...t.rungHeights.map((z) =>
          localCylinderY(owner, p, v(ux, 0, z), t.rungRadius, rungLength),
        ),
      ];
    }
    case 'depot': {
      const t = e.dims;
      const hy = t.width / 2;
      return [
        localBox(
          owner,
          p,
          v(t.depth - t.barrierWidth / 2, 0, t.barrierHeight / 2),
          v(t.barrierWidth, t.width, t.barrierHeight),
        ),
        localBox(
          owner,
          p,
          v(t.depth / 2, -hy + t.barrierWidth / 2, t.barrierHeight / 2),
          v(t.depth, t.barrierWidth, t.barrierHeight),
        ),
        localBox(
          owner,
          p,
          v(t.depth / 2, hy - t.barrierWidth / 2, t.barrierHeight / 2),
          v(t.depth, t.barrierWidth, t.barrierHeight),
        ),
      ];
    }
    case 'outpost':
      // The OUTPOST is part of the alliance wall's collider.
      return [];
    case 'allianceWall': {
      const t = e.dims;
      const height = t.baseHeight + t.panelHeight + t.railHeight;
      return t.segments.map((seg) =>
        localBox(
          owner,
          p,
          v(-t.thickness / 2, (seg.from + seg.to) / 2, height / 2),
          v(t.thickness, seg.to - seg.from, height),
        ),
      );
    }
  }
}

function guardrailColliders(lengthM: number, widthM: number, height: number): ColliderDesc[] {
  const thickness = inches(1.5);
  const pose: ElementPose = { x: 0, y: 0, yaw: 0 };
  return [
    localBox(
      'guardrail-right',
      pose,
      v(lengthM / 2, -thickness / 2, height / 2),
      v(lengthM, thickness, height),
    ),
    localBox(
      'guardrail-left',
      pose,
      v(lengthM / 2, widthM + thickness / 2, height / 2),
      v(lengthM, thickness, height),
    ),
  ];
}

// ---------------------------------------------------------------------------
// Markings, zones and scoring targets
// ---------------------------------------------------------------------------

function markings(a: RebuiltAnchors): MarkingLine[] {
  const tape = inches(FIELD_IN.tapeWidth);
  const human = inches(WALL_IN.humanLineOffset);
  const L = a.lengthM;
  const W = a.widthM;
  // The ROBOT STARTING LINE is the ALLIANCE ZONE edge; tape lies inside the zone.
  const startX = a.startingLineX - tape / 2;
  return [
    {
      id: 'start-blue',
      color: 'blue',
      start: { x: startX, y: 0 },
      end: { x: startX, y: W },
      width: tape,
    },
    {
      id: 'start-red',
      color: 'red',
      start: { x: L - startX, y: 0 },
      end: { x: L - startX, y: W },
      width: tape,
    },
    // [APPROX] CENTER LINE colour was not verified; drawn white.
    {
      id: 'center',
      color: 'white',
      start: { x: L / 2, y: 0 },
      end: { x: L / 2, y: W },
      width: tape,
    },
    // HUMAN STARTING LINES lie in the ALLIANCE AREAS behind the walls.
    {
      id: 'human-blue',
      color: 'white',
      start: { x: -human, y: 0 },
      end: { x: -human, y: W },
      width: tape,
    },
    {
      id: 'human-red',
      color: 'white',
      start: { x: L + human, y: 0 },
      end: { x: L + human, y: W },
      width: tape,
    },
  ];
}

function zones(a: RebuiltAnchors): ZoneDef[] {
  const L = a.lengthM;
  const W = a.widthM;
  const halfNeutral = inches(FIELD_IN.neutralZoneDepth) / 2;
  return [
    {
      id: 'alliance-zone-blue',
      alliance: 'blue',
      minX: 0,
      maxX: a.startingLineX,
      minY: 0,
      maxY: W,
    },
    {
      id: 'alliance-zone-red',
      alliance: 'red',
      minX: L - a.startingLineX,
      maxX: L,
      minY: 0,
      maxY: W,
    },
    {
      id: 'neutral-zone',
      alliance: null,
      minX: L / 2 - halfNeutral,
      maxX: L / 2 + halfNeutral,
      minY: 0,
      maxY: W,
    },
  ];
}

function scoringTargets(elements: FieldElement[]): ScoringTarget[] {
  const targets: ScoringTarget[] = [];
  for (const e of elements) {
    if (e.type === 'hub') {
      const c = localToField(e.pose, 0, 0, e.dims.height);
      targets.push({
        kind: 'hubOpening',
        id: `${e.alliance}-hub`,
        alliance: e.alliance,
        center: c,
        radius: e.dims.openingAcrossFlats / 2 / Math.cos(Math.PI / 6),
      });
    } else if (e.type === 'tower') {
      const t = e.dims;
      const ux = t.frontFaceX - t.uprightSize / 2;
      const half = t.innerOpeningWidth / 2;
      t.rungHeights.forEach((z, i) => {
        targets.push({
          kind: 'rung',
          id: `${e.alliance}-rung-${i + 1}`,
          alliance: e.alliance,
          level: (i + 1) as 1 | 2 | 3,
          start: localToField(e.pose, ux, -half, z),
          end: localToField(e.pose, ux, half, z),
          radius: t.rungRadius,
        });
      });
    }
  }
  return targets;
}

// ---------------------------------------------------------------------------

/** Builds the complete, typed 2026 REBUILT field configuration. */
export function createRebuiltField(options: RebuiltFieldOptions = {}): FieldConfig {
  const variant = options.variant ?? 'welded';
  const preloadedFuel = Math.min(
    Math.max(options.preloadedFuel ?? 0, 0),
    FUEL.maxPreloadPerRobot * 6,
  );
  const a = rebuiltAnchors(variant);
  const blue = blueElements(a);
  const elements = [...blue, ...blue.map((e) => mirrorElement(e, a))];
  const guardrailHeight = inches(FIELD_IN.guardrailHeight);

  return {
    season: '2026',
    gameName: 'REBUILT',
    variant: { id: variant, label: VARIANTS[variant].label },
    lengthM: a.lengthM,
    widthM: a.widthM,
    guardrail: {
      height: guardrailHeight,
      extrusion: inches(FIELD_IN.guardrailExtrusion),
      postSpacing: inches(FIELD_IN.guardrailPostSpacing),
    },
    elements,
    aprilTags: VARIANTS[variant].tags,
    aprilTagSizeM: inches(APRILTAG_SIZE_IN),
    markings: markings(a),
    zones: zones(a),
    scoringTargets: scoringTargets(elements),
    colliders: [
      ...guardrailColliders(a.lengthM, a.widthM, guardrailHeight),
      ...elements.flatMap(elementColliders),
    ],
    gamePiece: {
      id: 'fuel',
      shape: 'sphere',
      radius: inches(FUEL_IN.diameter) / 2,
      massKg: FUEL.massKg,
    },
    pieceSpawns: generateFuelSpawns({
      anchors: a,
      elements,
      fuelRadius: inches(FUEL_IN.diameter) / 2,
      neutralCount: FUEL.total - 2 * FUEL.perDepot - 2 * FUEL.perOutpost - preloadedFuel,
      poolWidth: inches(FUEL_POOL_IN.width),
      poolDepth: inches(FUEL_POOL_IN.depth),
      perDepot: FUEL.perDepot,
      perOutpost: FUEL.perOutpost,
    }),
  };
}
