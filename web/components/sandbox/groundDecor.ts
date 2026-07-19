import * as THREE from "three";
import type { HotelConfigPayload } from "../../lib/api/schemas";

/**
 * Everything the building stands on/beside, built from THREE.js primitives —
 * the low-poly asset pack has no ready-made props for a parking lot, EV
 * charger, patio furniture, entrance canopy, or spa pod, so these are
 * hand-built here the same way the pool/pet/shuttle already are.
 */

export interface Footprint {
  halfWidth: number;
  halfDepth: number;
  /** World y of the building's base (bottom of its bounding box). */
  baseY: number;
  height: number;
}

const FLOOR_COLOR = 0xd8d8d3;
const POOL_WATER_COLOR = 0x2f7fb0;
const POOL_WALL_COLOR = 0xb9bdba;
// Same neutral grey as the building's own material — most set dressing stays
// monochrome (minimalist look); only water/accent colors deviate.
const MODEL_GREY = 0xe4e4e4;
const ASPHALT_COLOR = 0x4d4d50;
const STALL_LINE_COLOR = 0xececeb;
const EV_ACCENT_COLOR = 0x3aa66b;
const SPA_WATER_COLOR = 0x3f9c93;

const PARK_STALL_COUNT = 3;

interface ZoneExtents {
  poolHalfWidth: number;
  poolHalfDepth: number;
  poolCenterZ: number;
  carGap: number;
  maxCarLength: number;
  carFarX: number;
  parkCarLength: number;
  parkStallPitch: number;
  parkLotHalfDepthZ: number;
  parkLaneGap: number;
  parkPatchDepthX: number;
  parkNearX: number;
  parkFarX: number;
  parkingLotFarX: number;
  parkZExtent: number;
  edgeMargin: number;
}

/** Amenity-zone sizing, as a pure function of the current model's
 * half-width/half-depth — used both to size the floor's outer rectangle and
 * to position the real decor (pool, parking lane, etc.) within it. */
function computeZoneExtents(halfWidth: number, halfDepth: number): ZoneExtents {
  const poolHalfWidth = halfWidth * 0.55;
  const poolHalfDepth = halfDepth * 0.32;
  const poolGap = halfDepth * 0.25;
  const poolCenterZ = -(halfDepth + poolGap + poolHalfDepth);

  const carGap = halfWidth * 0.35;
  const maxCarLength = halfWidth * 0.85; // limo is the largest shuttle vehicle
  const carFarX = halfWidth + carGap + maxCarLength;

  const parkCarLength = halfWidth * 0.5;
  const parkStallPitch = parkCarLength * 1.3;
  const parkLotHalfDepthZ = (PARK_STALL_COUNT * parkStallPitch) / 2;
  const parkLaneGap = halfWidth * 0.3;
  const parkPatchDepthX = parkCarLength * 0.9;
  const parkNearX = -(halfWidth + parkLaneGap);
  const parkFarX = parkNearX - parkPatchDepthX;
  const parkingLotFarX = -parkFarX; // distance from center to the lane's outer edge
  const parkZExtent = parkLotHalfDepthZ + parkStallPitch * 0.5; // + EV buffer past the last stall

  const edgeMargin = Math.max(halfWidth, halfDepth) * 0.35;

  return {
    poolHalfWidth,
    poolHalfDepth,
    poolCenterZ,
    carGap,
    maxCarLength,
    carFarX,
    parkCarLength,
    parkStallPitch,
    parkLotHalfDepthZ,
    parkLaneGap,
    parkPatchDepthX,
    parkNearX,
    parkFarX,
    parkingLotFarX,
    parkZExtent,
    edgeMargin,
  };
}

type ShuttleKind = "car" | "van" | "limo";

function shuttleKindForHotelType(
  hotelType: HotelConfigPayload["hotelType"],
): ShuttleKind {
  switch (hotelType) {
    case "upscale":
    case "resort":
      return "van";
    case "luxury":
      return "limo";
    default:
      return "car";
  }
}

export function disposeObject(obj: THREE.Object3D) {
  obj.traverse((child) => {
    const mesh = child as THREE.Mesh;
    if (!mesh.geometry) return;
    mesh.geometry.dispose();
    const mat = mesh.material;
    if (Array.isArray(mat)) mat.forEach((m) => m.dispose());
    else if (mat) mat.dispose();
  });
}

/** A small low-poly quadruped (dog-like) built from primitives, standing at ground level (local y=0). */
function buildLowPolyPet(size: number): THREE.Group {
  const group = new THREE.Group();
  const material = new THREE.MeshStandardMaterial({
    color: MODEL_GREY,
    roughness: 0.65,
    flatShading: true,
  });

  const bodyLen = size;
  const bodyH = size * 0.42;
  const bodyW = size * 0.4;
  const legH = size * 0.32;
  const legR = size * 0.07;

  const body = new THREE.Mesh(new THREE.BoxGeometry(bodyLen, bodyH, bodyW), material);
  body.position.y = legH + bodyH / 2;
  group.add(body);

  const head = new THREE.Mesh(
    new THREE.BoxGeometry(size * 0.34, size * 0.32, size * 0.3),
    material,
  );
  head.position.set(bodyLen / 2 + size * 0.1, legH + bodyH * 0.7, 0);
  group.add(head);

  const earGeometry = new THREE.ConeGeometry(size * 0.07, size * 0.16, 4);
  const earLeft = new THREE.Mesh(earGeometry, material);
  earLeft.position.set(
    head.position.x - size * 0.06,
    head.position.y + size * 0.22,
    size * 0.09,
  );
  group.add(earLeft);
  const earRight = earLeft.clone();
  earRight.position.z = -size * 0.09;
  group.add(earRight);

  const tail = new THREE.Mesh(
    new THREE.BoxGeometry(size * 0.28, size * 0.08, size * 0.08),
    material,
  );
  tail.position.set(-bodyLen / 2 - size * 0.08, legH + bodyH * 0.75, 0);
  tail.rotation.z = -0.5;
  group.add(tail);

  const legGeometry = new THREE.CylinderGeometry(legR, legR, legH, 6);
  const legInsetX = bodyLen / 2 - legR * 1.5;
  const legInsetZ = bodyW / 2 - legR * 1.5;
  for (const x of [legInsetX, -legInsetX]) {
    for (const z of [legInsetZ, -legInsetZ]) {
      const leg = new THREE.Mesh(legGeometry, material);
      leg.position.set(x, legH / 2, z);
      group.add(leg);
    }
  }

  return group;
}

// Per-kind proportions (fractions of overall `length`) for the low-poly
// airport shuttle vehicle. Shape alone distinguishes car/van/limo — colour
// is uniform grey across all three (see MODEL_GREY) for the minimalist look.
const CAR_STYLES: Record<
  ShuttleKind,
  {
    widthFrac: number;
    bodyHFrac: number;
    cabinHFrac: number;
    cabinLenFrac: number;
    wheelRFrac: number;
  }
> = {
  car: { widthFrac: 0.42, bodyHFrac: 0.2, cabinHFrac: 0.2, cabinLenFrac: 0.55, wheelRFrac: 0.115 },
  van: { widthFrac: 0.46, bodyHFrac: 0.3, cabinHFrac: 0.16, cabinLenFrac: 0.85, wheelRFrac: 0.12 },
  limo: { widthFrac: 0.36, bodyHFrac: 0.15, cabinHFrac: 0.13, cabinLenFrac: 0.68, wheelRFrac: 0.1 },
};

/** A small low-poly car/van/limousine built from primitives, standing at ground level (local y=0). */
function buildLowPolyCar(kind: ShuttleKind, length: number): THREE.Group {
  const style = CAR_STYLES[kind];
  const group = new THREE.Group();
  const width = length * style.widthFrac;
  const bodyH = length * style.bodyHFrac;
  const cabinH = length * style.cabinHFrac;
  const wheelR = length * style.wheelRFrac;
  const wheelThickness = wheelR * 0.6;

  const bodyMaterial = new THREE.MeshStandardMaterial({
    color: MODEL_GREY,
    roughness: 0.5,
    flatShading: true,
  });
  const glassMaterial = new THREE.MeshStandardMaterial({
    color: MODEL_GREY,
    roughness: 0.25,
    flatShading: true,
  });
  const wheelMaterial = new THREE.MeshStandardMaterial({
    color: MODEL_GREY,
    roughness: 0.9,
    flatShading: true,
  });

  const bodyBottomY = wheelR * 0.9;
  const body = new THREE.Mesh(new THREE.BoxGeometry(length, bodyH, width), bodyMaterial);
  body.position.y = bodyBottomY + bodyH / 2;
  group.add(body);

  const cabinLen = length * style.cabinLenFrac;
  const cabin = new THREE.Mesh(
    new THREE.BoxGeometry(cabinLen, cabinH, width * 0.8),
    glassMaterial,
  );
  cabin.position.y = bodyBottomY + bodyH + cabinH / 2;
  group.add(cabin);

  const wheelGeometry = new THREE.CylinderGeometry(wheelR, wheelR, wheelThickness, 10);
  const axleX = length * 0.32;
  const axleZ = width / 2 - wheelR * 0.5;
  for (const x of [axleX, -axleX]) {
    for (const z of [axleZ, -axleZ]) {
      const wheel = new THREE.Mesh(wheelGeometry, wheelMaterial);
      wheel.rotation.x = Math.PI / 2;
      wheel.position.set(x, wheelR, z);
      group.add(wheel);
    }
  }

  return group;
}

/** A small patio table: pole + round top + cone umbrella, standing at local y=0. */
function buildPatioTable(size: number): THREE.Group {
  const group = new THREE.Group();
  const material = new THREE.MeshStandardMaterial({
    color: MODEL_GREY,
    roughness: 0.5,
    flatShading: true,
  });

  const poleH = size * 0.55;
  const pole = new THREE.Mesh(
    new THREE.CylinderGeometry(size * 0.045, size * 0.045, poleH, 8),
    material,
  );
  pole.position.y = poleH / 2;
  group.add(pole);

  const tableTop = new THREE.Mesh(
    new THREE.CylinderGeometry(size * 0.32, size * 0.32, size * 0.05, 10),
    material,
  );
  tableTop.position.y = poleH;
  group.add(tableTop);

  const umbrellaMaterial = new THREE.MeshStandardMaterial({
    color: MODEL_GREY,
    roughness: 0.4,
    flatShading: true,
  });
  const umbrella = new THREE.Mesh(
    new THREE.ConeGeometry(size * 0.55, size * 0.35, 8),
    umbrellaMaterial,
  );
  umbrella.position.y = poleH + size * 0.3;
  group.add(umbrella);

  return group;
}

/**
 * Two poolside patio tables, offset to −X of the (always-reserved) pool
 * envelope — mirrors the spa pod's +X offset, so the two sit on opposite
 * sides of the pool and never overlap it or each other.
 */
function buildPatioDining(
  footprint: Footprint,
  poolHalfWidth: number,
  poolCenterZ: number,
  poolHalfDepth: number,
): THREE.Group {
  const group = new THREE.Group();
  const { halfWidth, halfDepth, baseY } = footprint;
  const tableSize = Math.max(halfWidth, halfDepth) * 0.22;
  const offsetX = -(poolHalfWidth + tableSize * 1.3 + Math.max(halfWidth, halfDepth) * 0.1);
  const centerZ = poolCenterZ + poolHalfDepth * 0.3;
  const spacing = tableSize * 1.4;

  const tableA = buildPatioTable(tableSize);
  tableA.position.set(offsetX, baseY, centerZ - spacing / 2);
  group.add(tableA);

  const tableB = buildPatioTable(tableSize);
  tableB.position.set(offsetX, baseY, centerZ + spacing / 2);
  group.add(tableB);

  return group;
}

/** A small canopy/awning over the entrance: two posts + a flat overhang slab. */
function buildEntranceCanopy(footprint: Footprint): THREE.Group {
  const group = new THREE.Group();
  const { halfWidth, halfDepth, baseY, height } = footprint;
  const material = new THREE.MeshStandardMaterial({
    color: 0xdededa,
    roughness: 0.55,
    flatShading: true,
  });

  const canopyWidth = halfWidth * 1.1;
  const canopyDepth = Math.max(halfWidth, halfDepth) * 0.28;
  const canopyThickness = Math.max(height * 0.03, canopyDepth * 0.12);
  const canopyY = baseY + height * 0.32;

  const slab = new THREE.Mesh(
    new THREE.BoxGeometry(canopyWidth, canopyThickness, canopyDepth),
    material,
  );
  slab.position.set(0, canopyY, halfDepth + canopyDepth / 2);
  group.add(slab);

  const postR = canopyThickness * 0.5;
  const postH = canopyY - baseY;
  const postGeometry = new THREE.CylinderGeometry(postR, postR, postH, 8);
  for (const x of [-canopyWidth / 2 + postR * 2, canopyWidth / 2 - postR * 2]) {
    const post = new THREE.Mesh(postGeometry, material);
    post.position.set(x, baseY + postH / 2, halfDepth + canopyDepth - postR * 2);
    group.add(post);
  }

  return group;
}

/** A small round raised-rim pod (mini jacuzzi), offset just outside the pool envelope. */
function buildSpaPod(
  footprint: Footprint,
  poolHalfWidth: number,
  poolCenterZ: number,
  poolHalfDepth: number,
): THREE.Group {
  const group = new THREE.Group();
  const { halfWidth, halfDepth, baseY } = footprint;
  const radius = Math.max(halfWidth, halfDepth) * 0.14;

  const rimMaterial = new THREE.MeshStandardMaterial({
    color: POOL_WALL_COLOR,
    roughness: 0.8,
    flatShading: true,
  });
  const waterMaterial = new THREE.MeshStandardMaterial({
    color: SPA_WATER_COLOR,
    roughness: 0.15,
    metalness: 0.05,
  });

  const rimHeight = radius * 0.4;
  const rim = new THREE.Mesh(
    new THREE.CylinderGeometry(radius, radius * 1.05, rimHeight, 16),
    rimMaterial,
  );
  rim.position.y = baseY + rimHeight / 2;
  group.add(rim);

  const water = new THREE.Mesh(
    new THREE.CylinderGeometry(radius * 0.82, radius * 0.82, rimHeight * 0.3, 16),
    waterMaterial,
  );
  water.position.y = baseY + rimHeight * 0.85;
  group.add(water);

  const offsetX = poolHalfWidth + radius + Math.max(halfWidth, halfDepth) * 0.12;
  group.position.set(offsetX, 0, poolCenterZ - poolHalfDepth * 0.3);

  return group;
}

interface ParkingLotLayout {
  nearX: number;
  farX: number;
  halfDepthZ: number;
  carLength: number;
  groundLift: number;
}

/** Asphalt patch + painted stall lines + 2 parked cars, in the left (−X) lane. */
function buildParkingLot(footprint: Footprint, layout: ParkingLotLayout): THREE.Group {
  const group = new THREE.Group();
  const { baseY } = footprint;
  const { nearX, farX, halfDepthZ, carLength, groundLift } = layout;
  const centerX = (nearX + farX) / 2;
  const patchWidthX = Math.abs(farX - nearX);

  const patch = new THREE.Mesh(
    new THREE.PlaneGeometry(patchWidthX, halfDepthZ * 2),
    new THREE.MeshStandardMaterial({
      color: ASPHALT_COLOR,
      roughness: 0.95,
      side: THREE.DoubleSide,
    }),
  );
  patch.rotation.x = Math.PI / 2;
  patch.position.set(centerX, baseY + groundLift, 0);
  group.add(patch);

  const stallCount = 3;
  const stallPitch = (halfDepthZ * 2) / stallCount;
  const lineMaterial = new THREE.MeshStandardMaterial({
    color: STALL_LINE_COLOR,
    roughness: 0.6,
    side: THREE.DoubleSide,
  });
  for (let i = 0; i <= stallCount; i++) {
    const z = -halfDepthZ + i * stallPitch;
    const line = new THREE.Mesh(
      new THREE.PlaneGeometry(patchWidthX * 0.85, patchWidthX * 0.03),
      lineMaterial,
    );
    line.rotation.x = Math.PI / 2;
    line.position.set(centerX, baseY + groundLift * 2, z);
    group.add(line);
  }

  const filledStalls = [0, 2];
  for (const idx of filledStalls) {
    const car = buildLowPolyCar("car", carLength);
    car.rotation.y = Math.PI / 2;
    const stallCenterZ = -halfDepthZ + stallPitch * (idx + 0.5);
    car.position.set(centerX, baseY, stallCenterZ);
    group.add(car);
  }

  return group;
}

interface EvChargerLayout {
  nearX: number;
  farX: number;
  z: number;
}

/** A small charging post with an accent-colored head unit. */
function buildEvCharger(footprint: Footprint, layout: EvChargerLayout): THREE.Group {
  const group = new THREE.Group();
  const { halfWidth, halfDepth, baseY } = footprint;
  const unit = Math.max(halfWidth, halfDepth) * 0.16;
  const postMaterial = new THREE.MeshStandardMaterial({
    color: MODEL_GREY,
    roughness: 0.5,
    flatShading: true,
  });
  const accentMaterial = new THREE.MeshStandardMaterial({
    color: EV_ACCENT_COLOR,
    roughness: 0.4,
    flatShading: true,
  });

  const centerX = (layout.nearX + layout.farX) / 2;
  const postH = unit * 1.1;
  const post = new THREE.Mesh(
    new THREE.BoxGeometry(unit * 0.22, postH, unit * 0.22),
    postMaterial,
  );
  post.position.set(centerX, baseY + postH / 2, layout.z);
  group.add(post);

  const head = new THREE.Mesh(
    new THREE.BoxGeometry(unit * 0.4, unit * 0.5, unit * 0.18),
    accentMaterial,
  );
  head.position.set(centerX, baseY + postH * 0.85, layout.z);
  group.add(head);

  return group;
}

export interface GroundDecorOptions {
  hasPool: boolean;
  petFriendly: boolean;
  airportShuttle: boolean;
  hasParking: boolean;
  hasEvCharging: boolean;
  hasPatioDining: boolean;
  hasConferenceCanopy: boolean;
  hasSpa: boolean;
}

/**
 * Builds everything the building stands on/beside: a flat rectangular floor
 * sized from the building's own footprint, plus optional set dressing driven
 * by amenity toggles — all parented under one group so they can be swapped
 * as a unit without touching the building itself.
 *
 * Zones (all reserved at their max extent regardless of which amenities are
 * toggled, so the floor itself never resizes when a toggle flips):
 * - Back (−Z): pool, with the spa pod (+X) and patio dining (−X) on either
 *   side of it.
 * - Front (+Z, doorway): entrance canopy (center), pet (+X).
 * - Right lane (+X, beyond the building): airport shuttle vehicle.
 * - Left lane (−X, beyond the building): parking lot + EV charging post.
 */
export function buildGroundDecor(
  footprint: Footprint,
  hotelType: HotelConfigPayload["hotelType"],
  opts: GroundDecorOptions,
): THREE.Group {
  const group = new THREE.Group();
  const { halfWidth, halfDepth, baseY, height } = footprint;
  const groundLift = Math.max(halfWidth, halfDepth) * 0.001;

  const {
    poolHalfWidth,
    poolHalfDepth,
    poolCenterZ,
    carGap,
    carFarX,
    parkCarLength,
    parkStallPitch,
    parkLotHalfDepthZ,
    parkNearX,
    parkFarX,
    parkingLotFarX,
    parkZExtent,
    edgeMargin,
  } = computeZoneExtents(halfWidth, halfDepth);

  const floorHalfWidth = edgeMargin + Math.max(carFarX, parkingLotFarX);
  const floorFrontZ = Math.max(halfDepth, parkZExtent) + edgeMargin; // doorway side
  const floorBackZ = Math.min(poolCenterZ - poolHalfDepth, -parkZExtent) - edgeMargin;

  const shape = new THREE.Shape();
  shape.moveTo(-floorHalfWidth, floorBackZ);
  shape.lineTo(floorHalfWidth, floorBackZ);
  shape.lineTo(floorHalfWidth, floorFrontZ);
  shape.lineTo(-floorHalfWidth, floorFrontZ);
  shape.closePath();

  if (opts.hasPool) {
    const hole = new THREE.Path();
    hole.moveTo(-poolHalfWidth, poolCenterZ - poolHalfDepth);
    hole.lineTo(poolHalfWidth, poolCenterZ - poolHalfDepth);
    hole.lineTo(poolHalfWidth, poolCenterZ + poolHalfDepth);
    hole.lineTo(-poolHalfWidth, poolCenterZ + poolHalfDepth);
    hole.closePath();
    shape.holes.push(hole);
  }

  const floorMesh = new THREE.Mesh(
    new THREE.ShapeGeometry(shape),
    new THREE.MeshStandardMaterial({
      color: FLOOR_COLOR,
      roughness: 0.95,
      metalness: 0,
      side: THREE.DoubleSide,
    }),
  );
  // The shape is authored flat in local XY; rotate it onto the ground plane
  // so shape-y becomes world z.
  floorMesh.rotation.x = Math.PI / 2;
  floorMesh.position.y = baseY;
  group.add(floorMesh);

  if (opts.hasPool) {
    const recess = Math.max(height * 0.035, Math.max(halfWidth, halfDepth) * 0.02);

    const waterShape = new THREE.Shape();
    waterShape.moveTo(-poolHalfWidth, poolCenterZ - poolHalfDepth);
    waterShape.lineTo(poolHalfWidth, poolCenterZ - poolHalfDepth);
    waterShape.lineTo(poolHalfWidth, poolCenterZ + poolHalfDepth);
    waterShape.lineTo(-poolHalfWidth, poolCenterZ + poolHalfDepth);
    waterShape.closePath();
    const waterMesh = new THREE.Mesh(
      new THREE.ShapeGeometry(waterShape),
      new THREE.MeshStandardMaterial({
        color: POOL_WATER_COLOR,
        roughness: 0.15,
        metalness: 0.05,
        side: THREE.DoubleSide,
      }),
    );
    waterMesh.rotation.x = Math.PI / 2;
    waterMesh.position.y = baseY - recess;
    group.add(waterMesh);

    const wallThickness = Math.max(poolHalfWidth, poolHalfDepth) * 0.04;
    const wallMaterial = new THREE.MeshStandardMaterial({
      color: POOL_WALL_COLOR,
      roughness: 0.85,
    });
    const wallY = baseY - recess / 2;

    const nearWall = new THREE.Mesh(
      new THREE.BoxGeometry(poolHalfWidth * 2 + wallThickness, recess, wallThickness),
      wallMaterial,
    );
    nearWall.position.set(0, wallY, poolCenterZ - poolHalfDepth);
    group.add(nearWall);

    const farWall = nearWall.clone();
    farWall.position.z = poolCenterZ + poolHalfDepth;
    group.add(farWall);

    const leftWall = new THREE.Mesh(
      new THREE.BoxGeometry(wallThickness, recess, poolHalfDepth * 2),
      wallMaterial,
    );
    leftWall.position.set(-poolHalfWidth, wallY, poolCenterZ);
    group.add(leftWall);

    const rightWall = leftWall.clone();
    rightWall.position.x = poolHalfWidth;
    group.add(rightWall);
  }

  // ---- Spa pod and patio dining, on either side of the (always-reserved)
  // pool envelope ----
  if (opts.hasSpa) {
    group.add(buildSpaPod(footprint, poolHalfWidth, poolCenterZ, poolHalfDepth));
  }
  if (opts.hasPatioDining) {
    group.add(buildPatioDining(footprint, poolHalfWidth, poolCenterZ, poolHalfDepth));
  }

  // ---- Pet, near the doorway (front, +Z) ----
  if (opts.petFriendly) {
    const petSize = Math.max(halfWidth, halfDepth) * 0.16;
    const pet = buildLowPolyPet(petSize);
    pet.position.set(halfWidth * 0.4, baseY, halfDepth + petSize * 0.6);
    // Local "face" direction is +X; rotate to face the doorway (−Z), plus a
    // further 90° as requested.
    pet.rotation.y = Math.PI;
    group.add(pet);
  }

  // ---- Entrance canopy, centered on the doorway (front, +Z) ----
  if (opts.hasConferenceCanopy) {
    group.add(buildEntranceCanopy(footprint));
  }

  // ---- Shuttle vehicle, to the right of the building (+X) ----
  if (opts.airportShuttle) {
    const kind = shuttleKindForHotelType(hotelType);
    const carLength = Math.max(halfWidth, halfDepth) * (kind === "limo" ? 0.85 : 0.6);
    const car = buildLowPolyCar(kind, carLength);
    car.position.set(halfWidth + carGap + carLength / 2, baseY, 0);
    car.rotation.y = Math.PI / 2;
    group.add(car);
  }

  // ---- Parking lot + EV charger, to the left of the building (−X) ----
  if (opts.hasParking) {
    group.add(
      buildParkingLot(footprint, {
        nearX: parkNearX,
        farX: parkFarX,
        halfDepthZ: parkLotHalfDepthZ,
        carLength: parkCarLength,
        groundLift,
      }),
    );
  }

  if (opts.hasEvCharging) {
    const evZ = opts.hasParking ? parkLotHalfDepthZ + parkStallPitch * 0.4 : 0;
    group.add(buildEvCharger(footprint, { nearX: parkNearX, farX: parkFarX, z: evZ }));
  }

  return group;
}
