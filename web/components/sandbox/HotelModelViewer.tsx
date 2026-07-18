"use client";

import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";

/**
 * Inline 3D viewport that fills its parent container (the left half of the
 * Sandbox, beside the metrics output).
 *
 * Placeholder stage: renders a single rotating cube standing in for the hotel
 * building, with OrbitControls (drag to orbit, scroll to zoom). Real building
 * models will replace the cube later.
 *
 * WebGL contexts are a scarce browser resource (~16 live at once). The cleanup
 * explicitly frees this one via forceContextLoss() so dev Fast Refresh and page
 * navigation don't leak contexts.
 */
export function HotelModelViewer() {
  const mountRef = useRef<HTMLDivElement | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;
    const el: HTMLDivElement = mount;

    let disposed = false;
    let frame = 0;
    let renderer: THREE.WebGLRenderer;

    try {
      // antialias off + a tolerant power preference maximises the chance of a
      // context in constrained/software-GL environments (VMs, remote desktops).
      renderer = new THREE.WebGLRenderer({
        antialias: false,
        alpha: false,
        powerPreference: "default",
        failIfMajorPerformanceCaveat: false,
      });
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "WebGL context unavailable",
      );
      return;
    }

    const rect = el.getBoundingClientRect();
    const initialWidth = el.clientWidth || rect.width || 400;
    const initialHeight = el.clientHeight || rect.height || 400;

    const scene = new THREE.Scene();
    // Dark scene background: makes the placeholder cube pop, and is an obvious
    // signal that the GL context is actually drawing (vs. the grey container
    // showing through when nothing renders).
    scene.background = new THREE.Color(0x0f172a); // slate-900

    const camera = new THREE.PerspectiveCamera(
      45,
      initialWidth / initialHeight,
      0.1,
      100,
    );
    camera.position.set(3, 2.2, 3);

    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(initialWidth, initialHeight);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    el.appendChild(renderer.domElement);
    renderer.domElement.style.width = "100%";
    renderer.domElement.style.height = "100%";
    renderer.domElement.style.display = "block";

    // If the GL context is lost (eviction, GPU reset), surface it instead of
    // silently showing a blank canvas.
    renderer.domElement.addEventListener("webglcontextlost", (e) => {
      e.preventDefault();
      if (!disposed) setError("WebGL context lost");
    });

    scene.add(new THREE.AmbientLight(0xffffff, 1.1));
    const key = new THREE.DirectionalLight(0xffffff, 1.6);
    key.position.set(2, 3, 2);
    scene.add(key);
    const fill = new THREE.DirectionalLight(0xffffff, 0.5);
    fill.position.set(-2, 1, -1.5);
    scene.add(fill);

    // Placeholder "building" — a simple cube.
    const geometry = new THREE.BoxGeometry(1.4, 1.4, 1.4);
    const material = new THREE.MeshStandardMaterial({
      color: 0x2563eb,
      roughness: 0.55,
      metalness: 0.1,
    });
    const cube = new THREE.Mesh(geometry, material);
    scene.add(cube);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.08;
    controls.enablePan = false;
    controls.minDistance = 2;
    controls.maxDistance = 8;
    controls.target.set(0, 0, 0);
    controls.update();

    function render() {
      renderer.render(scene, camera);
    }

    function animate() {
      if (disposed) return;
      frame = requestAnimationFrame(animate);
      cube.rotation.y += 0.005;
      controls.update();
      render();
    }
    animate();

    function resize() {
      const w = el.clientWidth || 1;
      const h = el.clientHeight || 1;
      renderer.setSize(w, h, false);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      render();
    }
    const resizeObserver = new ResizeObserver(resize);
    resizeObserver.observe(el);
    resize();

    return () => {
      disposed = true;
      cancelAnimationFrame(frame);
      resizeObserver.disconnect();
      controls.dispose();
      geometry.dispose();
      material.dispose();
      renderer.dispose();
      renderer.forceContextLoss();
      if (renderer.domElement.parentNode === el) {
        el.removeChild(renderer.domElement);
      }
    };
  }, []);

  return (
    <div className="relative h-full w-full">
      <div ref={mountRef} className="h-full w-full" aria-hidden="true" />
      {error ? (
        <div className="absolute inset-0 flex items-center justify-center px-4 text-center text-sm text-slate-500">
          3D preview unavailable ({error}).
        </div>
      ) : null}
    </div>
  );
}
