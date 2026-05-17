import { AlertTriangle, ShieldCheck, BookOpen, Ban } from "lucide-react";

const items = [
  {
    icon: AlertTriangle,
    title: "Riesgo de Inversión",
    body: "El trading de instrumentos apalancados (Forex, CFDs, índices, metales) conlleva un riesgo significativo de pérdida y puede no ser adecuado para todos los inversores. Podrías perder la totalidad de tu capital invertido.",
  },
  {
    icon: Ban,
    title: "Sin Asesoría Financiera",
    body: "Ningún contenido publicado en IX Sala de Trading constituye asesoría financiera, recomendación de inversión, oferta de compraventa ni promesa de rentabilidad. Las decisiones operativas son siempre tu responsabilidad.",
  },
  {
    icon: ShieldCheck,
    title: "Sin Señales de Trading",
    body: "No proveemos señales pagas, copy-trading administrado ni gestión discrecional de cuentas. Cualquier idea compartida por mentores o miembros tiene fines exclusivamente educativos.",
  },
  {
    icon: BookOpen,
    title: "Plataforma Educativa",
    body: "Somos una comunidad educativa enfocada en formación, análisis y herramientas para traders de INFINOX LATAM. El rendimiento pasado no garantiza resultados futuros.",
  },
];

const ComplianceBlock = () => (
  <section
    id="compliance"
    aria-labelledby="compliance-title"
    className="relative mx-auto w-full max-w-7xl px-4 py-16 scroll-mt-32 sm:px-6 lg:px-8"
  >
    <div className="rounded-3xl border border-primary/20 bg-card/40 p-6 backdrop-blur-2xl shadow-[0_30px_120px_-60px_hsl(45_100%_50%/0.35)] md:p-10">
      <div className="mx-auto max-w-3xl text-center">
        <span className="inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.18em] text-primary">
          Cumplimiento &amp; Transparencia
        </span>
        <h2
          id="compliance-title"
          className="mt-4 font-heading text-3xl md:text-4xl font-bold text-foreground"
        >
          Aviso Legal y de Riesgo
        </h2>
        <p className="mt-3 text-sm md:text-base text-muted-foreground">
          Operar con responsabilidad empieza con información clara. Lee
          atentamente antes de utilizar la plataforma.
        </p>
      </div>

      <ul
        role="list"
        className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4"
      >
        {items.map(({ icon: Icon, title, body }) => (
          <li
            key={title}
            className="rounded-2xl border border-white/10 bg-background/40 p-5 transition-colors hover:border-primary/40"
          >
            <div
              aria-hidden="true"
              className="flex h-10 w-10 items-center justify-center rounded-xl border border-primary/30 bg-primary/10 text-primary"
            >
              <Icon className="h-5 w-5" />
            </div>
            <h3 className="mt-4 font-heading text-sm font-bold text-foreground">
              {title}
            </h3>
            <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
              {body}
            </p>
          </li>
        ))}
      </ul>

      <p className="mx-auto mt-8 max-w-4xl text-center text-[11px] leading-relaxed text-muted-foreground/80">
        IX Sala de Trading es una comunidad educativa independiente desarrollada
        para la comunidad INFINOX LATAM. INFINOX es un bróker regulado; consulta
        sus términos, condiciones y advertencias de riesgo en su sitio oficial.
        Al usar esta plataforma aceptas que toda la información se proporciona
        &laquo;tal cual&raquo;, sin garantías, y que el trading conlleva riesgo
        de pérdida total del capital.
      </p>
    </div>
  </section>
);

export default ComplianceBlock;
