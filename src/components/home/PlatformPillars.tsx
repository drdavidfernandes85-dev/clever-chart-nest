import { Link } from "react-router-dom";
import {
  ArrowRight,
  LayoutDashboard,
  MessagesSquare,
  PlayCircle,
  GraduationCap,
  LineChart,
  Activity,
  Users,
  ShieldCheck,
  BookOpen,
  BarChart3,
  Globe,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { track } from "@/lib/analytics";

const cardBase =
  "group relative overflow-hidden rounded-3xl border border-primary/15 bg-card/40 backdrop-blur-2xl shadow-[0_30px_120px_-60px_hsl(45_100%_50%/0.35)] transition-all hover:border-primary/40 hover:shadow-[0_30px_120px_-40px_hsl(45_100%_50%/0.55)]";

const SectionHeader = ({
  eyebrow,
  title,
  subtitle,
}: {
  eyebrow: string;
  title: string;
  subtitle: string;
}) => (
  <div className="mx-auto mb-10 max-w-3xl text-center">
    <span className="inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.18em] text-primary">
      {eyebrow}
    </span>
    <h2 className="mt-4 font-heading text-3xl md:text-4xl font-bold text-foreground">
      {title}
    </h2>
    <p className="mt-3 text-sm md:text-base text-muted-foreground">{subtitle}</p>
  </div>
);

const Pill = ({ children }: { children: React.ReactNode }) => (
  <span className="inline-flex items-center gap-1.5 rounded-full border border-primary/25 bg-primary/5 px-2.5 py-1 text-[11px] font-medium text-primary/90">
    {children}
  </span>
);

const TerminalMock = () => (
  <div className="relative rounded-2xl border border-primary/20 bg-[hsl(220_20%_6%)] p-4 shadow-2xl">
    <div className="flex items-center gap-1.5 pb-3">
      <span className="h-2.5 w-2.5 rounded-full bg-red-500/80" />
      <span className="h-2.5 w-2.5 rounded-full bg-yellow-500/80" />
      <span className="h-2.5 w-2.5 rounded-full bg-green-500/80" />
      <span className="ml-3 text-[10px] font-mono text-white/40">
        ix-terminal · EURUSD · M15
      </span>
    </div>
    <div className="grid grid-cols-[1fr_180px] gap-3">
      <div className="relative h-48 overflow-hidden rounded-lg border border-white/5 bg-gradient-to-b from-[hsl(220_30%_8%)] to-black">
        <svg viewBox="0 0 400 180" className="absolute inset-0 h-full w-full">
          <defs>
            <linearGradient id="ag" x1="0" x2="0" y1="0" y2="1">
              <stop offset="0%" stopColor="#FFCD05" stopOpacity="0.35" />
              <stop offset="100%" stopColor="#FFCD05" stopOpacity="0" />
            </linearGradient>
          </defs>
          {[30, 60, 90, 120, 150].map((y) => (
            <line key={y} x1="0" x2="400" y1={y} y2={y} stroke="white" strokeOpacity="0.04" />
          ))}
          <path
            d="M0 120 L40 110 L80 95 L120 105 L160 80 L200 70 L240 85 L280 55 L320 65 L360 40 L400 50 L400 180 L0 180 Z"
            fill="url(#ag)"
          />
          <path
            d="M0 120 L40 110 L80 95 L120 105 L160 80 L200 70 L240 85 L280 55 L320 65 L360 40 L400 50"
            stroke="#FFCD05"
            strokeWidth="2"
            fill="none"
          />
          {[
            [40, 110, 6],
            [80, 95, 8],
            [120, 105, 5],
            [200, 70, 9],
            [280, 55, 7],
            [360, 40, 6],
          ].map(([x, y, h], i) => (
            <rect
              key={i}
              x={(x as number) - 3}
              y={(y as number) - (h as number) / 2}
              width="6"
              height={h as number}
              fill={i % 2 ? "#22c55e" : "#ef4444"}
              opacity="0.75"
            />
          ))}
        </svg>
      </div>
      <div className="flex flex-col gap-2">
        <div className="rounded-md border border-primary/30 bg-primary/10 p-2">
          <div className="text-[10px] uppercase text-primary/80">Order Entry</div>
          <div className="mt-1 grid grid-cols-2 gap-1">
            <div className="rounded bg-green-600/30 px-2 py-1 text-center text-[10px] font-bold text-green-300">
              BUY
            </div>
            <div className="rounded bg-red-600/30 px-2 py-1 text-center text-[10px] font-bold text-red-300">
              SELL
            </div>
          </div>
          <div className="mt-2 space-y-1 font-mono text-[10px] text-white/70">
            <div className="flex justify-between">
              <span>Volume</span><span>0.10</span>
            </div>
            <div className="flex justify-between">
              <span>SL</span><span>1.0820</span>
            </div>
            <div className="flex justify-between">
              <span>TP</span><span>1.0905</span>
            </div>
          </div>
        </div>
        <div className="rounded-md border border-white/10 bg-white/5 p-2">
          <div className="text-[10px] uppercase text-white/50">Equity</div>
          <div className="font-mono text-sm font-bold text-primary">$24,815</div>
          <div className="text-[10px] text-green-400">+1.42% hoy</div>
        </div>
      </div>
    </div>
  </div>
);

const ChatMock = () => (
  <div className="rounded-2xl border border-primary/20 bg-[hsl(220_20%_6%)] p-4 shadow-2xl">
    <div className="flex items-center justify-between border-b border-white/5 pb-2">
      <div className="flex items-center gap-2 text-xs font-semibold text-white">
        <MessagesSquare className="h-4 w-4 text-primary" /> #general
      </div>
      <span className="flex items-center gap-1 text-[10px] text-green-400">
        <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-green-400" /> 342 online
      </span>
    </div>
    <div className="mt-3 space-y-3 text-xs">
      {[
        { u: "Carlos M.", t: "Buen día equipo, ¿análisis del DXY hoy?", c: "bg-blue-500/20 text-blue-300" },
        { u: "Ana R.", t: "Esperando confirmación en EURUSD H1, OB claro.", c: "bg-purple-500/20 text-purple-300" },
        { u: "Mentor · Diego", t: "Webinar de gestión de riesgo en 30 min — no se lo pierdan.", c: "bg-primary/20 text-primary" },
      ].map((m, i) => (
        <div key={i} className="flex gap-2">
          <div className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[10px] font-bold ${m.c}`}>
            {m.u[0]}
          </div>
          <div>
            <div className="text-[10px] font-semibold text-white/80">{m.u}</div>
            <div className="text-white/70">{m.t}</div>
          </div>
        </div>
      ))}
    </div>
    <div className="mt-3 rounded-lg border border-primary/30 bg-primary/5 p-2">
      <div className="flex items-center justify-between text-[10px] uppercase text-primary/80">
        <span className="flex items-center gap-1"><LineChart className="h-3 w-3" /> Idea de mercado</span>
        <span className="rounded bg-white/10 px-1.5 text-white/80">Educativa</span>
      </div>
      <div className="mt-1 flex items-center justify-between font-mono text-[11px] text-white/80">
        <span>XAUUSD</span>
        <span>Análisis compartido</span>
      </div>
    </div>

  </div>
);

const WebinarMock = () => (
  <div className="rounded-2xl border border-primary/20 bg-[hsl(220_20%_6%)] p-4 shadow-2xl">
    <div className="relative aspect-video overflow-hidden rounded-lg border border-white/5 bg-gradient-to-br from-[hsl(45_100%_15%)] via-[hsl(28_60%_10%)] to-black">
      <div className="absolute left-3 top-3 flex items-center gap-1.5 rounded-full bg-red-600/90 px-2 py-0.5 text-[10px] font-bold text-white">
        <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-white" /> EN VIVO
      </div>
      <div className="absolute right-3 top-3 rounded-md bg-black/60 px-2 py-0.5 text-[10px] font-mono text-white/80">
        1,248 viewers
      </div>
      <div className="absolute inset-0 flex items-center justify-center">
        <div className="flex h-14 w-14 items-center justify-center rounded-full bg-primary/90 text-black shadow-[0_0_40px_hsl(45_100%_50%/0.6)]">
          <PlayCircle className="h-7 w-7" />
        </div>
      </div>
      <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/90 to-transparent p-3">
        <div className="text-xs font-bold text-white">Gestión de Riesgo Profesional</div>
        <div className="text-[10px] text-white/60">con Diego Hernández · Mentor IX</div>
      </div>
    </div>
    <div className="mt-3 grid grid-cols-3 gap-2 text-[10px]">
      {["Lunes 14:00", "Miércoles 18:00", "Viernes 20:00"].map((d) => (
        <div key={d} className="rounded border border-white/10 bg-white/5 p-2 text-center">
          <div className="font-semibold text-white/80">{d.split(" ")[0]}</div>
          <div className="font-mono text-primary">{d.split(" ")[1]}</div>
        </div>
      ))}
    </div>
  </div>
);

const EducationMock = () => {
  const modules = [
    { i: BarChart3, t: "Análisis Técnico", n: "12 módulos" },
    { i: Globe, t: "Macro & Fundamentales", n: "8 módulos" },
    { i: ShieldCheck, t: "Gestión de Riesgo", n: "10 módulos" },
    { i: BookOpen, t: "Psicología Trading", n: "6 módulos" },
  ];
  return (
    <div className="rounded-2xl border border-primary/20 bg-[hsl(220_20%_6%)] p-4 shadow-2xl">
      <div className="grid grid-cols-2 gap-3">
        {modules.map(({ i: Icon, t: title, n }) => (
          <div
            key={title}
            className="group/m rounded-xl border border-white/5 bg-white/[0.03] p-3 transition-all hover:border-primary/40 hover:bg-primary/5"
          >
            <div className="flex h-9 w-9 items-center justify-center rounded-lg border border-primary/30 bg-primary/10 text-primary">
              <Icon className="h-4 w-4" />
            </div>
            <div className="mt-2 text-xs font-semibold text-white">{title}</div>
            <div className="text-[10px] text-white/50">{n}</div>
          </div>
        ))}
      </div>
      <div className="mt-3 rounded-lg border border-primary/20 bg-primary/5 p-2 text-center text-[11px] text-primary">
        Contenido 100% educativo · Sin promesas de rentabilidad
      </div>
    </div>
  );
};

const PlatformPillars = () => {
  const pillars = [
    {
      eyebrow: "LTR Terminal Pro",
      title: "Terminal profesional para traders",
      subtitle:
        "Visualiza tu cuenta MT5, revisa precios, gestiona posiciones, consulta tu historial de ejecución y utiliza herramientas de riesgo en una interfaz profesional.",
      cta: { label: "Abrir LTR Terminal Pro", to: "/dashboard", icon: LayoutDashboard },
      pills: [
        <Pill key="1"><Activity className="h-3 w-3" /> Conectividad MT5</Pill>,
        <Pill key="2"><LineChart className="h-3 w-3" /> Market Watch · Bid/Ask</Pill>,
        <Pill key="3"><ShieldCheck className="h-3 w-3" /> Gestión de riesgo</Pill>,
      ],
      mock: <TerminalMock />,
      reverse: false,
    },
    {
      eyebrow: "Comunidad de Traders",
      title: "Aprende y discute mercados",
      subtitle:
        "Participa en conversaciones educativas, comparte análisis, revisa ideas de mercado y aprende junto a una comunidad activa. El objetivo es educación y discusión, no recomendaciones.",
      cta: { label: "Entrar al Chat", to: "/chatroom", icon: MessagesSquare },
      pills: [
        <Pill key="1"><Users className="h-3 w-3" /> 1,200+ traders</Pill>,
        <Pill key="2"><MessagesSquare className="h-3 w-3" /> 9 canales temáticos</Pill>,
        <Pill key="3"><LineChart className="h-3 w-3" /> Ideas de mercado</Pill>,
      ],
      mock: <ChatMock />,
      reverse: true,
    },
    {
      eyebrow: "Webinars de Trading",
      title: "Sesiones educativas en vivo",
      subtitle:
        "Accede a webinars, sesiones grabadas e invitados especiales sobre análisis técnico, macro, psicología del trading y gestión de riesgo.",
      cta: { label: "Ver Webinars Gratuitos", to: "/webinars", icon: PlayCircle },
      pills: [
        <Pill key="1"><PlayCircle className="h-3 w-3" /> En vivo & grabados</Pill>,
        <Pill key="2"><Users className="h-3 w-3" /> Educadores y colaboradores</Pill>,
        <Pill key="3"><BookOpen className="h-3 w-3" /> 100% gratuitos</Pill>,
      ],
      mock: <WebinarMock />,
      reverse: false,
    },
    {
      eyebrow: "Centro de Educación",
      title: "Formación estructurada para traders",
      subtitle:
        "Accede a módulos sobre análisis técnico, macroeconomía, gestión de riesgo, psicología del trading y uso responsable de herramientas de mercado.",
      cta: { label: "Explorar Módulos", to: "/education", icon: GraduationCap },
      pills: [
        <Pill key="1"><BarChart3 className="h-3 w-3" /> Técnico</Pill>,
        <Pill key="2"><Globe className="h-3 w-3" /> Macro</Pill>,
        <Pill key="3"><ShieldCheck className="h-3 w-3" /> Riesgo</Pill>,
        <Pill key="4"><BookOpen className="h-3 w-3" /> Psicología</Pill>,
      ],
      mock: <EducationMock />,
      reverse: true,
    },
  ];

  return (
    <section
      id="pilares"
      aria-labelledby="platform-pillars-title"
      className="relative mx-auto w-full max-w-7xl px-4 py-20 scroll-mt-32 sm:px-6 lg:px-8"
    >
      <SectionHeader
        eyebrow="La Plataforma IX LTR"
        title="Educación, comunidad y herramientas para traders"
        subtitle="Cuatro pilares — LTR Terminal Pro, Comunidad, Webinars y Educación — unidos en una experiencia premium para la comunidad de traders."
      />
      <h2 id="platform-pillars-title" className="sr-only">
        Pilares de la plataforma IX LTR
      </h2>


      <div className="space-y-10">
        {pillars.map((p, i) => (
          <article
            key={p.eyebrow}
            className={`${cardBase} p-6 md:p-10`}
          >
            <div
              className={`grid items-center gap-8 md:gap-12 lg:grid-cols-2 ${
                p.reverse ? "lg:[&>*:first-child]:order-2" : ""
              }`}
            >
              <div>
                <span className="inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.18em] text-primary">
                  0{i + 1} · {p.eyebrow}
                </span>
                <h3 className="mt-4 font-heading text-2xl md:text-3xl font-bold text-foreground">
                  {p.title}
                </h3>
                <p className="mt-3 text-sm md:text-base text-muted-foreground">
                  {p.subtitle}
                </p>
                <div className="mt-5 flex flex-wrap gap-2">{p.pills}</div>
                <div className="mt-6">
                  <Button
                    asChild
                    className="h-11 gap-2 rounded-full bg-[#FFCD05] px-6 font-bold text-black hover:bg-[#FFE066] shadow-[0_0_30px_hsl(45_100%_50%/0.35)]"
                  >
                    <Link
                      to={p.cta.to}
                      onClick={() =>
                        track("cta_click", {
                          cta: p.cta.label,
                          section: `pillar_${p.eyebrow.toLowerCase().replace(/\s+/g, "_")}`,
                          destination: p.cta.to,
                        })
                      }
                    >
                      <p.cta.icon className="h-4 w-4" /> {p.cta.label}{" "}
                      <ArrowRight className="h-4 w-4" />
                    </Link>
                  </Button>
                </div>
              </div>
              <div className="relative">
                <div className="pointer-events-none absolute -inset-8 -z-10 rounded-[36px] bg-[radial-gradient(circle_at_center,hsl(45_100%_50%/0.18),transparent_70%)] blur-2xl" />
                {p.mock}
              </div>
            </div>
          </article>
        ))}
      </div>

      <p className="mt-10 text-center text-xs text-muted-foreground/80">
        Contenido educativo. Sin asesoría financiera. Sin promesas de rentabilidad. Operar productos apalancados conlleva riesgo significativo.
      </p>

    </section>
  );
};

export default PlatformPillars;
