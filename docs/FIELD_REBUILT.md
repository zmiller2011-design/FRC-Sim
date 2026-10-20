# 2026 REBUILT field: sources, scale and validation

## Units and coordinate frames

| Quantity      | Convention                                                                                                                                                                                                                                                |
| ------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| World unit    | **1 unit = 1 metre** (= 39.3701 in). Inches are converted once with the exact factor 0.0254.                                                                                                                                                              |
| Field frame   | WPILib: origin at the blue alliance wall / right guardrail corner, +X toward red, +Y to the left (seen from blue), +Z up. Used by all field data, AprilTags and future robot poses.                                                                       |
| World frame   | Three.js Y-up: `world = (field.x, field.z, −field.y)`. One conversion, in `core/math/frames.ts` (vector form) and `render/field/fieldSpace.ts` (matrix form).                                                                                             |
| Element frame | Each element has a pose (x, y, yaw). Local +X points away from the element's own alliance wall. Red elements are the blue ones rotated 180° about the field centre: REBUILT is point-symmetric, and the official red tag poses match that within 0.04 mm. |

## Sources

| Tag    | Source                                                                                                                             | Used for                                                                                                      |
| ------ | ---------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------- |
| [WPI]  | WPILib 2026.2.2 AprilTag layouts `2026-rebuilt-welded.json` / `2026-rebuilt-andymark.json` (generated from the official field CAD) | Field size, all 32 tag poses, and the anchors every element is placed from                                    |
| [GM]   | 2026 Game Manual (TU22), section 5, via published excerpts                                                                         | Element dimensions, guardrails, driver stations, tape, zones, FUEL counts                                     |
| [6328] | FRC 6328 `RobotCode2026Public/FieldConstants.java` (CAD-derived, MIT)                                                              | Which tags anchor which elements; TOWER front face 43.51 in; DEPOT offset 75.93 in; FUEL pool 181.9 × 71.9 in |
| [AM]   | AndyMark official FUEL listing                                                                                                     | FUEL 5.91 in, 0.448–0.5 lb                                                                                    |
| [QA]   | Official 2026 Q&A                                                                                                                  | CHUTE capacity "approx. 25"                                                                                   |
| [AT]   | AprilRobotics `apriltag` tag36h11 family and `apriltag-imgs`                                                                       | Tag patterns; verified against the official images for IDs 0, 1, 20, 26 and 32                                |

**Not accessed:** the environment's network policy blocks `firstinspires.org` and `firstfrc.blob.core.windows.net`, so the official drawing PDFs, the Onshape CAD and the manual PDF could not be opened directly. Manual numbers come from quoted excerpts, cross-checked against the WPILib tag data and 6328's CAD-derived constants wherever possible.

All values live in `src/game/seasons/rebuilt2026/dimensions.ts`, each tagged with its source.

## Validation against official data

The derived positions below are produced by `createRebuiltField()` and enforced by `tests/field/rebuiltField.test.ts`.

| Item                           | Official                                                                          | Implemented                                                          | Δ                                       |
| ------------------------------ | --------------------------------------------------------------------------------- | -------------------------------------------------------------------- | --------------------------------------- |
| Field size (welded)            | 16.541 × 8.069 m [WPI]                                                            | 16.541 × 8.069 m                                                     | 0                                       |
| Field size (AndyMark)          | 16.518 × 8.043 m [WPI]                                                            | 16.518 × 8.043 m                                                     | 0                                       |
| HUB centre X (blue)            | midpoint of tags 26/20 = 182.11 in [WPI]                                          | 182.11 in                                                            | 0                                       |
| HUB centre Y                   | field centreline [WPI tags 18/21]                                                 | 158.85 in                                                            | 0                                       |
| Red HUB centre X               | midpoint of tags 4/10 = 469.11 in [WPI]                                           | 469.11 in                                                            | 0.04 mm                                 |
| HUB footprint / opening height | 47 × 47 in, 72 in [GM]                                                            | same                                                                 | 0                                       |
| BUMPS                          | 73 × 44.4 × 6.513 in, flush to HUB sides [GM][6328]                               | same; centres at Y = 98.84 / 218.84 in                               | 0                                       |
| BUMP ramp angle                | 15° [GM]                                                                          | 15.11° (derived from height, depth and 0.5 in HDPE)                  | 0.11°                                   |
| TRENCH opening                 | 50.34 × 22.25 in from the guardrail [GM]                                          | same; arm centred on tags 17/28                                      | < 0.2 mm                                |
| TOWER                          | centre at tag 31 Y = 147.47 in, front face 43.51 in, rungs 27/45/63 in [6328][GM] | same                                                                 | 0                                       |
| DEPOT                          | 42 × 27 in, centre 75.93 in left of centreline, 3 × 1.125 in barriers [GM][6328]  | Y = 234.77 in                                                        | 0                                       |
| OUTPOST opening                | 31.8 × 7.0 in, bottom 28.1 in, centred on tag 29 [GM][6328]                       | Y = 26.22 in                                                         | 0                                       |
| ROBOT STARTING LINE            | ALLIANCE ZONE edge: tag 26 X = 158.34 in [WPI] (manual quotes ≈158.6 in)          | 158.34 in, tape inside the zone                                      | 0.26 in vs manual (tag plate thickness) |
| NEUTRAL ZONE depth             | 283 in [GM]                                                                       | 283 in (zone definition)                                             | 0                                       |
| Guardrail height               | 20.0 in [GM]                                                                      | 20.0 in                                                              | 0                                       |
| Driver station                 | 36.8 in base + 42 in panel; shelf 69 × 12.25 in [GM]                              | same                                                                 | 0                                       |
| AprilTags                      | 32 poses, 6.5 in [WPI][6328]                                                      | exact poses; patterns verified [AT]                                  | 0                                       |
| FUEL                           | 5.91 in, 504 total, 24 per DEPOT, 24 per OUTPOST, ≤ 8 preload per robot [AM][GM]  | same; 408 in the NEUTRAL ZONE with no robots (360 with 48 preloaded) | 0                                       |

## Approximations (not verified against an official drawing)

1. **HUB appearance.** Panel layout, lit band, catcher funnel taper, net height (108 in), and the four exits' size (9 × 7.5 in). The 41.7 in hexagon is read as across-flats.
2. **TRENCH structure.** The tag arm is modelled as a solid 2.95 in panel. The inner leg is 12.0 in wide, which is the gap to the BUMP. The published 65.65 in overall width would overlap the BUMP by 3.3 in, so that remainder is assumed to be mounting outside the guardrail.
3. **TOWER details.** Rung diameter (1.66 in), base plate thickness (0.75 in), back bracing and header panel.
4. **OUTPOST behind the wall.** CHUTE slope (15°) and depth (36 in), CORRAL bin, and the CORRAL opening (31.8 × 11 in). The CHUTE holds 24 FUEL to keep the 504 total; the Q&A says "approx. 25".
5. **ALLIANCE WALL layout.** The order (OUTPOST, DS, TOWER WALL, DS, DS) follows the tag positions, but the segment widths (~72.8 in per station), wall thickness (2.5 in), top rail and shelf height are assumed. Station numbers are not shown.
6. **CENTER LINE colour** is drawn white (not confirmed).
7. **NEUTRAL ZONE FUEL arrangement.** The manual's figure (6.3.4.1) was not available. FUEL is packed in staggered, point-symmetric rows inside the published pool. 408 balls of 5.91 in cannot fit 71.9 in of depth in one layer, so the packed depth is 72.9 in (+1.0 in).
8. **Venue.** ALLIANCE AREA depth (120 in), pipe-and-drape, sideline lighting trusses and the driver eye position (0.9 m behind the wall, 1.65 m high).
9. **AndyMark variant.** Only the field size and tag-anchored positions change; element dimensions are assumed identical to the welded field.

## Collision geometry

`FieldConfig.colliders` holds 56 simple shapes (boxes, horizontal cylinders and one convex hull per BUMP), separate from the visual meshes. Toggle **Settings → Field → Show collision geometry** to see them. The physics engine is not integrated yet.

| Element       | Shapes                                               |
| ------------- | ---------------------------------------------------- |
| Guardrails    | 2 boxes                                              |
| ALLIANCE WALL | 1 box per segment (5 per alliance)                   |
| HUB           | body box, 4 catcher walls, net panel                 |
| BUMP          | convex hull (exact triangular prism)                 |
| TRENCH        | arm box (bottom at 22.25 in), leg box                |
| TOWER         | base plate, 2 uprights, back frame, 3 rung cylinders |
| DEPOT         | 3 barrier boxes                                      |

## Rendering budget

The static field is merged into **one mesh per material (~22 draw calls)**, and the 504 FUEL are a single instanced mesh. AprilTags share one texture atlas and one draw call. The field is built once at start-up and rebuilt only when switching between the welded and AndyMark variants. **Reset field** rewrites the FUEL instance matrices only.
