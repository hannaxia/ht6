"use client";

import { useEffect, useRef } from "react";
import * as THREE from "three";
import { FBXLoader } from "three/examples/jsm/loaders/FBXLoader.js";
import type { HotelConfigPayload } from "../../lib/api/schemas";
import { modelForHotelType, modelUrl } from "./hotelModel";

// Baked-in lighting (tuned in-browser). Angles are degrees: azimuth is the
// key light's compass direction around the model, elevation its height above
// the horizon.
const LIGHT = {
  ambient: 0.21,
  key: 1.25,
  fill: 2,
  exposure: 2,
  azimuth: 0,
  elevation: 38,
};

const FLOOR_COLOR = 0xd8d8d3;
const POOL_WATER_COLOR = 0x2f7fb0;
const POOL_WALL_COLOR = 0xb9bdba;
// Same neutral grey as the building's own material — pet and vehicles stay
// monochrome (minimalist look); only roughness varies for part definition.
const MODEL_GREY = 0xe4e4e4;

interface Footprint {
  halfWidth: number;
  halfDepth: number;
  /** World y of the building's base (bottom of its bounding box). */
  baseY: number;
  height: number;
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

function disposeObject(obj: THREE.Object3D) {
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

/**
 * Builds everything the building stands on/beside: a flat rectangular floor
 * sized from the building's own footprint, plus optional set dressing driven
 * by amenity toggles — all parented under one group so they can be swapped
 * as a unit without touching the building itself.
 *
 * - `hasPool`: cuts a rectangular pool-shaped hole (THREE.Shape + hole path)
 *   into the floor at the BACK of the building (−Z), with a recessed water
 *   plane and thin walls so it reads as a basin, not a flat colour patch.
 * - `petFriendly`: a small low-poly animal near the doorway (front, +Z).
 * - `airportShuttle`: a low-poly vehicle to the right of the building (+X),
 *   whose kind follows the hotel type — car for budget/midscale/extended
 *   stay, van for upscale/resort, limousine for luxury.
 */
function buildGroundDecor(
  footprint: Footprint,
  hotelType: HotelConfigPayload["hotelType"],
  opts: { hasPool: boolean; petFriendly: boolean; airportShuttle: boolean },
): THREE.Group {
  const group = new THREE.Group();
  const { halfWidth, halfDepth, baseY, height } = footprint;

  // ---- Floor: always sized for the maximum amenity extent (pool at the
  // back + the largest possible shuttle vehicle to the right), so toggling
  // amenities on/off never grows or shrinks the floor itself — only the pool
  // hole, pet, and car appear/disappear within these fixed bounds. ----
  const poolHalfWidth = halfWidth * 0.55;
  const poolHalfDepth = halfDepth * 0.32;
  const poolGap = halfDepth * 0.25;
  const poolCenterZ = -(halfDepth + poolGap + poolHalfDepth); // back = −Z

  const edgeMargin = Math.max(halfWidth, halfDepth) * 0.35;
  const carGap = halfWidth * 0.35;
  const maxCarLength = halfWidth * 0.85; // limo is the largest shuttle vehicle
  const carFarX = halfWidth + carGap + maxCarLength;

  const floorHalfWidth = carFarX + edgeMargin;
  const floorFrontZ = halfDepth + edgeMargin; // doorway side
  const floorBackZ = poolCenterZ - poolHalfDepth - edgeMargin; // pool side, always reserved

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

  // ---- Shuttle vehicle, to the right of the building (+X) ----
  if (opts.airportShuttle) {
    const kind = shuttleKindForHotelType(hotelType);
    const carLength = Math.max(halfWidth, halfDepth) * (kind === "limo" ? 0.85 : 0.6);
    const car = buildLowPolyCar(kind, carLength);
    car.position.set(halfWidth + carGap + carLength / 2, baseY, 0);
    car.rotation.y = Math.PI / 2;
    group.add(car);
  }

  return group;
}

/**
 * Minimal Three.js building preview: loads an FBX from the asset pack onto a
 * transparent canvas so it appears to sit directly on the page (no panel or
 * background), standing on a rectangular floor with optional amenity-driven
 * set dressing (pool, pet, airport shuttle — see buildGroundDecor). The
 * specific building is chosen from the selected hotel type, and swaps when
 * that changes. The camera auto-fits the *building's* bounding box on load
 * and on every resize (the ground decor is deliberately not included in that
 * fit, so it extends toward/past the frame edges like real ground rather
 * than shrinking the building to fit the extra geometry).
 */
export function SandboxModel({
  hotelType,
  hasPool,
  petFriendly,
  airportShuttle,
}: {
  hotelType: HotelConfigPayload["hotelType"];
  hasPool: boolean;
  petFriendly: boolean;
  airportShuttle: boolean;
}) {
  const mountRef = useRef<HTMLDivElement | null>(null);
  const modelSrc = modelUrl(modelForHotelType(hotelType));

  // Bridges the amenity toggles (which must NOT reload the FBX or reset the
  // scene) into the heavy setup effect below, which only reruns when the
  // model itself changes.
  const hasPoolRef = useRef(hasPool);
  hasPoolRef.current = hasPool;
  const petFriendlyRef = useRef(petFriendly);
  petFriendlyRef.current = petFriendly;
  const airportShuttleRef = useRef(airportShuttle);
  airportShuttleRef.current = airportShuttle;
  const syncDecorRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;
    const el: HTMLDivElement = mount;

    let disposed = false;
    let frame = 0;

    const rect = el.getBoundingClientRect();
    const width = el.clientWidth || rect.width || 400;
    const height = el.clientHeight || rect.height || 400;

    const scene = new THREE.Scene(); // no background → transparent

    const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 5000);

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setClearColor(0x000000, 0);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(width, height);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    // Filmic tonemap + exposure lift → richer contrast between the dark shadow
    // faces and the brighter lit ones.
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = LIGHT.exposure;
    el.appendChild(renderer.domElement);
    renderer.domElement.style.width = "100%";
    renderer.domElement.style.height = "100%";
    renderer.domElement.style.display = "block";

    // Low ambient keeps unlit faces dark (deeper shadows); the key light lifts
    // the lit faces; the fill stops the shadow side going fully black.
    const ambient = new THREE.AmbientLight(0xffffff, LIGHT.ambient);
    scene.add(ambient);
    const key = new THREE.DirectionalLight(0xffffff, LIGHT.key);
    // Place the key light on a sphere around the model from the compass
    // (azimuth) and height (elevation) angles; it aims at the origin.
    const az = THREE.MathUtils.degToRad(LIGHT.azimuth);
    const elev = THREE.MathUtils.degToRad(LIGHT.elevation);
    const r = 6;
    key.position.set(
      r * Math.cos(elev) * Math.sin(az),
      r * Math.sin(elev),
      r * Math.cos(elev) * Math.cos(az),
    );
    scene.add(key);
    const fill = new THREE.DirectionalLight(0xffffff, LIGHT.fill);
    fill.position.set(-2, 1, -1.5);
    scene.add(fill);

    // Model radius, set once loaded; drives the auto-fit distance.
    let modelRadius = 1;
    let model: THREE.Group | null = null;
    let decorGroup: THREE.Group | null = null;
    let footprint: Footprint | null = null;
    // Rotating the model around its own origin spins it in a wide arc (the
    // geometry sits far from that origin). Parent it under a pivot at the world
    // origin and offset the model so its center lands on the pivot — rotating
    // the pivot then spins around the building's center. The ground decor is
    // parented under the same pivot so it spins together as one turntable,
    // keeping the pool/pet/car fixed relative to the building as it rotates.
    const pivot = new THREE.Group();
    scene.add(pivot);

    function syncDecor() {
      if (!footprint) return;
      if (decorGroup) {
        pivot.remove(decorGroup);
        disposeObject(decorGroup);
      }
      decorGroup = buildGroundDecor(footprint, hotelType, {
        hasPool: hasPoolRef.current,
        petFriendly: petFriendlyRef.current,
        airportShuttle: airportShuttleRef.current,
      });
      pivot.add(decorGroup);
    }
    syncDecorRef.current = syncDecor;

    // Frame the model so its bounding sphere fits both axes at the current
    // aspect ratio — this is what guarantees nothing is cut off.
    function fitCamera() {
      const fov = (camera.fov * Math.PI) / 180;
      const fitH = modelRadius / Math.sin(fov / 2);
      const fitW = fitH / Math.min(1, camera.aspect);
      const distance = 1.25 * Math.max(fitH, fitW);
      const dir = new THREE.Vector3(1, 0.55, 1).normalize();
      camera.position.copy(dir.multiplyScalar(distance));
      camera.near = distance / 100;
      camera.far = distance * 100;
      camera.lookAt(0, 0, 0);
      camera.updateProjectionMatrix();
    }

    new FBXLoader().load(
      modelSrc,
      (object) => {
        if (disposed) return;
        object.traverse((child) => {
          const mesh = child as THREE.Mesh;
          if (!mesh.isMesh) return;
          // No texture map → a plain, brightish neutral-grey material, so the
          // buildings render monochrome with lighting/shading only (no colour).
          // Lower roughness sharpens the light falloff for more definition.
          mesh.material = new THREE.MeshStandardMaterial({
            color: 0xe4e4e4,
            roughness: 0.65,
            metalness: 0,
          });
        });

        // Offset the model within the pivot so its center sits on the pivot's
        // origin (0,0,0), then record its bounding sphere for the auto-fit.
        const box = new THREE.Box3().setFromObject(object);
        const center = box.getCenter(new THREE.Vector3());
        const size = box.getSize(new THREE.Vector3());
        object.position.sub(center);
        const sphere = box.getBoundingSphere(new THREE.Sphere());
        modelRadius = sphere.radius || 1;

        model = object;
        pivot.add(object);
        fitCamera();

        footprint = {
          halfWidth: Math.max(size.x / 2, 0.01),
          halfDepth: Math.max(size.z / 2, 0.01),
          baseY: -size.y / 2,
          height: Math.max(size.y, 0.01),
        };
        syncDecor();
      },
      undefined,
      (err) => {
        // eslint-disable-next-line no-console
        console.warn("Failed to load building model", err);
      },
    );

    function animate() {
      if (disposed) return;
      frame = requestAnimationFrame(animate);
      pivot.rotation.y += 0.005;
      renderer.render(scene, camera);
    }
    animate();

    function resize() {
      const w = el.clientWidth || 1;
      const h = el.clientHeight || 1;
      renderer.setSize(w, h, false);
      camera.aspect = w / h;
      fitCamera();
    }
    const resizeObserver = new ResizeObserver(resize);
    resizeObserver.observe(el);
    resize();

    return () => {
      disposed = true;
      cancelAnimationFrame(frame);
      resizeObserver.disconnect();
      syncDecorRef.current = null;
      scene.remove(pivot);
      if (model) disposeObject(model);
      if (decorGroup) disposeObject(decorGroup);
      renderer.dispose();
      renderer.forceContextLoss();
      if (renderer.domElement.parentNode === el) {
        el.removeChild(renderer.domElement);
      }
    };
  }, [modelSrc, hotelType]);

  // Toggling an amenity rebuilds only the ground-decor group, via the ref the
  // heavy effect above wired up — no FBX reload, no scene reset.
  useEffect(() => {
    syncDecorRef.current?.();
  }, [hasPool, petFriendly, airportShuttle]);

  return <div ref={mountRef} className="h-full w-full" aria-hidden="true" />;
}
