import { useEffect, useMemo, useRef, useState } from "react";

/**
 * Slow parallax dust + particles that drift around the hero.
 * Responds gently to mouse movement to reinforce scene depth.
 * Pure DOM/CSS — no canvas, no heavy lifting.
 */

const seedRand = (seed: number) => {
  let s = seed;
  return () => {
    s = (s * 9301 + 49297) % 233280;
    return s / 233280;
  };
};

type Particle = {
  top: number;
  left: number;
  size: number;
  depth: number; // 0 (far) → 1 (near)
  delay: number;
  dur: number;
  hue: number; // gold ↔ green tint
  glow: boolean;
};

const HeroParticles = () => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [parallax, setParallax] = useState({ x: 0, y: 0 });

  const particles = useMemo<Particle[]>(() => {
    const r = seedRand(1337);
    return Array.from({ length: 38 }, () => {
      const depth = r();
      return {
        top: r() * 100,
        left: r() * 100,
        size: 1 + depth * 4,
        depth,
        delay: r() * 6,
        dur: 8 + r() * 10,
        // Mostly gold (45–50), a few greens (130–150) to echo the screen palette
        hue: r() > 0.78 ? 130 + r() * 25 : 42 + r() * 10,
        glow: r() > 0.55,
      };
    });
  }, []);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    let raf = 0;
    let targetX = 0;
    let targetY = 0;
    let currentX = 0;
    let currentY = 0;

    const onMove = (e: MouseEvent) => {
      const rect = el.getBoundingClientRect();
      // Normalize to [-1, 1] relative to hero center
      targetX = ((e.clientX - rect.left) / rect.width - 0.5) * 2;
      targetY = ((e.clientY - rect.top) / rect.height - 0.5) * 2;
    };

    const tick = () => {
      // Easing for buttery smoothness
      currentX += (targetX - currentX) * 0.06;
      currentY += (targetY - currentY) * 0.06;
      setParallax({ x: currentX, y: currentY });
      raf = requestAnimationFrame(tick);
    };

    window.addEventListener("mousemove", onMove);
    raf = requestAnimationFrame(tick);

    return () => {
      window.removeEventListener("mousemove", onMove);
      cancelAnimationFrame(raf);
    };
  }, []);

  return (
    <div
      ref={containerRef}
      className="pointer-events-none absolute inset-0 z-0 overflow-hidden"
      aria-hidden="true"
    >
      {particles.map((p, i) => {
        // Deeper particles move less, near particles move more
        const tx = parallax.x * (8 + p.depth * 28);
        const ty = parallax.y * (8 + p.depth * 28);
        const color = `hsl(${p.hue} 90% ${55 + p.depth * 15}%)`;

        return (
          <span
            key={i}
            className="absolute rounded-full will-change-transform"
            style={{
              top: `${p.top}%`,
              left: `${p.left}%`,
              width: `${p.size}px`,
              height: `${p.size}px`,
              background: color,
              opacity: 0.18 + p.depth * 0.4,
              filter: p.depth < 0.35 ? "blur(1.5px)" : undefined,
              transform: `translate3d(${tx}px, ${ty}px, 0)`,
              transition: "transform 600ms cubic-bezier(0.22, 1, 0.36, 1)",
              animation: `dust-drift ${p.dur}s ${p.delay}s ease-in-out infinite alternate`,
            }}
          />
        );
      })}
    </div>
  );
};

export default HeroParticles;
