"use client";

import { useEffect, useRef } from "react";
import * as THREE from "three";
import { FBXLoader } from "three/examples/jsm/loaders/FBXLoader.js";
import type { HotelConfigPayload } from "../../lib/api/schemas";
import { modelForHotelType, modelUrl } from "./hotelModel";
import {
  buildGroundDecor,
  disposeObject,
  type Footprint,
} from "./groundDecor";

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

// Rooms (50-500 slider range) map to an anisotropic scale on the building —
// mostly vertical, with a slighter footprint change, so a big hotel reads as
// "taller" more than "wider." The lot/floor deliberately does not scale with
// this — only the building mesh.
const ROOMS_MIN = 50;
const ROOMS_MAX = 500;
const ROOMS_SCALE_XZ: [number, number] = [0.92, 1.15];
const ROOMS_SCALE_Y: [number, number] = [0.8, 1.45];
const ROOMS_SCALE_LERP = 0.08;

// Modernity (0-1) maps to material roughness/color only — no new geometry.
const MODERNITY_ROUGHNESS: [number, number] = [0.75, 0.45];
const MODERNITY_COLOR: [number, number] = [0xcfcfc9, 0xeeeeea];

const FIRST_LOAD_DURATION_MS = 500;
const SWAP_DURATION_MS = 650;

// Camera orbit: free drag in any direction orbits azimuth/elevation around
// the static scene; wheel zooms. Elevation is clamped so the camera can
// never dip below the floor or flip past straight-down/up; zoom is clamped
// to a limited range around the auto-fit distance.
const ELEVATION_MIN = THREE.MathUtils.degToRad(8);
const ELEVATION_MAX = THREE.MathUtils.degToRad(82);
const ZOOM_MIN = 0.55;
const ZOOM_MAX = 2.2;
const AUTO_ROTATE_SPEED = 0.005; // radians/frame
const DRAG_ORBIT_SPEED = 0.008; // radians per pixel dragged
const ZOOM_WHEEL_SPEED = 0.0015; // zoom-multiplier change per wheel deltaY unit

function easeInOutCubic(t: number) {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

function computeRoomsScale(rooms: number) {
  const t = THREE.MathUtils.clamp((rooms - ROOMS_MIN) / (ROOMS_MAX - ROOMS_MIN), 0, 1);
  return {
    x: THREE.MathUtils.lerp(ROOMS_SCALE_XZ[0], ROOMS_SCALE_XZ[1], t),
    y: THREE.MathUtils.lerp(ROOMS_SCALE_Y[0], ROOMS_SCALE_Y[1], t),
    z: THREE.MathUtils.lerp(ROOMS_SCALE_XZ[0], ROOMS_SCALE_XZ[1], t),
  };
}

function materialParamsForModernity(modernity: number) {
  const t = THREE.MathUtils.clamp(modernity, 0, 1);
  return {
    color: new THREE.Color(MODERNITY_COLOR[0]).lerp(new THREE.Color(MODERNITY_COLOR[1]), t),
    roughness: THREE.MathUtils.lerp(MODERNITY_ROUGHNESS[0], MODERNITY_ROUGHNESS[1], t),
  };
}

interface ModelEntry {
  scaleGroup: THREE.Group;
  radius: number;
  height: number;
  footprint: Footprint;
  materials: THREE.MeshStandardMaterial[];
}

interface TransitionState {
  from: ModelEntry | null;
  to: ModelEntry;
  start: number;
  duration: number;
}

// Scaling happens about scaleGroup's own origin (the object's vertical
// center, since the object was recentered there), so growing/shrinking the
// height would otherwise sink the base below — or float it above — the
// floor. This offsets scaleGroup so the base always lands exactly on the
// floor (footprint.baseY) regardless of scale.y; only the top moves.
function scaleAnchorOffsetY(height: number, scaleY: number) {
  return (height / 2) * (scaleY - 1);
}

function applyScaleLerp(
  entry: ModelEntry | null,
  target: { x: number; y: number; z: number },
  factor = ROOMS_SCALE_LERP,
) {
  if (!entry) return;
  entry.scaleGroup.scale.x = THREE.MathUtils.lerp(entry.scaleGroup.scale.x, target.x, factor);
  entry.scaleGroup.scale.y = THREE.MathUtils.lerp(entry.scaleGroup.scale.y, target.y, factor);
  entry.scaleGroup.scale.z = THREE.MathUtils.lerp(entry.scaleGroup.scale.z, target.z, factor);
  entry.scaleGroup.position.y = scaleAnchorOffsetY(entry.height, entry.scaleGroup.scale.y);
}

function setOpacity(entry: ModelEntry | null, value: number) {
  if (!entry) return;
  entry.materials.forEach((m) => {
    m.opacity = value;
  });
}

/**
 * Recenters the loaded FBX and wraps it in a scale group (rooms), registering
 * its materials so modernity changes can restyle them later without a
 * reload, and so a hotel-type swap can dissolve between them (see the
 * opacity crossfade in animate()).
 */
function buildEntry(
  object: THREE.Group,
  modernity: number,
  rooms: number,
  allMaterials: Set<THREE.MeshStandardMaterial>,
): ModelEntry {
  const box = new THREE.Box3().setFromObject(object);
  const center = box.getCenter(new THREE.Vector3());
  const size = box.getSize(new THREE.Vector3());
  object.position.sub(center);

  const { color, roughness } = materialParamsForModernity(modernity);
  const materials: THREE.MeshStandardMaterial[] = [];
  object.traverse((child) => {
    const mesh = child as THREE.Mesh;
    if (!mesh.isMesh) return;
    // No texture map → a plain, brightish neutral-grey material, so the
    // buildings render monochrome with lighting/shading only (no colour).
    // transparent+opacity drive the dissolve crossfade in animate().
    const material = new THREE.MeshStandardMaterial({
      color: color.clone(),
      roughness,
      metalness: 0,
      transparent: true,
      opacity: 1,
    });
    mesh.material = material;
    materials.push(material);
  });
  materials.forEach((m) => allMaterials.add(m));

  const sphere = box.getBoundingSphere(new THREE.Sphere());
  const radius = sphere.radius || 1;
  const height = Math.max(size.y, 0.01);

  const targetScale = computeRoomsScale(rooms);
  const scaleGroup = new THREE.Group();
  scaleGroup.scale.set(targetScale.x, targetScale.y, targetScale.z);
  scaleGroup.position.y = scaleAnchorOffsetY(height, targetScale.y);
  scaleGroup.add(object);

  const footprint: Footprint = {
    halfWidth: Math.max(size.x / 2, 0.01),
    halfDepth: Math.max(size.z / 2, 0.01),
    baseY: -size.y / 2,
    height,
  };

  return { scaleGroup, radius, height, footprint, materials };
}

function disposeEntry(entry: ModelEntry, allMaterials: Set<THREE.MeshStandardMaterial>) {
  entry.materials.forEach((m) => allMaterials.delete(m));
  disposeObject(entry.scaleGroup);
}

/**
 * Minimal Three.js building preview: loads an FBX from the asset pack onto a
 * transparent canvas so it appears to sit directly on the page (no panel or
 * background), standing on a rectangular floor with amenity-driven set
 * dressing (see groundDecor.ts). The specific building is chosen from the
 * selected hotel type; switching it dissolves (crossfades) between the old
 * and new model rather than a hard cut. Rooms smoothly scale the building
 * (mostly vertical); modernity restyles its material. The camera auto-fits
 * the *building's* bounding
 * sphere, interpolated across a transition, on load, and on every resize.
 */
export function SandboxModel({
  hotelType,
  rooms,
  modernity,
  amenities,
}: Pick<HotelConfigPayload, "hotelType" | "rooms" | "modernity" | "amenities">) {
  const mountRef = useRef<HTMLDivElement | null>(null);
  const modelSrc = modelUrl(modelForHotelType(hotelType));

  const hasPool = amenities.includes("pool");
  const petFriendly = amenities.includes("pet_friendly");
  const airportShuttle = amenities.includes("airport_shuttle");
  const hasParking = amenities.includes("parking");
  const hasEvCharging = amenities.includes("ev_charging");
  const hasPatioDining = amenities.includes("restaurant") || amenities.includes("bar");
  const hasConferenceCanopy = amenities.includes("conference_rooms");
  const hasSpa = amenities.includes("spa");

  // Bridges values that must NOT reload the FBX or reset the scene (amenity
  // toggles, rooms, modernity, hotelType-for-shuttle-kind) into the mount
  // effect's animate loop / the model-load effect, which only reruns when
  // the model source itself changes.
  const hotelTypeRef = useRef(hotelType);
  hotelTypeRef.current = hotelType;
  const roomsRef = useRef(rooms);
  roomsRef.current = rooms;
  const modernityRef = useRef(modernity);
  modernityRef.current = modernity;
  const hasPoolRef = useRef(hasPool);
  hasPoolRef.current = hasPool;
  const petFriendlyRef = useRef(petFriendly);
  petFriendlyRef.current = petFriendly;
  const airportShuttleRef = useRef(airportShuttle);
  airportShuttleRef.current = airportShuttle;
  const hasParkingRef = useRef(hasParking);
  hasParkingRef.current = hasParking;
  const hasEvChargingRef = useRef(hasEvCharging);
  hasEvChargingRef.current = hasEvCharging;
  const hasPatioDiningRef = useRef(hasPatioDining);
  hasPatioDiningRef.current = hasPatioDining;
  const hasConferenceCanopyRef = useRef(hasConferenceCanopy);
  hasConferenceCanopyRef.current = hasConferenceCanopy;
  const hasSpaRef = useRef(hasSpa);
  hasSpaRef.current = hasSpa;

  const pivotRef = useRef<THREE.Group | null>(null);
  const decorGroupRef = useRef<THREE.Group | null>(null);
  const footprintRef = useRef<Footprint | null>(null);
  const activeEntryRef = useRef<ModelEntry | null>(null);
  const transitionRef = useRef<TransitionState | null>(null);
  const loadTokenRef = useRef(0);
  const allMaterialsRef = useRef<Set<THREE.MeshStandardMaterial>>(new Set());

  function syncDecor() {
    const pivot = pivotRef.current;
    const footprint = footprintRef.current;
    if (!pivot || !footprint) return;
    const prev = decorGroupRef.current;
    if (prev) {
      pivot.remove(prev);
      disposeObject(prev);
    }
    const nextDecor = buildGroundDecor(footprint, hotelTypeRef.current, {
      hasPool: hasPoolRef.current,
      petFriendly: petFriendlyRef.current,
      airportShuttle: airportShuttleRef.current,
      hasParking: hasParkingRef.current,
      hasEvCharging: hasEvChargingRef.current,
      hasPatioDining: hasPatioDiningRef.current,
      hasConferenceCanopy: hasConferenceCanopyRef.current,
      hasSpa: hasSpaRef.current,
    });
    pivot.add(nextDecor);
    decorGroupRef.current = nextDecor;
  }

  // ---- Mount effect: scene, camera, renderer, lights, animate loop, resize.
  // Runs once; persists across hotelType/rooms/modernity/amenity changes so
  // those never tear down the canvas. ----
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
    renderer.domElement.style.cursor = "grab";
    renderer.domElement.style.touchAction = "none";

    // Camera orbit state. Auto-rotates (azimuth) until the user clicks/drags,
    // then stops for good; free dragging in any direction thereafter orbits
    // both azimuth and elevation; wheel zooms. Initialized from the same
    // fixed direction the camera used to sit at, so the default framing is
    // unchanged.
    const initialDir = new THREE.Vector3(1, 0.55, 1).normalize();
    let azimuth = Math.atan2(initialDir.x, initialDir.z);
    let elevation = Math.asin(initialDir.y);
    let zoom = 1;

    let autoRotate = true;
    let isDragging = false;
    let lastPointerX = 0;
    let lastPointerY = 0;

    function onPointerDown(e: PointerEvent) {
      autoRotate = false;
      isDragging = true;
      lastPointerX = e.clientX;
      lastPointerY = e.clientY;
      renderer.domElement.style.cursor = "grabbing";
      renderer.domElement.setPointerCapture(e.pointerId);
    }
    function onPointerMove(e: PointerEvent) {
      if (!isDragging) return;
      const dx = e.clientX - lastPointerX;
      const dy = e.clientY - lastPointerY;
      lastPointerX = e.clientX;
      lastPointerY = e.clientY;
      azimuth += dx * DRAG_ORBIT_SPEED;
      elevation = THREE.MathUtils.clamp(
        elevation - dy * DRAG_ORBIT_SPEED,
        ELEVATION_MIN,
        ELEVATION_MAX,
      );
    }
    function onPointerUp(e: PointerEvent) {
      isDragging = false;
      renderer.domElement.style.cursor = "grab";
      if (renderer.domElement.hasPointerCapture(e.pointerId)) {
        renderer.domElement.releasePointerCapture(e.pointerId);
      }
    }
    function onWheel(e: WheelEvent) {
      e.preventDefault();
      zoom = THREE.MathUtils.clamp(zoom + e.deltaY * ZOOM_WHEEL_SPEED, ZOOM_MIN, ZOOM_MAX);
    }
    renderer.domElement.addEventListener("pointerdown", onPointerDown);
    renderer.domElement.addEventListener("pointermove", onPointerMove);
    renderer.domElement.addEventListener("pointerup", onPointerUp);
    renderer.domElement.addEventListener("pointercancel", onPointerUp);
    renderer.domElement.addEventListener("wheel", onWheel, { passive: false });

    // Low ambient keeps unlit faces dark (deeper shadows); the key light lifts
    // the lit faces; the fill stops the shadow side going fully black.
    const ambient = new THREE.AmbientLight(0xffffff, LIGHT.ambient);
    scene.add(ambient);
    const key = new THREE.DirectionalLight(0xffffff, LIGHT.key);
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

    // Static parent group at the world origin holding the model + ground
    // decor together (the entry's scaleGroup centers the model on it) — it no
    // longer rotates itself; the camera orbits around it instead (see
    // azimuth/elevation above), which is what lets a vertical drag tilt the
    // view without tilting the ground along with it.
    const pivot = new THREE.Group();
    scene.add(pivot);
    pivotRef.current = pivot;

    function updateCamera(radius: number) {
      const fov = (camera.fov * Math.PI) / 180;
      const fitH = radius / Math.sin(fov / 2);
      const fitW = fitH / Math.min(1, camera.aspect);
      const distance = 1.25 * Math.max(fitH, fitW) * zoom;
      const dir = new THREE.Vector3(
        Math.cos(elevation) * Math.sin(azimuth),
        Math.sin(elevation),
        Math.cos(elevation) * Math.cos(azimuth),
      );
      camera.position.copy(dir.multiplyScalar(distance));
      camera.near = distance / 100;
      camera.far = distance * 100;
      camera.lookAt(0, 0, 0);
      camera.updateProjectionMatrix();
    }

    let currentRadius = 1;

    function animate() {
      if (disposed) return;
      frame = requestAnimationFrame(animate);
      if (autoRotate) azimuth += AUTO_ROTATE_SPEED;

      const transition = transitionRef.current;
      let displayRadius = activeEntryRef.current?.radius ?? currentRadius;

      if (transition) {
        const elapsed = performance.now() - transition.start;
        const p = Math.min(1, elapsed / transition.duration);
        const eased = easeInOutCubic(p);

        if (transition.from) {
          setOpacity(transition.from, 1 - eased);
          displayRadius = THREE.MathUtils.lerp(transition.from.radius, transition.to.radius, eased);
        } else {
          displayRadius = transition.to.radius;
        }
        setOpacity(transition.to, eased);

        if (p >= 1) {
          setOpacity(transition.to, 1);
          if (transition.from) {
            pivot.remove(transition.from.scaleGroup);
            disposeEntry(transition.from, allMaterialsRef.current);
          }
          activeEntryRef.current = transition.to;
          transitionRef.current = null;
        }
      }

      const targetScale = computeRoomsScale(roomsRef.current);
      if (transitionRef.current) {
        applyScaleLerp(transitionRef.current.to, targetScale);
        if (transitionRef.current.from) applyScaleLerp(transitionRef.current.from, targetScale);
      } else {
        applyScaleLerp(activeEntryRef.current, targetScale);
      }

      currentRadius = displayRadius;
      updateCamera(displayRadius);
      renderer.render(scene, camera);
    }
    animate();

    function resize() {
      const w = el.clientWidth || 1;
      const h = el.clientHeight || 1;
      renderer.setSize(w, h, false);
      camera.aspect = w / h;
      updateCamera(currentRadius);
    }
    const resizeObserver = new ResizeObserver(resize);
    resizeObserver.observe(el);
    resize();

    return () => {
      disposed = true;
      cancelAnimationFrame(frame);
      resizeObserver.disconnect();
      renderer.domElement.removeEventListener("pointerdown", onPointerDown);
      renderer.domElement.removeEventListener("pointermove", onPointerMove);
      renderer.domElement.removeEventListener("pointerup", onPointerUp);
      renderer.domElement.removeEventListener("pointercancel", onPointerUp);
      renderer.domElement.removeEventListener("wheel", onWheel);

      const transition = transitionRef.current;
      if (transition) {
        if (transition.from) disposeEntry(transition.from, allMaterialsRef.current);
        disposeEntry(transition.to, allMaterialsRef.current);
        transitionRef.current = null;
      } else if (activeEntryRef.current) {
        disposeEntry(activeEntryRef.current, allMaterialsRef.current);
      }
      activeEntryRef.current = null;

      if (decorGroupRef.current) disposeObject(decorGroupRef.current);
      decorGroupRef.current = null;
      pivotRef.current = null;
      footprintRef.current = null;

      scene.remove(pivot);
      renderer.dispose();
      renderer.forceContextLoss();
      if (renderer.domElement.parentNode === el) {
        el.removeChild(renderer.domElement);
      }
    };
  }, []);

  // ---- Model-load effect: loads the FBX for the current hotelType and
  // starts a dissolve transition against whatever's currently active. ----
  useEffect(() => {
    loadTokenRef.current += 1;
    const myToken = loadTokenRef.current;
    let cancelled = false;

    new FBXLoader().load(
      modelSrc,
      (object) => {
        if (cancelled || myToken !== loadTokenRef.current) {
          disposeObject(object);
          return;
        }
        const pivot = pivotRef.current;
        if (!pivot) {
          disposeObject(object);
          return;
        }

        const newEntry = buildEntry(
          object,
          modernityRef.current,
          roomsRef.current,
          allMaterialsRef.current,
        );

        // A hotelType change arriving mid-transition: snap the in-flight one
        // to its end state first, rather than stacking a 3-way interpolation.
        const inFlight = transitionRef.current;
        if (inFlight) {
          if (inFlight.from) {
            pivot.remove(inFlight.from.scaleGroup);
            disposeEntry(inFlight.from, allMaterialsRef.current);
          }
          setOpacity(inFlight.to, 1);
          activeEntryRef.current = inFlight.to;
          transitionRef.current = null;
        }

        pivot.add(newEntry.scaleGroup);
        transitionRef.current = {
          from: activeEntryRef.current,
          to: newEntry,
          start: performance.now(),
          duration: activeEntryRef.current ? SWAP_DURATION_MS : FIRST_LOAD_DURATION_MS,
        };

        footprintRef.current = newEntry.footprint;
        syncDecor();
      },
      undefined,
      (err) => {
        // eslint-disable-next-line no-console
        console.warn("Failed to load building model", err);
      },
    );

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [modelSrc]);

  // ---- Modernity changes restyle already-loaded materials directly; no
  // reload, no per-frame animation needed (a material tweak isn't a pop). ----
  useEffect(() => {
    const { color, roughness } = materialParamsForModernity(modernity);
    allMaterialsRef.current.forEach((m) => {
      m.color.copy(color);
      m.roughness = roughness;
    });
  }, [modernity]);

  // ---- Amenity toggles rebuild only the ground-decor group, via the ref the
  // mount effect wired up — no FBX reload, no scene reset. ----
  useEffect(() => {
    syncDecor();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    hasPool,
    petFriendly,
    airportShuttle,
    hasParking,
    hasEvCharging,
    hasPatioDining,
    hasConferenceCanopy,
    hasSpa,
  ]);

  return <div ref={mountRef} className="h-full w-full" aria-hidden="true" />;
}
