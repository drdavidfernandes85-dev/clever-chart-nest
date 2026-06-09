import { Link } from "react-router-dom";
import { ArrowRight, Check, X, ShieldAlert } from "lucide-react";
import { Button } from "@/components/ui/button";

// ─────────────────────────────────────────────────────────────
// EDITABLE COPY / PRICES — adjust freely without touching JSX
// ─────────────────────────────────────────────────────────────
const CONTENT = {
  title: "Tu mensualidad ahora es tu capital.",
  subhead:
    "Olvídate de las mensualidades caras de plataformas de análisis. En IX LTR activas tu cuenta INFINOX con un depósito mínimo de $100 USD — ese dinero queda en tu cuenta de trading para operar, no es una cuota de entrada — y obtienes acceso completo a la plataforma.",
  leftCard: {
    label: "OTRAS PLATAFORMAS",
    items: [
      { name: "TradingView Pro", price: "$16/mes" },
      { name: "Sala de trading", price: "$49/mes" },
      { name: "Curso de trading", price: "$297" },
      { name: "Mentoría", price: "$99/mes" },
    ],
    totalLabel: "+/año",
    totalAmount: "$2.000",
  },
  rightCard: {
    label: "IX LTR",
    badge: "Mejor opción",
    items: [
      { name: "Terminal profesional", price: "Gratis" },
      { name: "Webinars diarios en vivo", price: "Gratis" },
      { name: "Comunidad de traders", price: "Gratis" },
      { name: "Educación estructurada", price: "Gratis" },
    ],
    footer: "$100 USD — tu capital, para operar",
  },
  stats: [
    { value: "$100", label: "depósito mínimo\n— tu capital —" },
    { value: "$0", label: "mensualidad" },
    { value: "100%", label: "acceso inmediato" },
  ],
  ctaLabel: "Activa tu cuenta — empieza ahora",
  ctaHref: "/register",
  disclaimer:
    "El trading de instrumentos financieros conlleva riesgo de pérdida de capital. Resultados pasados no garantizan resultados futuros. Opera solo con capital que puedas permitirte perder.",
};

const CapitalSection = () => {
  return (
    <section
      id="capital"
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

        {/* Comparison cards */}
        <div className="mt-12 grid gap-6 sm:gap-8 lg:grid-cols-2 lg:gap-10">
          {/* Left — Other platforms */}
          <div className="relative rounded-2xl border border-white/10 bg-white/[0.03] p-6 sm:p-8">
            <h3 className="text-sm font-bold uppercase tracking-wider text-white/50">
              {CONTENT.leftCard.label}
            </h3>
            <ul className="mt-5 space-y-3">
              {CONTENT.leftCard.items.map((item) => (
                <li
                  key={item.name}
                  className="flex items-center justify-between gap-4 text-sm sm:text-base"
                >
                  <span className="flex items-center gap-2 text-white/80">
                    <X className="h-4 w-4 shrink-0 text-red-400" />
                    {item.name}
                  </span>
                  <span className="shrink-0 font-semibold text-red-400">
                    {item.price}
                  </span>
                </li>
              ))}
            </ul>
            <div className="mt-6 border-t border-white/10 pt-4">
              <p className="text-right text-lg font-bold text-red-400">
                {CONTENT.leftCard.totalAmount}
                <span className="text-sm font-medium text-white/50">
                  {CONTENT.leftCard.totalLabel}
                </span>
              </p>
            </div>
          </div>

          {/* Right — IX LTR */}
          <div className="relative rounded-2xl border border-[#FFCD05]/30 bg-gradient-to-br from-[#FFCD05]/[0.06] to-[#FFCD05]/[0.02] p-6 sm:p-8">
            <div className="absolute -top-3 left-6 inline-flex items-center gap-1.5 rounded-full bg-[#FFCD05] px-3 py-1 text-xs font-bold text-black shadow-lg">
              {CONTENT.rightCard.badge}
            </div>
            <h3 className="text-sm font-bold uppercase tracking-wider text-[#FFCD05]/90">
              {CONTENT.rightCard.label}
            </h3>
            <ul className="mt-5 space-y-3">
              {CONTENT.rightCard.items.map((item) => (
                <li
                  key={item.name}
                  className="flex items-center justify-between gap-4 text-sm sm:text-base"
                >
                  <span className="flex items-center gap-2 text-white">
                    <Check className="h-4 w-4 shrink-0 text-[#FFCD05]" />
                    {item.name}
                  </span>
                  <span className="shrink-0 font-semibold text-[#FFCD05]">
                    {item.price}
                  </span>
                </li>
              ))}
            </ul>
            <div className="mt-6 border-t border-[#FFCD05]/20 pt-4">
              <p className="text-right text-lg font-bold text-[#FFCD05]">
                {CONTENT.rightCard.footer}
              </p>
            </div>
          </div>
        </div>

        {/* Stat tiles */}
        <div className="mt-10 grid gap-4 sm:grid-cols-3">
          {CONTENT.stats.map((stat) => (
            <div
              key={stat.label}
              className="flex flex-col items-center rounded-xl border border-white/10 bg-white/[0.03] px-4 py-5 text-center"
            >
              <span className="font-heading text-2xl font-bold text-[#FFCD05] sm:text-3xl">
                {stat.value}
              </span>
              <span className="mt-1 whitespace-pre-line text-xs font-medium uppercase tracking-wider text-white/50">
                {stat.label}
              </span>
            </div>
          ))}
        </div>

        {/* CTA + Disclaimer */}
        <div className="mt-10 flex flex-col items-center gap-4 text-center">
          <Button
            asChild
            size="lg"
            className="h-12 md:h-14 gap-2 rounded-full px-8 text-sm md:text-base font-bold bg-[#FFCD05] text-black hover:bg-[#FFE066] shadow-[0_0_0_1px_hsl(45_100%_50%/0.5),0_0_30px_hsl(45_100%_50%/0.45)] hover:shadow-[0_0_0_1px_hsl(45_100%_50%/0.9),0_0_45px_hsl(45_100%_50%/0.8)] transition-shadow"
          >
            <Link to={CONTENT.ctaHref}>
              {CONTENT.ctaLabel}
              <ArrowRight className="h-4 w-4" />
            </Link>
          </Button>

          <p className="flex max-w-xl items-start gap-2 text-[11px] leading-relaxed text-white/40 sm:text-xs">
            <ShieldAlert className="mt-0.5 h-3.5 w-3.5 shrink-0 text-white/30" />
            <span>{CONTENT.disclaimer}</span>
          </p>
        </div>
      </div>
    </section>
  );
};

export default CapitalSection;
