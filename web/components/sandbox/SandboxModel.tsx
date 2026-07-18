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

/**
 * Minimal Three.js building preview: loads an FBX from the asset pack onto a
 * transparent canvas so it appears to sit directly on the page (no panel or
 * background). The specific building is chosen from the selected hotel type,
 * and swaps when that changes. The camera auto-fits the model's bounding box on
 * load and on every resize, so the building is always fully framed and never
 * clipped. Deliberately bare — no controls or overlays.
 */
export function SandboxModel({
  hotelType,
}: {
  hotelType: HotelConfigPayload["hotelType"];
}) {
  const mountRef = useRef<HTMLDivElement | null>(null);
  const modelSrc = modelUrl(modelForHotelType(hotelType));

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
    // Rotating the model around its own origin spins it in a wide arc (the
    // geometry sits far from that origin). Parent it under a pivot at the world
    // origin and offset the model so its center lands on the pivot — rotating
    // the pivot then spins around the building's center.
    const pivot = new THREE.Group();
    scene.add(pivot);

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
        object.position.sub(center);
        const sphere = box.getBoundingSphere(new THREE.Sphere());
        modelRadius = sphere.radius || 1;

        model = object;
        pivot.add(object);
        fitCamera();
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
      scene.remove(pivot);
      if (model) {
        model.traverse((child) => {
          const mesh = child as THREE.Mesh;
          if (mesh.geometry) mesh.geometry.dispose();
          const mat = mesh.material;
          if (Array.isArray(mat)) mat.forEach((m) => m.dispose());
          else if (mat) mat.dispose();
        });
      }
      renderer.dispose();
      renderer.forceContextLoss();
      if (renderer.domElement.parentNode === el) {
        el.removeChild(renderer.domElement);
      }
    };
  }, [modelSrc]);

  return <div ref={mountRef} className="h-full w-full" aria-hidden="true" />;
}
