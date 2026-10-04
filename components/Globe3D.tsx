"use client";

import { Canvas, useFrame } from '@react-three/fiber';
import { Html, OrbitControls } from '@react-three/drei';
import * as THREE from 'three';
import { useEffect, useMemo, useRef, useState } from 'react';
import { carbonColor } from '@/lib/colors';
import { REGIONS } from '@/lib/regions';
import type { RegionId } from '@/lib/types';
import CanvasErrorBoundary from './CanvasErrorBoundary';

const R = 1.28;
const HUB = { lat: 19.076, lon: 72.8777 };

export interface GlobeNode {
  id: RegionId;
  carbon_ci: number;
  weight: number;
  eligible: boolean;
  latency_ms?: number;
}

function latLonToVector(lat: number, lon: number, radius = R): THREE.Vector3 {
  const phi = (90 - lat) * Math.PI / 180;
  const theta = (lon + 180) * Math.PI / 180;
  return new THREE.Vector3(
    -radius * Math.sin(phi) * Math.cos(theta),
    radius * Math.cos(phi),
    radius * Math.sin(phi) * Math.sin(theta),
  );
}

function dayOfYear(date: Date): number {
  const start = Date.UTC(date.getUTCFullYear(), 0, 0);
  return Math.floor((date.getTime() - start) / 86_400_000);
}

function sunDirection(time: Date): THREE.Vector3 {
  const hour = time.getUTCHours() + time.getUTCMinutes() / 60;
  const day = dayOfYear(time);
  const lon = (12 - hour) * 15;
  const decl = 23.44 * Math.sin((2 * Math.PI * (day - 80)) / 365.25);
  return latLonToVector(decl, lon, 1).normalize();
}

function curvePoints(from: THREE.Vector3, to: THREE.Vector3): Float32Array {
  const mid = from.clone().add(to).multiplyScalar(0.5).normalize().multiplyScalar(R * 1.42);
  const points = [
    from.clone().normalize().multiplyScalar(R + 0.05),
    from.clone().lerp(mid, 0.28).normalize().multiplyScalar(R + 0.18),
    mid,
    to.clone().lerp(mid, 0.72).normalize().multiplyScalar(R + 0.18),
    to.clone().normalize().multiplyScalar(R + 0.05),
  ];
  const samples: number[] = [];
  for (let i = 0; i < points.length - 1; i += 1) {
    const a = points[i] as THREE.Vector3;
    const b = points[i + 1] as THREE.Vector3;
    for (let s = 0; s < 8; s += 1) {
      const t = s / 8;
      const q = a.clone().lerp(b, t);
      samples.push(q.x, q.y, q.z);
    }
  }
  const last = points.at(-1) as THREE.Vector3;
  samples.push(last.x, last.y, last.z);
  return new Float32Array(samples);
}

type LonLat = [number, number];
const LAND: LonLat[][] = [
  [[-168,66],[-141,70],[-110,73],[-85,70],[-78,62],[-65,60],[-56,52],[-66,44],[-75,38],[-81,31],[-80,25],[-84,30],[-97,28],[-97,22],[-88,21],[-83,10],[-78,8],[-86,12],[-92,15],[-105,20],[-110,24],[-115,31],[-124,40],[-125,48],[-135,57],[-150,60],[-165,60]],
  [[-55,60],[-45,60],[-20,70],[-20,82],[-50,83],[-70,78],[-58,70]],
  [[-78,8],[-62,11],[-50,0],[-35,-6],[-39,-15],[-48,-26],[-58,-38],[-66,-46],[-70,-54],[-74,-50],[-73,-38],[-70,-20],[-81,-5],[-80,2]],
  [[-10,36],[-9,43],[-1,46],[-4,48],[5,52],[8,57],[5,62],[15,69],[30,71],[60,69],[80,73],[110,77],[140,72],[170,70],[180,66],[165,60],[155,57],[140,52],[135,43],[128,38],[122,40],[121,31],[120,24],[108,21],[106,10],[100,13],[103,1],[98,8],[94,17],[88,22],[80,15],[77,8],[73,17],[70,22],[62,25],[57,26],[50,30],[48,28],[56,24],[59,22],[52,16],[43,13],[35,28],[34,31],[36,36],[28,37],[26,40],[23,37],[20,40],[16,38],[12,42],[8,44],[3,43],[-5,36]],
  [[-17,21],[-10,35],[10,37],[32,31],[35,28],[43,12],[51,12],[40,-3],[40,-15],[35,-24],[32,-29],[20,-35],[15,-28],[12,-12],[9,-1],[9,4],[-8,4],[-15,11]],
  [[114,-22],[122,-18],[131,-12],[142,-11],[146,-19],[153,-26],[150,-37],[141,-38],[131,-31],[115,-34]],
  [[-6,50],[2,51],[0,58],[-6,58]],
  [[130,31],[141,36],[142,44],[140,41],[135,34]],
  [[95,5],[105,-6],[120,-8],[140,-8],[130,-1],[110,-1]],
];

function insidePolygon(lon: number, lat: number, poly: LonLat[]): boolean {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i, i += 1) {
    const [xi, yi] = poly[i] as LonLat;
    const [xj, yj] = poly[j] as LonLat;
    if ((yi > lat) !== (yj > lat) && lon < ((xj - xi) * (lat - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

function buildLandPoints(): Float32Array {
  const out: number[] = [];
  for (let lat = -58; lat <= 82; lat += 2.6) {
    const step = 2.6 / Math.max(0.25, Math.cos((lat * Math.PI) / 180));
    for (let lon = -180; lon < 180; lon += step) {
      if (LAND.some((poly) => insidePolygon(lon, lat, poly))) {
        const v = latLonToVector(lat, lon, R + 0.004);
        out.push(v.x, v.y, v.z);
      }
    }
  }
  return new Float32Array(out);
}

function Earth({ time }: { time: Date }) {
  const land = useMemo(() => buildLandPoints(), []);
  const geometry = useMemo(() => {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(land, 3));
    g.setAttribute('color', new THREE.BufferAttribute(new Float32Array(land.length), 3));
    return g;
  }, [land]);
  // Re-shade the land dots as the simulation clock advances (day side bright, night side dim).
  useEffect(() => {
    const sun = sunDirection(time);
    const colors = geometry.getAttribute('color') as THREE.BufferAttribute;
    const day = new THREE.Color('#5eead4');
    const night = new THREE.Color('#134e5a');
    const tmp = new THREE.Color();
    for (let i = 0; i < land.length; i += 3) {
      const d = new THREE.Vector3(land[i], land[i + 1], land[i + 2]).normalize().dot(sun);
      tmp.copy(night).lerp(day, Math.min(1, Math.max(0, (d + 0.15) / 0.5)));
      colors.setXYZ(i / 3, tmp.r, tmp.g, tmp.b);
    }
    colors.needsUpdate = true;
  }, [geometry, land, time]);
  const swallow = (event: { stopPropagation: () => void }) => event.stopPropagation();
  return (
    <>
      <mesh onPointerOver={swallow} onPointerOut={swallow} onPointerMove={swallow}>
        <sphereGeometry args={[R, 48, 32]} />
        <meshBasicMaterial color="#061621" />
      </mesh>
      <mesh>
        <sphereGeometry args={[R + 0.008, 36, 24]} />
        <meshBasicMaterial color="#155e75" wireframe transparent opacity={0.18} />
      </mesh>
      <points geometry={geometry}>
        <pointsMaterial size={0.024} vertexColors transparent opacity={0.95} sizeAttenuation depthWrite={false} />
      </points>
      <mesh>
        <sphereGeometry args={[R * 1.09, 40, 24]} />
        <meshBasicMaterial color="#22d3ee" transparent opacity={0.07} side={THREE.BackSide} depthWrite={false} />
      </mesh>
    </>
  );
}

function Arc({ node }: { node: GlobeNode }) {
  const geometry = useMemo(() => {
    const start = latLonToVector(HUB.lat, HUB.lon, R);
    const end = latLonToVector(REGIONS[node.id].lat, REGIONS[node.id].lon, R);
    const position = curvePoints(start, end);
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(position, 3));
    return g;
  }, [node.id]);
  const color = node.eligible ? carbonColor(node.carbon_ci) : '#fb7185';
  if (node.weight <= 0.005) return null;
  return (
    <lineSegments geometry={geometry}>
      <lineBasicMaterial color={color} transparent opacity={0.18 + Math.min(0.55, node.weight * 0.7)} />
    </lineSegments>
  );
}

function Particle({ node, index, reduced }: { node: GlobeNode; index: number; reduced: boolean }) {
  const ref = useRef<THREE.Mesh>(null);
  const points = useMemo(() => {
    const start = latLonToVector(HUB.lat, HUB.lon, R);
    const end = latLonToVector(REGIONS[node.id].lat, REGIONS[node.id].lon, R);
    return curvePoints(start, end);
  }, [node.id]);
  const vector = useMemo(() => new THREE.Vector3(), []);
  const max = Math.max(0, points.length / 3 - 1);
  const color = node.eligible ? carbonColor(node.carbon_ci) : '#fb7185';

  useFrame(({ clock }) => {
    if (!ref.current) return;
    ref.current.visible = node.weight > 0.005;
    if (node.weight <= 0.005) return;
    const speed = 0.22 + Math.min(0.5, node.weight * 1.4);
    const t = (clock.elapsedTime * speed + index * 0.23) % 1;
    const f = t * max;
    const lo = Math.min(max - 1, Math.floor(f));
    const k = f - lo;
    const i = Math.max(0, lo) * 3;
    vector.set(
      (points[i] as number) * (1 - k) + (points[i + 3] as number) * k,
      (points[i + 1] as number) * (1 - k) + (points[i + 4] as number) * k,
      (points[i + 2] as number) * (1 - k) + (points[i + 5] as number) * k,
    );
    ref.current.position.copy(vector);
    const pulse = 0.65 + 0.35 * Math.sin(clock.elapsedTime * 5 + index);
    const size = (0.018 + Math.min(0.026, node.weight * 0.06)) * pulse * (reduced ? 0.8 : 1);
    ref.current.scale.setScalar(size);
  });

  return (
    <mesh ref={ref}>
      <sphereGeometry args={[1, 6, 6]} />
      <meshBasicMaterial color={color} transparent opacity={0.9} depthWrite={false} />
    </mesh>
  );
}

function Pin({ node, time, onSelect }: { node: GlobeNode; time: Date; onSelect: (id: RegionId) => void }) {
  const ref = useRef<THREE.Mesh>(null);
  const [hovered, setHovered] = useState(false);
  const meta = REGIONS[node.id];
  const pos = useMemo(() => latLonToVector(meta?.lat ?? 0, meta?.lon ?? 0, R + 0.02), [meta?.lat, meta?.lon]);
  const daylight = pos.clone().normalize().dot(sunDirection(time)) > 0.08;
  const color = node.eligible ? carbonColor(node.carbon_ci) : '#fb7185';

  useEffect(() => {
    document.body.style.cursor = hovered ? 'pointer' : '';
    return () => { document.body.style.cursor = ''; };
  }, [hovered]);

  useFrame(({ clock }) => {
    if (!ref.current || !meta) return;
    const pulse = 1 + Math.sin(clock.elapsedTime * 4 + meta.lat) * 0.12 + Math.min(0.22, node.weight * 0.5);
    ref.current.scale.setScalar(0.72 * pulse);
  });

  if (!meta) return null;
  return (
    <group position={pos}>
      <mesh
        ref={ref}
        onClick={(event) => { event.stopPropagation(); onSelect(node.id); }}
        onPointerOver={(event) => { event.stopPropagation(); setHovered(true); }}
        onPointerOut={(event) => { event.stopPropagation(); setHovered(false); }}
      >
        <sphereGeometry args={[0.07, 12, 12]} />
        <meshBasicMaterial color={color} transparent opacity={node.eligible ? 1 : 0.55} />
      </mesh>
      <mesh rotation={[Math.PI / 2, 0, 0]}>
        <ringGeometry args={[0.075, 0.11 + node.weight * 0.1, 20]} />
        <meshBasicMaterial color={color} transparent opacity={daylight && node.eligible ? 0.5 : 0.22} side={THREE.DoubleSide} />
      </mesh>
      {hovered ? (
        <Html position={[0, 0.2, 0]} center style={{ pointerEvents: 'none' }}>
          <div className="whitespace-nowrap rounded-md border border-white/10 bg-slate-950/90 px-2 py-1 text-[10px] text-slate-200 shadow-lg">
            <b>{meta.city}</b> · {Math.round(node.carbon_ci)} g · {Math.round(node.weight * 100)}%{node.eligible ? '' : ' · excluded'}
          </div>
        </Html>
      ) : null}
    </group>
  );
}

function HubMarker() {
  const ref = useRef<THREE.Mesh>(null);
  const pos = useMemo(() => latLonToVector(HUB.lat, HUB.lon, R + 0.03), []);
  useFrame(({ clock }) => {
    if (!ref.current) return;
    const k = (clock.elapsedTime * 0.8) % 1;
    ref.current.scale.setScalar(1 + k * 2.2);
    (ref.current.material as THREE.MeshBasicMaterial).opacity = 0.6 * (1 - k);
  });
  return (
    <group position={pos} quaternion={new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), pos.clone().normalize())}>
      <mesh ref={ref}>
        <ringGeometry args={[0.06, 0.075, 28]} />
        <meshBasicMaterial color="#fde68a" transparent opacity={0.6} side={THREE.DoubleSide} depthWrite={false} />
      </mesh>
    </group>
  );
}

function Scene({ nodes, time, onSelect, reduced, onWeakGpu }: { nodes: GlobeNode[]; time: Date; onSelect: (id: RegionId) => void; reduced: boolean; onWeakGpu: (weak: boolean) => void }) {
  const measured = useRef(false);
  const start = useRef(0);
  const frames = useRef(0);
  const slow = useRef(0);
  const fast = useRef(0);
  const weak = useRef(false);
  useFrame(({ clock }) => {
    if (clock.elapsedTime < 3) return; // ignore shader-compile warm-up
    if (!measured.current) {
      measured.current = true;
      start.current = clock.elapsedTime;
      frames.current = 0;
    }
    frames.current += 1;
    const elapsed = clock.elapsedTime - start.current;
    if (elapsed >= 1) {
      const slowWindow = frames.current / elapsed < 28;
      slow.current = slowWindow ? slow.current + 1 : 0;
      fast.current = slowWindow ? 0 : fast.current + 1;
      if (!weak.current && slow.current >= 3) { weak.current = true; onWeakGpu(true); }
      if (weak.current && fast.current >= 6) { weak.current = false; onWeakGpu(false); }
      measured.current = false;
    }
  });

  const particleCount = reduced ? 1 : 2;

  return (
    <>
      <Earth time={time} />
      <HubMarker />
      {nodes.map((node) => <Arc key={`arc-${node.id}`} node={node} />)}
      {nodes.flatMap((node) => Array.from({ length: particleCount }, (_, index) => (
        <Particle key={`particle-${node.id}-${index}`} node={node} index={index} reduced={reduced} />
      )))}
      {nodes.map((node) => <Pin key={`pin-${node.id}`} node={node} time={time} onSelect={onSelect} />)}
    </>
  );
}

export default function Globe3D({ nodes, time, onSelect }: { nodes: GlobeNode[]; time: Date; onSelect: (id: RegionId) => void }) {
  const [webgl, setWebgl] = useState(true);
  const [reduced, setReduced] = useState(false);
  const [weak, setWeak] = useState(false);
  const [canvasKey, setCanvasKey] = useState(0);
  const [lost, setLost] = useState(false);

  useEffect(() => {
    try {
      const canvas = document.createElement('canvas');
      const context = canvas.getContext('webgl2') ?? canvas.getContext('webgl');
      setWebgl(Boolean(context));
      context?.getExtension('WEBGL_lose_context')?.loseContext(); // release the probe context
    } catch {
      setWebgl(false);
    }
    const query = window.matchMedia('(prefers-reduced-motion: reduce)');
    setReduced(query.matches);
    const onChange = (event: MediaQueryListEvent) => setReduced(event.matches);
    query.addEventListener?.('change', onChange);
    return () => query.removeEventListener?.('change', onChange);
  }, []);

  if (!webgl) {
    return <div className="grid min-h-[440px] place-items-center rounded-2xl border border-amber-400/20 bg-amber-400/5 p-6 text-center text-sm text-slate-400">WebGL is unavailable in this browser. The controller remains operational and all allocation controls are still active.</div>;
  }

  return (
    <section className="relative h-[460px] w-full overflow-hidden sm:h-[520px] rounded-2xl border border-cyan-400/15 bg-slate-950/80 shadow-[0_28px_90px_-34px_rgba(6,182,212,0.26)]">
      <div className="pointer-events-none absolute left-4 top-4 z-10">
        <p className="text-[10px] uppercase tracking-[0.18em] text-cyan-300/80">Global dispatch mesh</p>
        <p className="mt-1 text-xs text-slate-500">{weak ? 'low-GPU mode' : 'live particle routing'} · {nodes.filter((n) => n.eligible).length} eligible nodes</p>
      </div>
      <CanvasErrorBoundary fallback={<div className="grid h-full place-items-center p-6 text-center text-sm text-slate-500">3D rendering is unavailable on this device. The rest of the controller is unaffected.</div>}>
        <div className="absolute inset-0">
        <Canvas
          key={canvasKey}
          onCreated={({ gl }) => {
            gl.domElement.addEventListener('webglcontextlost', (event) => { event.preventDefault(); setLost(true); });
            gl.domElement.addEventListener('webglcontextrestored', () => setLost(false));
          }}
          camera={{ position: [0, 0, 4.25], fov: 46 }}
          dpr={weak ? 0.8 : [1, 2]}
          gl={{ antialias: !weak, alpha: true, powerPreference: 'default', failIfMajorPerformanceCaveat: false }}
          fallback={<div className="grid h-full place-items-center p-6 text-center text-sm text-slate-500">WebGL could not initialize.</div>}
        >
          <Scene nodes={nodes} time={time} onSelect={onSelect} reduced={reduced || weak} onWeakGpu={setWeak} />
          <OrbitControls enableZoom={false} enablePan={false} autoRotate={!reduced && !weak} autoRotateSpeed={0.35} makeDefault />
        </Canvas>
        </div>
        {lost ? (
          <div className="absolute inset-0 z-20 grid place-items-center bg-slate-950/80 text-center text-sm text-slate-400">
            <div>
              <p>The GPU context was lost.</p>
              <button type="button" className="mt-3 rounded-lg bg-cyan-400/10 px-3 py-1.5 text-xs text-cyan-200" onClick={() => { setLost(false); setCanvasKey((k) => k + 1); }}>Reload globe</button>
            </div>
          </div>
        ) : null}
      </CanvasErrorBoundary>
    </section>
  );
}
