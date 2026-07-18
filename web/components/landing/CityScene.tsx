"use client";

import { useEffect, useRef } from "react";
import * as THREE from "three";

const randomFrom = (seed: number) => {
  let value = seed;
  return () => ((value = (value * 9301 + 49297) % 233280) / 233280);
};

export function CityScene() {
  const mountRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const pointerRef = useRef({ x: 0, y: 0 });

  // Cursor motion also moves the guaranteed first-paint skyline. This effect
  // is intentionally independent from WebGL initialization.
  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;
    const move = (event: PointerEvent) => {
      const x = (event.clientX / Math.max(window.innerWidth, 1)) * 2 - 1;
      const y = (event.clientY / Math.max(window.innerHeight, 1)) * 2 - 1;
      pointerRef.current = { x, y };
      mount.style.setProperty("--city-shift-x", `${x * -12}px`);
      mount.style.setProperty("--city-shift-y", `${y * -6}px`);
    };
    const reset = () => {
      pointerRef.current = { x: 0, y: 0 };
      mount.style.setProperty("--city-shift-x", "0px");
      mount.style.setProperty("--city-shift-y", "0px");
    };
    window.addEventListener("pointermove", move, { passive: true });
    window.addEventListener("blur", reset);
    return () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("blur", reset);
    };
  }, []);

  useEffect(() => {
    const mount = mountRef.current;
    const canvas = canvasRef.current;
    if (!mount || !canvas) return;

    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
    } catch {
      return; // The architectural fallback remains fully visible.
    }

    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setClearColor(0xf6f7f5, 0);
    renderer.outputColorSpace = THREE.SRGBColorSpace;

    const scene = new THREE.Scene();
    scene.fog = new THREE.FogExp2(0xf5f6f4, 0.0025);
    const camera = new THREE.PerspectiveCamera(48, 1, 0.1, 200);
    camera.position.set(0, 28, 46);

    const city = new THREE.Group();
    // Sink the building bases below the viewport; no ground plane is rendered.
    city.position.set(6, -18, 0);
    scene.add(city);

    const materials = [0xf1f3f3, 0xe0e4e5, 0xf8f8f6, 0xd1d7d8].map(
      (color) => new THREE.MeshStandardMaterial({ color, roughness: 0.78 }),
    );
    const accent = new THREE.MeshBasicMaterial({ color: 0xaeb8bb });
    const random = randomFrom(4702);

    for (let x = -8; x <= 9; x += 1) {
      for (let z = -3; z <= 6; z += 1) {
        if (x >= 4 && x <= 6 && z >= -1 && z <= 2) continue;
        if (random() < 0.2) continue;
        const height = 5 + random() * 16 + Math.max(0, 5 - Math.abs(x) * 0.45);
        const width = 1.5 + random() * 1.7;
        const depth = 1.5 + random() * 1.7;
        const building = new THREE.Mesh(
          new THREE.BoxGeometry(width, height, depth),
          materials[Math.floor(random() * materials.length)],
        );
        building.position.set(x * 3.1, height / 2, z * 3.3);
        city.add(building);
        if (random() > 0.48) {
          const roof = new THREE.Mesh(new THREE.BoxGeometry(width * 0.15, 0.06, depth * 0.15), accent);
          roof.position.set(building.position.x, height + 0.05, building.position.z);
          city.add(roof);
        }
      }
    }

    const tower = new THREE.Group();
    const concrete = new THREE.MeshStandardMaterial({ color: 0xa9b0ad, roughness: 0.72 });
    const towerGlass = new THREE.MeshStandardMaterial({ color: 0x607c7e, roughness: 0.22, metalness: 0.16 });
    const mastMaterial = new THREE.MeshStandardMaterial({ color: 0x939b98, roughness: 0.62 });
    const cylinderBetween = (start: THREE.Vector3, end: THREE.Vector3, radius: number) => {
      const direction = new THREE.Vector3().subVectors(end, start);
      const mesh = new THREE.Mesh(
        new THREE.CylinderGeometry(radius * 0.68, radius, direction.length(), 12),
        concrete,
      );
      mesh.position.copy(start).add(end).multiplyScalar(0.5);
      mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction.clone().normalize());
      tower.add(mesh);
    };
    for (let index = 0; index < 3; index += 1) {
      const angle = (index / 3) * Math.PI * 2;
      cylinderBetween(
        new THREE.Vector3(Math.cos(angle) * 2.2, 0, Math.sin(angle) * 2.2),
        new THREE.Vector3(Math.cos(angle) * 0.6, 14, Math.sin(angle) * 0.6),
        0.62,
      );
    }
    const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.48, 0.78, 14, 18), concrete);
    shaft.position.y = 20;
    tower.add(shaft);
    const podBase = new THREE.Mesh(new THREE.CylinderGeometry(2.15, 1.25, 0.85, 32), concrete);
    podBase.position.y = 27.2;
    tower.add(podBase);
    const mainPod = new THREE.Mesh(new THREE.CylinderGeometry(2.2, 2.2, 0.8, 32), towerGlass);
    mainPod.position.y = 28;
    tower.add(mainPod);
    const podRoof = new THREE.Mesh(new THREE.CylinderGeometry(1.25, 2.2, 0.65, 32), concrete);
    podRoof.position.y = 28.72;
    tower.add(podRoof);
    const upperShaft = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.4, 5.2, 16), concrete);
    upperShaft.position.y = 31.55;
    tower.add(upperShaft);
    const skyPod = new THREE.Mesh(new THREE.CylinderGeometry(0.72, 0.62, 0.72, 24), towerGlass);
    skyPod.position.y = 34.1;
    tower.add(skyPod);
    const antenna = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.18, 9.3, 10), mastMaterial);
    antenna.position.y = 39.1;
    tower.add(antenna);
    tower.position.set(15, 0, 1);
    city.add(tower);

    scene.add(new THREE.HemisphereLight(0xffffff, 0xaeb8ba, 1.3));
    const sun = new THREE.DirectionalLight(0xffffff, 1.6);
    sun.position.set(-16, 30, 18);
    scene.add(sun);

    const cameraPosition = new THREE.Vector3();
    const cameraTarget = new THREE.Vector3();
    const resize = () => {
      const width = mount.clientWidth;
      const height = mount.clientHeight;
      renderer.setSize(width, height, false);
      camera.aspect = width / Math.max(height, 1);
      camera.updateProjectionMatrix();
    };
    const observer = new ResizeObserver(resize);
    observer.observe(mount);
    resize();

    let frame = 0;
    const animate = () => {
      frame = requestAnimationFrame(animate);
      const { x, y } = pointerRef.current;
      cameraPosition.set(x * 1.8, 28 - y * 1.1, 46);
      camera.position.lerp(cameraPosition, 0.045);
      cameraTarget.set(x * 0.35, 10 - y * 0.2, 0);
      camera.lookAt(cameraTarget);
      renderer.render(scene, camera);
      mount.classList.add("webgl-ready");
    };
    animate();

    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
      mount.classList.remove("webgl-ready");
      scene.traverse((object) => {
        if (!(object instanceof THREE.Mesh)) return;
        object.geometry.dispose();
        const meshMaterials = Array.isArray(object.material) ? object.material : [object.material];
        meshMaterials.forEach((material) => material.dispose());
      });
      renderer.dispose();
    };
  }, []);

  return (
    <div ref={mountRef} className="landing-city" aria-label="Interactive three-dimensional Toronto skyline">
      <div className="landing-skyline-fallback" aria-hidden="true">
        <div className="fallback-buildings">{Array.from({ length: 14 }, (_, index) => <span key={index} />)}</div>
        <div className="fallback-cn-tower">
          <span className="fallback-antenna" /><span className="fallback-skypod" />
          <span className="fallback-upper-shaft" /><span className="fallback-main-pod" />
          <span className="fallback-tower-shaft" />
          <span className="fallback-tower-leg fallback-tower-leg-left" />
          <span className="fallback-tower-leg fallback-tower-leg-right" />
        </div>
      </div>
      <canvas ref={canvasRef} />
    </div>
  );
}
