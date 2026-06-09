import { Link } from "react-router-dom";
import { Star, Trophy, ArrowRight, Users, Calendar, BadgeCheck, Wallet } from "lucide-react";
import { Button } from "@/components/ui/button";
import { track } from "@/lib/analytics";

// ─────────────────────────────────────────────────────────────
// EDITABLE STATS / COPY — adjust freely without touching JSX
// ─────────────────────────────────────────────────────────────
const CONTENT = {
  title: "1.200 traders ya eligieron la verdad.",
  subhead: "Traders reales, resultados reales. Sin filtros, sin promesas.",
  stats: [
    { icon: Users, value: "1.200+", label: "traders activos" },
    { icon: Calendar, value: "5×", label: "webinars por semana" },
    { icon: BadgeCheck, value: "4.8★", label: "valoración media" },
    { icon: Wallet, value: "$0", label: "mensualidad" },
  ],
  testimonials: [
    // ─── PLACEHOLDER TESTIMONIALS — REPLACE WITH REAL, CONSENTED TESTIMONIALS BEFORE LAUNCH ───
    {
      quote:
        "Antes pagaba tres suscripciones distintas. Ahora opero con la terminal de IX LTR y recuperé mi capital en la primera semana.",
      name: "Carlos M.",
      city: "Ciudad de México",
      initials: "CM",
    },
    {
      quote:
        "Los webinars en vivo me cambiaron la perspectiva. Ver cómo operan traders reales en tiempo real no se compara con ningún curso grabado.",
      name: "Valentina R.",
      city: "Bogotá, Colombia",
      initials: "VR",
    },
    {
      quote:
        "Empecé con los $100 del depósito mínimo. Hoy ya opero con confianza y mi cuenta sigue creciendo. La comunidad es lo mejor.",
      name: "Martín A.",
      city: "Buenos Aires, Argentina",
      initials: "MA",
    },
    // ─── END PLACEHOLDER TESTIMONIALS ───
  ],
  motogp: {
    badge: "EXCLUSIVO PARA MIEMBROS",
    // ─── EDITABLE SPONSORSHIP CLAIM — CONFIRM WITH INFINOX BEFORE PUBLISHING ───
    heading: "Los mejores traders de IX LTR van a MotoGP.",
    description:
      "Cada temporada, los traders con mejor rendimiento y consistencia obtienen un viaje VIP al Gran Premio de su región. Una experiencia única para quienes operan con disciplina.",
    ctaLabel: "Quiero calificar",
    ctaHref: "/register",
  },
};

const SocialProofSection = () => {
  return (
    <section
      id="social-proof"
      className="relative mx-auto w-full max-w-[1400px] bg-background py-14 sm:py-20 lg:py-24"
    >
      <div className="container px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mx-auto max-w-3xl text-center">
          <h2 className="font-heading text-3xl font-bold tracking-tight text-white sm:text-4xl lg:text-5xl">
            {CONTENT.title}
          </h2>
          <p className="mt-4 text-base leading-relaxed text-white/70 sm:text-lg">
            {CONTENT.subhead}
          </p>
        </div>

        {/* Stat tiles */}
        <div className="mt-10 grid grid-cols-2 gap-3 sm:grid-cols-4 sm:gap-4">
          {CONTENT.stats.map((stat) => (
            <div
              key={stat.label}
              className="flex flex-col items-center rounded-xl border border-white/10 bg-white/[0.03] px-3 py-5 text-center sm:px-4"
            >
              <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-[#FFCD05]/10 text-[#FFCD05]">
                <stat.icon className="h-4 w-4" />
              </span>
              <span className="mt-2 font-heading text-xl font-bold text-[#FFCD05] sm:text-2xl">
                {stat.value}
              </span>
              <span className="mt-1 text-[11px] font-medium uppercase tracking-wider text-white/50 sm:text-xs">
                {stat.label}
              </span>
            </div>
          ))}
        </div>

        {/* Testimonial cards */}
        <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {CONTENT.testimonials.map((t) => (
            <div
              key={t.name}
              className="flex flex-col rounded-2xl border border-white/10 bg-white/[0.03] p-5 sm:p-6"
            >
              {/* Stars */}
              <div className="flex gap-0.5">
                {Array.from({ length: 5 }).map((_, i) => (
                  <Star
                    key={i}
                    className="h-4 w-4 fill-[#FFCD05] text-[#FFCD05]"
                  />
                ))}
              </div>

              {/* Quote */}
              <p className="mt-3 flex-1 text-sm leading-relaxed text-white/85">
                “{t.quote}”
              </p>

              {/* Author */}
              <div className="mt-4 flex items-center gap-3 border-t border-white/10 pt-4">
                <span className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-[#FFCD05]/15 text-[11px] font-bold text-[#FFCD05]">
                  {t.initials}
                </span>
                <div>
                  <p className="text-sm font-semibold text-white">{t.name}</p>
                  <p className="text-xs text-white/40">{t.city}</p>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* MotoGP reward card */}
        <div className="mt-10">
          <div className="relative overflow-hidden rounded-2xl border border-[#FFCD05]/25 bg-gradient-to-br from-[#FFCD05]/[0.07] to-transparent p-6 sm:p-8 lg:p-10">
            {/* Decorative trophy */}
            <div className="pointer-events-none absolute -right-6 -top-6 opacity-[0.07]">
              <Trophy className="h-40 w-40 text-[#FFCD05]" />
            </div>

            <span className="inline-flex items-center gap-1.5 rounded-full border border-[#FFCD05]/40 bg-[#FFCD05]/10 px-3 py-1 text-[11px] font-bold uppercase tracking-wider text-[#FFCD05]">
              {CONTENT.motogp.badge}
            </span>

            <h3 className="mt-4 font-heading text-2xl font-bold text-white sm:text-3xl lg:text-4xl">
              {CONTENT.motogp.heading}
            </h3>
            <p className="mt-3 max-w-2xl text-sm leading-relaxed text-white/70 sm:text-base">
              {CONTENT.motogp.description}
            </p>

            <Button
              asChild
              className="mt-6 h-10 gap-2 rounded-full bg-[#FFCD05] px-6 text-sm font-bold text-black hover:bg-[#FFE066]"
            >
              <Link
                to={CONTENT.motogp.ctaHref}
                onClick={() =>
                  track("cta_click", {
                    section: "social_proof",
                    cta_name: "motogp_qualify",
                    label: CONTENT.motogp.ctaLabel,
                    href: CONTENT.motogp.ctaHref,
                  })
                }
              >
                {CONTENT.motogp.ctaLabel}
                <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
          </div>
        </div>
      </div>
    </section>
  );
};

export default SocialProofSection;
