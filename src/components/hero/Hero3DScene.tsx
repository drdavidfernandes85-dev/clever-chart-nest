import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Float, Html, OrbitControls } from "@react-three/drei";
import * as THREE from "three";
import heroLaptop from "@/assets/hero-laptop.png";
import { useTheme } from "@/contexts/ThemeContext";

/**
 * Premium 3D hero scene built with React Three Fiber.
 * - Animated candlestick "terrain" that pulses like real market data
 * - Floating glass dashboard card mockup (HTML inside 3D space)
 * - Gold particle field
 * - Parallax mouse-reactive camera
 * - Graceful 2D fallback for environments without WebGL/GPU (sandbox iframe)
 */

const GOLD = "#facc15";
const GOLD_SOFT = "#fde68a";

// ── Candlestick terrain ────────────────────────────────────────────────────
function CandlestickField() {
  const groupRef = useRef<THREE.Group>(null);
  const cols = 14;
  const rows = 8;

  const candles = useMemo(() => {
    const arr: { x: number; z: number; baseHeight: number; phase: number; bullish: boolean }[] = [];
    for (let i = 0; i < cols; i++) {
      for (let j = 0; j < rows; j++) {
        const x = (i - cols / 2) * 0.55;
        const z = (j - rows / 2) * 0.55;
        const distance = Math.sqrt(x * x + z * z);
        const baseHeight = Math.max(0.15, 1.4 - distance * 0.12 + Math.random() * 0.6);
        const phase = Math.random() * Math.PI * 2;
        const bullish = Math.random() > 0.4;
        arr.push({ x, z, baseHeight, phase, bullish });
      }
    }
    return arr;
  }, []);

  useFrame((state) => {
    if (!groupRef.current) return;
    const t = state.clock.elapsedTime;
    groupRef.current.children.forEach((child, i) => {
      const candle = candles[i];
      if (!candle) return;
      const wave = Math.sin(t * 1.2 + candle.phase) * 0.35 + Math.cos(t * 0.6 + candle.x) * 0.15;
      const targetH = Math.max(0.1, candle.baseHeight + wave);
      child.scale.y = THREE.MathUtils.lerp(child.scale.y, targetH, 0.08);
      child.position.y = child.scale.y / 2;
    });
    // Gentle rotation
    groupRef.current.rotation.y = Math.sin(t * 0.1) * 0.08;
  });

  return (
    <group ref={groupRef} position={[0, -1.2, 0]}>
      {candles.map((c, i) => (
        <mesh key={i} position={[c.x, 0, c.z]}>
          <boxGeometry args={[0.28, 1, 0.28]} />
          <meshStandardMaterial
            color={c.bullish ? GOLD : "#3a3a3a"}
            emissive={c.bullish ? GOLD : "#1a1a1a"}
            emissiveIntensity={c.bullish ? 0.8 : 0.15}
            metalness={0.7}
            roughness={0.25}
          />
        </mesh>
      ))}
    </group>
  );
}

// ── Floating particles ────────────────────────────────────────────────────
function GoldParticles() {
  const ref = useRef<THREE.Points>(null);
  const count = 220;

  const positions = useMemo(() => {
    const arr = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      arr[i * 3] = (Math.random() - 0.5) * 16;
      arr[i * 3 + 1] = Math.random() * 8 - 1;
      arr[i * 3 + 2] = (Math.random() - 0.5) * 16;
    }
    return arr;
  }, []);

  useFrame((state) => {
    if (!ref.current) return;
    ref.current.rotation.y = state.clock.elapsedTime * 0.04;
    const arr = ref.current.geometry.attributes.position.array as Float32Array;
    for (let i = 0; i < count; i++) {
      arr[i * 3 + 1] += 0.004;
      if (arr[i * 3 + 1] > 7) arr[i * 3 + 1] = -1;
    }
    ref.current.geometry.attributes.position.needsUpdate = true;
  });

  return (
    <points ref={ref}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} count={count} />
      </bufferGeometry>
      <pointsMaterial
        color={GOLD_SOFT}
        size={0.05}
        transparent
        opacity={0.7}
        sizeAttenuation
        depthWrite={false}
      />
    </points>
  );
}

// ── Glass dashboard card floating in 3D ───────────────────────────────────
function FloatingDashboard() {
  return (
    <Float speed={1.4} rotationIntensity={0.25} floatIntensity={0.6}>
      <group position={[0, 1.6, 0]} rotation={[-0.05, 0, 0]}>
        {/* Glass back panel */}
        <mesh>
          <planeGeometry args={[5.4, 3.2]} />
          <meshPhysicalMaterial
            color="#0a0a0a"
            transmission={0.4}
            thickness={0.5}
            roughness={0.1}
            metalness={0.2}
            clearcoat={1}
            clearcoatRoughness={0.05}
            transparent
            opacity={0.55}
          />
        </mesh>
        {/* Gold edge */}
        <mesh position={[0, 0, 0.01]}>
          <ringGeometry args={[2.6, 2.62, 4]} />
          <meshBasicMaterial color={GOLD} />
        </mesh>
        {/* HTML overlay = the dashboard UI */}
        <Html
          transform
          distanceFactor={4.2}
          position={[0, 0, 0.05]}
          style={{ pointerEvents: "none" }}
        >
          <div className="w-[520px] rounded-xl border border-yellow-400/40 bg-black/70 p-5 backdrop-blur-xl shadow-[0_20px_60px_-10px_rgba(250,204,21,0.4)]">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <div className="h-2 w-2 rounded-full bg-yellow-400 animate-pulse" />
                <span className="text-yellow-400 font-mono text-xs tracking-wider">LIVE • EUR/USD</span>
              </div>
              <span className="text-emerald-400 font-mono text-sm">+1.247%</span>
            </div>
            {/* Mini chart */}
            <svg viewBox="0 0 500 140" className="w-full h-[110px]">
              <defs>
                <linearGradient id="chartGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#facc15" stopOpacity="0.6" />
                  <stop offset="100%" stopColor="#facc15" stopOpacity="0" />
                </linearGradient>
              </defs>
              <path
                d="M0,100 L40,90 L80,95 L120,70 L160,80 L200,55 L240,65 L280,40 L320,50 L360,30 L400,35 L440,20 L480,25 L500,15"
                stroke="#facc15"
                strokeWidth="2.5"
                fill="none"
              />
              <path
                d="M0,100 L40,90 L80,95 L120,70 L160,80 L200,55 L240,65 L280,40 L320,50 L360,30 L400,35 L440,20 L480,25 L500,15 L500,140 L0,140 Z"
                fill="url(#chartGrad)"
              />
            </svg>
            <div className="grid grid-cols-3 gap-3 mt-4">
              <div className="rounded-lg bg-yellow-400/10 border border-yellow-400/30 p-2">
                <div className="text-[10px] text-yellow-400/70 uppercase">Entry</div>
                <div className="text-white font-mono text-sm">1.0842</div>
              </div>
              <div className="rounded-lg bg-emerald-500/10 border border-emerald-500/30 p-2">
                <div className="text-[10px] text-emerald-400/70 uppercase">Target</div>
                <div className="text-white font-mono text-sm">1.0915</div>
              </div>
              <div className="rounded-lg bg-red-500/10 border border-red-500/30 p-2">
                <div className="text-[10px] text-red-400/70 uppercase">Stop</div>
                <div className="text-white font-mono text-sm">1.0810</div>
              </div>
            </div>
          </div>
        </Html>
      </group>
    </Float>
  );
}

// ── Parallax camera ───────────────────────────────────────────────────────
function ParallaxCamera() {
  const { camera, mouse } = useThree();
  const target = useRef(new THREE.Vector3(0, 1.2, 0));

  useFrame(() => {
    const targetX = mouse.x * 1.4;
    const targetY = 2.2 + mouse.y * 0.6;
    camera.position.x = THREE.MathUtils.lerp(camera.position.x, targetX, 0.05);
    camera.position.y = THREE.MathUtils.lerp(camera.position.y, targetY, 0.05);
    camera.position.z = 7;
    camera.lookAt(target.current);
  });
  return null;
}

// ── WebGL detection ───────────────────────────────────────────────────────
function useWebGLSupported() {
  const [ok, setOk] = useState(true);
  useEffect(() => {
    try {
      const canvas = document.createElement("canvas");
      const gl =
        canvas.getContext("webgl2") ||
        canvas.getContext("webgl") ||
        canvas.getContext("experimental-webgl");
      setOk(!!gl);
    } catch {
      setOk(false);
    }
  }, []);
  return ok;
}

// ── Main export ───────────────────────────────────────────────────────────
const Hero3DScene = () => {
  const webgl = useWebGLSupported();
  const { theme } = useTheme();
  const isDark = theme === "dark";

  if (!webgl) {
    return (
      <div className="relative animate-float">
        <div className="absolute -inset-8 rounded-3xl bg-[radial-gradient(ellipse,hsl(48_100%_51%/0.15),transparent_70%)]" />
        <img src={heroLaptop} alt="Trading dashboard" className="relative w-full max-w-xl drop-shadow-2xl" />
      </div>
    );
  }

  return (
    <div className="relative h-[560px] w-full lg:h-[640px]">
      {/* Glow backdrop */}
      <div className="pointer-events-none absolute -inset-10 rounded-[3rem] bg-[radial-gradient(ellipse,hsl(48_100%_51%/0.2),transparent_65%)]" />

      <Canvas
        dpr={[1, 2]}
        camera={{ position: [0, 2.2, 7], fov: 45 }}
        gl={{ antialias: true, alpha: true, powerPreference: "high-performance" }}
        style={{ background: "transparent" }}
      >
        <Suspense fallback={null}>
          <ambientLight intensity={isDark ? 0.4 : 0.7} />
          <directionalLight position={[5, 8, 5]} intensity={1.2} color={GOLD_SOFT} />
          <pointLight position={[-4, 3, -4]} intensity={0.8} color={GOLD} />
          <pointLight position={[4, 1, 4]} intensity={0.5} color="#ffffff" />

          <fog attach="fog" args={[isDark ? "#0a0a0a" : "#ffffff", 8, 20]} />

          <CandlestickField />
          <GoldParticles />
          <FloatingDashboard />

          {/* Reflective floor */}
          <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -1.21, 0]} receiveShadow>
            <planeGeometry args={[40, 40]} />
            <meshStandardMaterial
              color={isDark ? "#0a0a0a" : "#f5f5f5"}
              metalness={0.9}
              roughness={0.4}
              transparent
              opacity={0.6}
            />
          </mesh>

          <ParallaxCamera />
        </Suspense>
      </Canvas>
    </div>
  );
};

export default Hero3DScene;
