import { useEffect, useRef } from "react";

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  opacity: number;
}

interface GeoShape {
  x: number;
  y: number;
  size: number;
  rotation: number;
  rotationSpeed: number;
  opacity: number;
  type: "triangle" | "hexagon" | "diamond";
  drift: number;
}

const PARTICLE_COUNT = 45;
const GEO_COUNT = 14;
const CONNECTION_DIST = 120;

const AnimatedBackground = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animRef = useRef<number>(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let w = window.innerWidth;
    let h = window.innerHeight;

    const setSize = () => {
      w = window.innerWidth;
      h = window.innerHeight;
      canvas.width = w;
      canvas.height = h;
    };
    setSize();
    window.addEventListener("resize", setSize);

    // Particles
    const particles: Particle[] = Array.from({ length: PARTICLE_COUNT }, () => ({
      x: Math.random() * w,
      y: Math.random() * h,
      vx: (Math.random() - 0.5) * 0.4,
      vy: (Math.random() - 0.5) * 0.4,
      size: Math.random() * 2 + 0.5,
      opacity: Math.random() * 0.5 + 0.1,
    }));

    // Geometric shapes
    const geos: GeoShape[] = Array.from({ length: GEO_COUNT }, () => ({
      x: Math.random() * w,
      y: Math.random() * h,
      size: Math.random() * 60 + 30,
      rotation: Math.random() * Math.PI * 2,
      rotationSpeed: (Math.random() - 0.5) * 0.003,
      opacity: Math.random() * 0.06 + 0.02,
      type: (["triangle", "hexagon", "diamond"] as const)[Math.floor(Math.random() * 3)],
      drift: Math.random() * 0.15 + 0.05,
    }));

    const goldR = 255, goldG = 200, goldB = 50;

    const drawTriangle = (cx: number, cy: number, size: number, rot: number) => {
      ctx.beginPath();
      for (let i = 0; i < 3; i++) {
        const angle = rot + (i * Math.PI * 2) / 3 - Math.PI / 2;
        const px = cx + Math.cos(angle) * size;
        const py = cy + Math.sin(angle) * size;
        i === 0 ? ctx.moveTo(px, py) : ctx.lineTo(px, py);
      }
      ctx.closePath();
    };

    const drawHexagon = (cx: number, cy: number, size: number, rot: number) => {
      ctx.beginPath();
      for (let i = 0; i < 6; i++) {
        const angle = rot + (i * Math.PI * 2) / 6;
        const px = cx + Math.cos(angle) * size;
        const py = cy + Math.sin(angle) * size;
        i === 0 ? ctx.moveTo(px, py) : ctx.lineTo(px, py);
      }
      ctx.closePath();
    };

    const drawDiamond = (cx: number, cy: number, size: number, rot: number) => {
      ctx.beginPath();
      for (let i = 0; i < 4; i++) {
        const angle = rot + (i * Math.PI * 2) / 4;
        const s = i % 2 === 0 ? size : size * 0.6;
        const px = cx + Math.cos(angle) * s;
        const py = cy + Math.sin(angle) * s;
        i === 0 ? ctx.moveTo(px, py) : ctx.lineTo(px, py);
      }
      ctx.closePath();
    };

    let time = 0;

    const animate = () => {
      time += 0.01;
      ctx.clearRect(0, 0, w, h);

      // Draw geometric shapes
      geos.forEach((g) => {
        g.rotation += g.rotationSpeed;
        g.y += Math.sin(time + g.x * 0.01) * g.drift;
        g.x += Math.cos(time + g.y * 0.01) * g.drift * 0.5;

        if (g.x < -100) g.x = w + 100;
        if (g.x > w + 100) g.x = -100;
        if (g.y < -100) g.y = h + 100;
        if (g.y > h + 100) g.y = -100;

        ctx.strokeStyle = `rgba(${goldR}, ${goldG}, ${goldB}, ${g.opacity})`;
        ctx.lineWidth = 1;

        if (g.type === "triangle") drawTriangle(g.x, g.y, g.size, g.rotation);
        else if (g.type === "hexagon") drawHexagon(g.x, g.y, g.size, g.rotation);
        else drawDiamond(g.x, g.y, g.size, g.rotation);

        ctx.stroke();
      });

      // Update & draw particles
      particles.forEach((p) => {
        p.x += p.vx;
        p.y += p.vy;

        if (p.x < 0) p.x = w;
        if (p.x > w) p.x = 0;
        if (p.y < 0) p.y = h;
        if (p.y > h) p.y = 0;

        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(${goldR}, ${goldG}, ${goldB}, ${p.opacity})`;
        ctx.fill();
      });

      // Draw connections
      for (let i = 0; i < particles.length; i++) {
        for (let j = i + 1; j < particles.length; j++) {
          const dx = particles[i].x - particles[j].x;
          const dy = particles[i].y - particles[j].y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < CONNECTION_DIST) {
            const alpha = (1 - dist / CONNECTION_DIST) * 0.12;
            ctx.beginPath();
            ctx.moveTo(particles[i].x, particles[i].y);
            ctx.lineTo(particles[j].x, particles[j].y);
            ctx.strokeStyle = `rgba(${goldR}, ${goldG}, ${goldB}, ${alpha})`;
            ctx.lineWidth = 0.5;
            ctx.stroke();
          }
        }
      }

      animRef.current = requestAnimationFrame(animate);
    };

    animRef.current = requestAnimationFrame(animate);

    return () => {
      cancelAnimationFrame(animRef.current);
      window.removeEventListener("resize", setSize);
    };
  }, []);

  return (
    <>
      <canvas
        ref={canvasRef}
        className="fixed inset-0 z-0 pointer-events-none"
        aria-hidden="true"
      />
      {/* Noise texture overlay */}
      <div
        className="fixed inset-0 z-0 pointer-events-none opacity-[0.03] mix-blend-overlay"
        aria-hidden="true"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")`,
          backgroundRepeat: "repeat",
          backgroundSize: "256px 256px",
        }}
      />
    </>
  );
};

export default AnimatedBackground;
