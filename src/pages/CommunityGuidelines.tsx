import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, ShieldCheck, BookOpen, Ban, AlertTriangle, Flag } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useLanguage } from "@/i18n/LanguageContext";
import SEO from "@/components/SEO";
import infinoxLogo from "@/assets/infinox-logo-white.png";

type GuidelinesLocale = "en" | "es" | "pt";

interface GuidelinesContent {
  label: string;
  title: string;
  intro: string;
  intro2: string;
  disclaimer: string;
  coreTitle: string;
  core: string[];
  prohibitedTitle: string;
  prohibited: string[];
  consequencesTitle: string;
  consequences: string;
  reportingTitle: string;
  reporting: string[];
  agreement: string;
}

const CONTENT: Record<GuidelinesLocale, GuidelinesContent> = {
  en: {
    label: "English",
    title: "Community Guidelines – IX LTR",
    intro: "Welcome to the IX LTR.",
    intro2:
      "Our goal is to build a respectful, professional, and educational space where traders can connect, share ideas, discuss market setups, and learn together.",
    disclaimer:
      "All content is for educational purposes only. Trading involves significant risk of loss. We do not provide financial advice, trading signals, or investment recommendations.",
    coreTitle: "Core Rules",
    core: [
      "Be respectful and professional at all times",
      "Focus on education, analysis, and learning",
      "Share ideas and chart breakdowns constructively",
      "Ask genuine questions and help others learn",
      "Keep discussions related to trading and markets",
    ],
    prohibitedTitle: "Strictly Prohibited",
    prohibited: [
      "Sharing trading signals, “buy/sell” recommendations, or copy-trading instructions",
      "Giving direct financial advice or guaranteeing profits",
      "Harassment, insults, discrimination, or toxic behavior",
      "Spam, advertising, or self-promotion",
      "Posting external links for personal gain",
      "Discussing politics, religion, or off-topic subjects",
      "Impersonating mentors, staff, or other members",
      "Sharing personal account information or login details",
    ],
    consequencesTitle: "Consequences",
    consequences:
      "Violations may result in warning, temporary mute, message removal, or ban.",
    reportingTitle: "Reporting Issues",
    reporting: [
      "Use the “Report” button",
      "Mention @Mod in #General",
      "Email: promociones@ixsalatrading.com",
    ],
    agreement: "By participating you agree to these guidelines.",
  },
  es: {
    label: "Español",
    title: "Normas de la Comunidad – IX LTR",
    intro: "Bienvenido al IX LTR.",
    intro2:
      "Nuestro objetivo es construir un espacio respetuoso, profesional y educativo donde los traders puedan conectarse, compartir ideas, discutir configuraciones de mercado y aprender juntos.",
    disclaimer:
      "Todo el contenido es solo con fines educativos. El trading implica un riesgo significativo de pérdida. No ofrecemos asesoramiento financiero, señales de trading ni recomendaciones de inversión.",
    coreTitle: "Reglas Principales",
    core: [
      "Sé respetuoso y profesional en todo momento",
      "Enfócate en la educación, el análisis y el aprendizaje",
      "Comparte ideas y análisis de gráficos de forma constructiva",
      "Haz preguntas genuinas y ayuda a otros a aprender",
      "Mantén las discusiones relacionadas con el trading y los mercados",
    ],
    prohibitedTitle: "Estrictamente Prohibido",
    prohibited: [
      "Compartir señales de trading, recomendaciones de “compra/venta” o instrucciones de copy-trading",
      "Dar asesoramiento financiero directo o garantizar ganancias",
      "Acoso, insultos, discriminación o comportamiento tóxico",
      "Spam, publicidad o autopromoción",
      "Publicar enlaces externos para beneficio personal",
      "Discutir política, religión o temas fuera del tema",
      "Hacerse pasar por mentores, staff u otros miembros",
      "Compartir información personal de cuenta o datos de acceso",
    ],
    consequencesTitle: "Consecuencias",
    consequences:
      "Las infracciones pueden resultar en advertencia, silenciamiento temporal, eliminación del mensaje o expulsión.",
    reportingTitle: "Reportar Problemas",
    reporting: [
      "Usa el botón “Reportar”",
      "Menciona @Mod en #General",
      "Correo: promociones@ixsalatrading.com",
    ],
    agreement: "Al participar aceptas estas normas.",
  },
  pt: {
    label: "Português (Brasil)",
    title: "Regras da Comunidade – IX LTR",
    intro: "Bem-vindo ao IX LTR.",
    intro2:
      "Nosso objetivo é construir um espaço respeitoso, profissional e educativo onde os traders possam se conectar, compartilhar ideias, discutir configurações de mercado e aprender juntos.",
    disclaimer:
      "Todo o conteúdo é apenas para fins educacionais. O trading envolve risco significativo de perda. Não fornecemos aconselhamento financeiro, sinais de trading ou recomendações de investimento.",
    coreTitle: "Regras Principais",
    core: [
      "Seja respeitoso e profissional em todos os momentos",
      "Foque em educação, análise e aprendizado",
      "Compartilhe ideias e análises de gráficos de forma construtiva",
      "Faça perguntas genuínas e ajude outros a aprender",
      "Mantenha as discussões relacionadas a trading e mercados",
    ],
    prohibitedTitle: "Estritamente Proibido",
    prohibited: [
      "Compartilhar sinais de trading, recomendações de “compra/venda” ou instruções de copy-trading",
      "Dar aconselhamento financeiro direto ou garantir lucros",
      "Assédio, insultos, discriminação ou comportamento tóxico",
      "Spam, publicidade ou autopromoção",
      "Postar links externos para benefício pessoal",
      "Discutir política, religião ou assuntos fora do tema",
      "Se passar por mentores, staff ou outros membros",
      "Compartilhar informações pessoais da conta ou dados de login",
    ],
    consequencesTitle: "Consequências",
    consequences:
      "Violações podem resultar em advertência, silenciamento temporário, remoção da mensagem ou banimento.",
    reportingTitle: "Reportar Problemas",
    reporting: [
      "Use o botão “Reportar”",
      "Mencione @Mod no #General",
      "E-mail: promociones@ixsalatrading.com",
    ],
    agreement: "Ao participar, você concorda com estas regras.",
  },
};

const LOCALES: GuidelinesLocale[] = ["en", "es", "pt"];

const CommunityGuidelines = () => {
  const { locale } = useLanguage();
  const initialLocale: GuidelinesLocale =
    (LOCALES as string[]).includes(locale) ? (locale as GuidelinesLocale) : "en";
  const [active, setActive] = useState<GuidelinesLocale>(initialLocale);

  const c = useMemo(() => CONTENT[active], [active]);

  return (
    <>
      <SEO
        title="Community Guidelines — IX LTR"
        description="Read the official community guidelines for the IX LTR. Educational content only — no signals, no financial advice."
        canonical="https://ixsalatrading.com/community/guidelines"
      />
      <div className="min-h-screen bg-background">
        {/* Header bar */}
        <header className="sticky top-0 z-30 border-b border-border/50 bg-background/80 backdrop-blur-md">
          <div className="mx-auto flex max-w-4xl items-center gap-3 px-4 py-3 sm:px-6">
            <Link to="/chatroom">
              <Button variant="ghost" size="sm" className="gap-1.5 text-xs">
                <ArrowLeft className="h-4 w-4" />
                <span className="hidden sm:inline">Back to Community</span>
              </Button>
            </Link>
            <div className="ml-auto flex items-center gap-3">
              <img src={infinoxLogo} alt="INFINOX" className="h-4" />
              <span className="hidden sm:inline text-xs text-muted-foreground/40">|</span>
              <span className="hidden sm:inline font-heading text-xs font-semibold tracking-tight">
                <span className="text-primary">IX</span> LTR
              </span>
            </div>
          </div>
        </header>

        <main className="mx-auto max-w-4xl px-4 py-8 sm:px-6 sm:py-12">
          {/* Hero */}
          <div className="relative overflow-hidden rounded-3xl border border-primary/30 bg-gradient-to-br from-card/90 via-card/70 to-background/40 p-6 backdrop-blur-md shadow-[0_20px_60px_-20px_hsl(48_100%_51%/0.4)] sm:p-10">
            <div className="absolute -top-24 -right-24 h-64 w-64 rounded-full bg-primary/20 blur-3xl" aria-hidden="true" />
            <div className="absolute -bottom-24 -left-24 h-64 w-64 rounded-full bg-primary/10 blur-3xl" aria-hidden="true" />
            <div className="relative">
              <div className="inline-flex items-center gap-2 rounded-full border border-primary/40 bg-primary/10 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.22em] text-primary">
                <ShieldCheck className="h-3 w-3" />
                Community Guidelines
              </div>
              <h1 className="mt-4 font-heading text-2xl font-bold tracking-tight text-foreground sm:text-4xl">
                {c.title}
              </h1>
              <p className="mt-3 text-base text-foreground/80 sm:text-lg">{c.intro}</p>
              <p className="mt-2 text-sm text-muted-foreground sm:text-base">{c.intro2}</p>
            </div>
          </div>

          {/* Language selector */}
          <div className="mt-6 flex flex-wrap items-center justify-center gap-2 rounded-2xl border border-border/40 bg-card/40 p-2 backdrop-blur-sm">
            {LOCALES.map((l) => {
              const isActive = active === l;
              return (
                <button
                  key={l}
                  onClick={() => setActive(l)}
                  className={`rounded-xl px-4 py-2 text-xs font-bold uppercase tracking-wider transition-all ${
                    isActive
                      ? "bg-primary/15 text-primary shadow-[inset_0_0_0_1px_hsl(48_100%_51%/0.4),0_4px_18px_-6px_hsl(48_100%_51%/0.5)]"
                      : "text-muted-foreground hover:bg-secondary/50 hover:text-foreground"
                  }`}
                >
                  {CONTENT[l].label}
                </button>
              );
            })}
          </div>

          {/* Disclaimer card */}
          <div className="mt-6 flex items-start gap-3 rounded-2xl border border-primary/30 bg-primary/5 p-4 sm:p-5">
            <AlertTriangle className="h-5 w-5 shrink-0 text-primary" />
            <p className="text-sm leading-relaxed text-foreground/90">{c.disclaimer}</p>
          </div>

          {/* Core Rules */}
          <Section icon={<BookOpen className="h-4 w-4" />} title={c.coreTitle}>
            <ul className="space-y-2">
              {c.core.map((item, i) => (
                <li key={i} className="flex items-start gap-3 text-sm text-foreground/85">
                  <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </Section>

          {/* Prohibited */}
          <Section icon={<Ban className="h-4 w-4" />} title={c.prohibitedTitle} accent="danger">
            <ul className="space-y-2">
              {c.prohibited.map((item, i) => (
                <li key={i} className="flex items-start gap-3 text-sm text-foreground/85">
                  <Ban className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[hsl(0_70%_55%)]" />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </Section>

          {/* Consequences */}
          <Section icon={<AlertTriangle className="h-4 w-4" />} title={c.consequencesTitle}>
            <p className="text-sm text-foreground/85">{c.consequences}</p>
          </Section>

          {/* Reporting */}
          <Section icon={<Flag className="h-4 w-4" />} title={c.reportingTitle}>
            <ul className="space-y-2">
              {c.reporting.map((item, i) => (
                <li key={i} className="flex items-start gap-3 text-sm text-foreground/85">
                  <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </Section>

          {/* Agreement footer */}
          <div className="mt-8 rounded-2xl border border-primary/40 bg-gradient-to-r from-primary/10 to-primary/5 p-5 text-center backdrop-blur-sm">
            <p className="text-sm font-semibold text-foreground">{c.agreement}</p>
            <Link to="/chatroom">
              <Button className="mt-4 rounded-xl" variant="default">
                {active === "es"
                  ? "Volver a la Comunidad"
                  : active === "pt"
                  ? "Voltar para a Comunidade"
                  : "Back to Community"}
              </Button>
            </Link>
          </div>
        </main>
      </div>
    </>
  );
};

const Section = ({
  icon,
  title,
  children,
  accent,
}: {
  icon: React.ReactNode;
  title: string;
  children: React.ReactNode;
  accent?: "danger";
}) => (
  <section
    className={`mt-6 rounded-2xl border p-5 backdrop-blur-md sm:p-6 ${
      accent === "danger"
        ? "border-[hsl(0_70%_55%/0.25)] bg-card/60"
        : "border-border/50 bg-card/60"
    }`}
  >
    <div className="mb-4 flex items-center gap-2">
      <div
        className={`flex h-8 w-8 items-center justify-center rounded-xl ${
          accent === "danger"
            ? "bg-[hsl(0_70%_55%/0.12)] text-[hsl(0_70%_55%)]"
            : "bg-primary/15 text-primary"
        }`}
      >
        {icon}
      </div>
      <h2 className="font-heading text-lg font-bold tracking-tight text-foreground">{title}</h2>
    </div>
    {children}
  </section>
);

export default CommunityGuidelines;
