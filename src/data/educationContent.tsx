import {
  Rocket,
  Globe,
  CandlestickChart,
  Activity,
  ShieldCheck,
  Target,
  Sparkles,
  Video,
  ChevronRight,
  Image as ImageIcon,
  type LucideIcon,
} from "lucide-react";
import { Link } from "react-router-dom";
import gettingStartedHero from "@/assets/edu/getting-started.jpg";
import macroHero from "@/assets/edu/macro-analysis.jpg";
import technicalHero from "@/assets/edu/technical-analysis.jpg";
import patternsHero from "@/assets/edu/chart-patterns.jpg";
import riskHero from "@/assets/edu/risk-psychology.jpg";
import strategiesHero from "@/assets/edu/trading-strategies.jpg";
import advancedHero from "@/assets/edu/advanced-topics.jpg";
import videoHero from "@/assets/edu/video-library.jpg";
import { useLanguage } from "@/i18n/LanguageContext";
import type { Locale } from "@/i18n/translations";
import { useMemo } from "react";

export type ModuleSlug =
  | "getting-started"
  | "macro-analysis"
  | "technical-analysis"
  | "chart-patterns"
  | "risk-psychology"
  | "trading-strategies"
  | "advanced-topics"
  | "video-library";

export type EducationModule = {
  slug: ModuleSlug;
  number: string;
  title: string;
  shortTitle: string;
  summary: string;
  read: string;
  icon: LucideIcon;
  hero: string;
  badgeSlug: string; // matches public.badges.slug
  body: () => JSX.Element;
};

/* ------------ Reusable atoms (article-internal) -------------- */

const H2 = ({ children, id }: { children: React.ReactNode; id?: string }) => (
  <h2
    id={id}
    className="font-heading text-2xl md:text-3xl font-bold text-foreground tracking-tight scroll-mt-28"
  >
    {children}
  </h2>
);

const H3 = ({ children }: { children: React.ReactNode }) => (
  <h3 className="font-heading text-lg md:text-xl font-semibold text-foreground mt-6 mb-2">
    {children}
  </h3>
);

const P = ({ children }: { children: React.ReactNode }) => (
  <p className="text-[15px] leading-relaxed text-muted-foreground">{children}</p>
);

const UL = ({ children }: { children: React.ReactNode }) => (
  <ul className="space-y-1.5 text-[15px] leading-relaxed text-muted-foreground list-none pl-0">
    {children}
  </ul>
);

const LI = ({ children }: { children: React.ReactNode }) => (
  <li className="flex gap-2">
    <ChevronRight className="h-4 w-4 mt-1 text-primary shrink-0" />
    <span>{children}</span>
  </li>
);

const ImageHint = ({ children }: { children: React.ReactNode }) => (
  <div className="my-5 flex items-start gap-3 rounded-xl border border-primary/20 bg-primary/[0.04] px-4 py-3">
    <ImageIcon className="h-4 w-4 mt-0.5 text-primary shrink-0" />
    <p className="text-[13px] leading-relaxed text-foreground/80">
      <span className="font-semibold text-primary">{/* label set by parent */}</span>{" "}
      {children}
    </p>
  </div>
);

const KeyTakeaway = ({ label, children }: { label: string; children: React.ReactNode }) => (
  <div className="mt-6 rounded-2xl border border-primary/30 bg-gradient-to-br from-primary/[0.10] via-primary/[0.04] to-transparent p-5">
    <div className="flex items-center gap-2 mb-2">
      <Sparkles className="h-4 w-4 text-primary" />
      <span className="font-proxima text-[11px] font-bold uppercase tracking-[0.2em] text-primary">
        {label}
      </span>
    </div>
    <p className="text-[15px] leading-relaxed text-foreground/90">{children}</p>
  </div>
);

/* -------------------- i18n strings for atoms -------------------- */

const ATOM_LABELS: Record<Locale, { takeaway: string; suggestedImage: string; joinWebinars: string; openVideos: string }> = {
  en: {
    takeaway: "Key Takeaway",
    suggestedImage: "Suggested image:",
    joinWebinars: "Join Live Webinars",
    openVideos: "Open Video Library",
  },
  es: {
    takeaway: "Idea Clave",
    suggestedImage: "Imagen sugerida:",
    joinWebinars: "Unirse a los Webinars en Vivo",
    openVideos: "Abrir la Biblioteca de Videos",
  },
  pt: {
    takeaway: "Ponto-Chave",
    suggestedImage: "Imagem sugerida:",
    joinWebinars: "Entrar nos Webinars ao Vivo",
    openVideos: "Abrir a Biblioteca de Vídeos",
  },
};

const ImgHint = ({ locale, children }: { locale: Locale; children: React.ReactNode }) => (
  <div className="my-5 flex items-start gap-3 rounded-xl border border-primary/20 bg-primary/[0.04] px-4 py-3">
    <ImageIcon className="h-4 w-4 mt-0.5 text-primary shrink-0" />
    <p className="text-[13px] leading-relaxed text-foreground/80">
      <span className="font-semibold text-primary">{ATOM_LABELS[locale].suggestedImage}</span> {children}
    </p>
  </div>
);

/* -------------------- Module bodies (English) -------------------- */

const GettingStartedBody_EN = () => (
  <>
    <P>
      Trading is a craft. Before you risk a single dollar, you need a clear roadmap, the right
      tools, and realistic expectations. This module gives you the foundation every successful
      trader builds on.
    </P>
    <H3>What you'll learn</H3>
    <UL>
      <LI>How global markets work — Forex, indices, commodities, crypto</LI>
      <LI>The difference between brokers, exchanges, and liquidity providers</LI>
      <LI>How to read a price chart and understand bid/ask, spread, and pip value</LI>
      <LI>How to set up your trading platform (MT4 / MT5 / TradingView)</LI>
    </UL>
    <ImgHint locale="en">"Trader's workstation with MT5 and TradingView side-by-side"</ImgHint>
    <H3>Build your trading toolkit</H3>
    <UL>
      <LI>A stable broker with regulated execution (e.g. Infinox)</LI>
      <LI>A charting platform with real-time data</LI>
      <LI>An economic calendar to track high-impact events</LI>
      <LI>A trading journal — every trade, win or loss, gets logged</LI>
    </UL>
    <KeyTakeaway label={ATOM_LABELS.en.takeaway}>
      You don't need 20 indicators or three monitors to start. You need a clean chart, a
      written plan, and the discipline to follow it.
    </KeyTakeaway>
  </>
);

const GettingStartedBody_ES = () => (
  <>
    <P>
      El trading es un oficio. Antes de arriesgar un solo dólar necesitas una hoja de ruta clara,
      las herramientas correctas y expectativas realistas. Este módulo te entrega los fundamentos
      sobre los que se construye toda carrera consistente como trader.
    </P>
    <H3>Qué aprenderás</H3>
    <UL>
      <LI>Cómo funcionan los mercados globales: Forex, índices, materias primas y criptomonedas</LI>
      <LI>La diferencia entre brokers, exchanges y proveedores de liquidez</LI>
      <LI>Cómo leer un gráfico de precios y entender bid/ask, spread y valor del pip</LI>
      <LI>Cómo configurar tu plataforma de trading (MT4 / MT5 / TradingView)</LI>
    </UL>
    <ImgHint locale="es">"Estación de trabajo del trader con MT5 y TradingView lado a lado"</ImgHint>
    <H3>Arma tu kit de herramientas de trading</H3>
    <UL>
      <LI>Un broker regulado con ejecución estable (ej. Infinox)</LI>
      <LI>Una plataforma de gráficos con datos en tiempo real</LI>
      <LI>Un calendario económico para seguir los eventos de alto impacto</LI>
      <LI>Un diario de trading — cada operación, gane o pierda, queda registrada</LI>
    </UL>
    <KeyTakeaway label={ATOM_LABELS.es.takeaway}>
      No necesitas 20 indicadores ni tres monitores para empezar. Necesitas un gráfico limpio,
      un plan escrito y la disciplina para seguirlo.
    </KeyTakeaway>
  </>
);

const GettingStartedBody_PT = () => (
  <>
    <P>
      O trading é um ofício. Antes de arriscar um único dólar você precisa de um roteiro claro,
      das ferramentas certas e de expectativas realistas. Este módulo oferece a base sobre a qual
      todo trader consistente constrói sua carreira.
    </P>
    <H3>O que você vai aprender</H3>
    <UL>
      <LI>Como funcionam os mercados globais: Forex, índices, commodities e criptoativos</LI>
      <LI>A diferença entre brokers, exchanges e provedores de liquidez</LI>
      <LI>Como ler um gráfico de preços e entender bid/ask, spread e valor do pip</LI>
      <LI>Como configurar sua plataforma de trading (MT4 / MT5 / TradingView)</LI>
    </UL>
    <ImgHint locale="pt">"Estação de trabalho do trader com MT5 e TradingView lado a lado"</ImgHint>
    <H3>Monte seu kit de ferramentas de trading</H3>
    <UL>
      <LI>Um broker regulamentado com execução estável (ex. Infinox)</LI>
      <LI>Uma plataforma de gráficos com dados em tempo real</LI>
      <LI>Um calendário econômico para acompanhar eventos de alto impacto</LI>
      <LI>Um diário de trading — toda operação, ganho ou perda, é registrada</LI>
    </UL>
    <KeyTakeaway label={ATOM_LABELS.pt.takeaway}>
      Você não precisa de 20 indicadores nem três monitores para começar. Precisa de um gráfico
      limpo, um plano escrito e disciplina para segui-lo.
    </KeyTakeaway>
  </>
);

/* ---------- Macro ---------- */

const MacroBody_EN = () => (
  <>
    <P>
      Macro analysis looks at the behaviour of an economy as a whole over the medium term,
      taking into account every force that drives its performance. Each economy has its own
      characteristics and dynamics — shaped by monetary &amp; fiscal policy, politics,
      technology, and law — but every economy is measured with the same standardised toolkit
      of economic data.
    </P>
    <P>
      When you analyse a currency pair, you're really comparing the macro outlook of two
      countries. The same logic applies to equities, indices, precious metals, and commodities
      — each is anchored to an underlying economic story. The combination of{" "}
      <strong>macro analysis</strong> for trade direction and{" "}
      <strong>technical analysis</strong> for entry &amp; exit is one of the most powerful
      weapons in a trader's arsenal.
    </P>
    <ImgHint locale="en">
      "Global macro dashboard — central bank rates, inflation, GDP, and risk sentiment in one view"
    </ImgHint>
    <H2>1. Leading Indicators</H2>
    <P>
      Leading indicators move <em>before</em> the broader economy does. They give early
      warning of expansion or contraction — and that's where the edge lives.
    </P>
    <H3>Payroll Data (e.g. US Non-Farm Payrolls)</H3>
    <P>
      Collected monthly by national statistics agencies. It's the most-watched gauge of labour
      market health. <strong>200K+</strong> is typical of expansion; readings near zero — or
      negative spikes — signal contraction.
    </P>
    <H3>Production Indicators</H3>
    <UL>
      <LI><strong>Manufacturing Production</strong> — % change in inflation-adjusted output by manufacturers.</LI>
      <LI><strong>Industrial Production</strong> — same idea but covers the entire industrial sector.</LI>
      <LI><strong>Inventory Levels</strong> — rising inventories signal weak consumer demand.</LI>
    </UL>
    <H3>Retail Sales</H3>
    <P>The most reliable gauge of consumer spending — which accounts for <strong>60–70% of GDP</strong> in most western economies.</P>
    <H3>Jobless Claims, Building Permits &amp; PMI</H3>
    <UL>
      <LI><strong>Jobless Claims</strong> — rising claims signal a deteriorating labour force.</LI>
      <LI><strong>Building Permits / Housing Starts</strong> — early-warning indicators for recession.</LI>
      <LI><strong>PMI / ISM</strong> — &gt;50 expansion, &lt;50 contraction.</LI>
    </UL>
    <H2>2. Lagging Indicators</H2>
    <P>Lagging indicators confirm what leading indicators have already hinted at. But they move markets all the same, because central banks act on them.</P>
    <H3>GDP, Unemployment &amp; Inflation</H3>
    <UL>
      <LI><strong>GDP</strong> — two consecutive negative QoQ readings = recession.</LI>
      <LI><strong>Unemployment Rate</strong> — pair with Labour Force Participation Rate.</LI>
      <LI><strong>Inflation</strong> — CPI, HICP and PCE are the three measures to know.</LI>
    </UL>
    <H3>Interest Rates</H3>
    <UL>
      <LI><strong>Cuts</strong> reduce incentive to save → encourage spending → stimulate the economy.</LI>
      <LI><strong>Hikes</strong> raise the cost of borrowing → reduce risk-taking → cool the economy.</LI>
    </UL>
    <H2>3. The Risk-On / Risk-Off Lens</H2>
    <UL>
      <LI><strong>Risk-on:</strong> stocks, AUD, NZD, EM currencies, crypto rally</LI>
      <LI><strong>Risk-off:</strong> USD, JPY, CHF, gold, and bonds catch a bid</LI>
    </UL>
    <H2>4. Building Your Macro Bias — A Weekly Process</H2>
    <UL>
      <LI>Every Sunday, scan the economic calendar for the week ahead</LI>
      <LI>Identify the 1–2 highest-impact events (rate decisions, CPI, NFP, GDP)</LI>
      <LI>Map your scenarios — never trade macro blind</LI>
      <LI>Wait for technicals to confirm your entry</LI>
    </UL>
    <KeyTakeaway label={ATOM_LABELS.en.takeaway}>
      Technicals tell you <strong>where</strong> to act. Macro tells you <strong>why</strong> the market is moving. The pros use both.
    </KeyTakeaway>
  </>
);

const MacroBody_ES = () => (
  <>
    <P>
      El análisis macro estudia el comportamiento de una economía en su conjunto a medio plazo,
      teniendo en cuenta cada fuerza que impulsa su rendimiento. Cada economía tiene su propia
      dinámica — moldeada por la política monetaria y fiscal, la política, la tecnología y la
      legislación — pero todas se miden con el mismo conjunto estandarizado de datos económicos.
    </P>
    <P>
      Cuando analizas un par de divisas en realidad estás comparando la perspectiva macro de dos
      países. La misma lógica aplica a acciones, índices, metales preciosos y materias primas:
      cada uno está anclado a una historia económica subyacente. Combinar{" "}
      <strong>análisis macro</strong> para la dirección con{" "}
      <strong>análisis técnico</strong> para la entrada y salida es una de las herramientas más
      poderosas del arsenal de un trader.
    </P>
    <ImgHint locale="es">
      "Panel macro global — tipos de los bancos centrales, inflación, PIB y sentimiento de riesgo en una sola vista"
    </ImgHint>
    <H2>1. Indicadores Adelantados</H2>
    <P>
      Los indicadores adelantados se mueven <em>antes</em> que la economía. Avisan con antelación
      de expansión o contracción — y ahí está el verdadero edge.
    </P>
    <H3>Datos de Empleo (ej. Nóminas no Agrícolas de EE. UU.)</H3>
    <P>
      Recopilados mensualmente por las agencias estadísticas nacionales. Es el termómetro más
      observado del mercado laboral. <strong>+200K</strong> es típico de expansión; lecturas cerca
      de cero o negativas indican contracción.
    </P>
    <H3>Indicadores de Producción</H3>
    <UL>
      <LI><strong>Producción Manufacturera</strong> — variación % ajustada por inflación de la producción industrial.</LI>
      <LI><strong>Producción Industrial</strong> — misma idea, cubre todo el sector industrial.</LI>
      <LI><strong>Niveles de Inventarios</strong> — inventarios al alza indican demanda débil.</LI>
    </UL>
    <H3>Ventas Minoristas</H3>
    <P>El indicador más fiable del consumo, que representa el <strong>60–70 % del PIB</strong> en la mayoría de economías occidentales.</P>
    <H3>Solicitudes de Desempleo, Permisos de Construcción y PMI</H3>
    <UL>
      <LI><strong>Solicitudes de Desempleo</strong> — un aumento sostenido anticipa deterioro del empleo.</LI>
      <LI><strong>Permisos de Construcción</strong> — sector típicamente líder hacia recesión.</LI>
      <LI><strong>PMI / ISM</strong> — &gt;50 expansión, &lt;50 contracción.</LI>
    </UL>
    <H2>2. Indicadores Rezagados</H2>
    <P>Los indicadores rezagados confirman lo que los adelantados ya insinuaban. Aun así mueven los mercados, porque los bancos centrales actúan sobre ellos.</P>
    <H3>PIB, Desempleo e Inflación</H3>
    <UL>
      <LI><strong>PIB</strong> — dos lecturas negativas trimestrales consecutivas = recesión.</LI>
      <LI><strong>Tasa de Desempleo</strong> — analízala junto a la Tasa de Participación.</LI>
      <LI><strong>Inflación</strong> — IPC, IPCA y PCE son las tres medidas clave.</LI>
    </UL>
    <H3>Tipos de Interés</H3>
    <UL>
      <LI><strong>Recortes</strong> reducen el incentivo al ahorro → impulsan el gasto y la toma de riesgo.</LI>
      <LI><strong>Subidas</strong> encarecen el crédito → enfrían la economía.</LI>
    </UL>
    <H2>3. La Lente Risk-On / Risk-Off</H2>
    <UL>
      <LI><strong>Risk-on:</strong> acciones, AUD, NZD, divisas emergentes y cripto al alza</LI>
      <LI><strong>Risk-off:</strong> USD, JPY, CHF, oro y bonos reciben demanda</LI>
    </UL>
    <H2>4. Construyendo tu Sesgo Macro — Proceso Semanal</H2>
    <UL>
      <LI>Cada domingo revisa el calendario económico de la semana</LI>
      <LI>Identifica los 1–2 eventos de mayor impacto (decisiones de tipos, IPC, NFP, PIB)</LI>
      <LI>Define escenarios — nunca operes macro a ciegas</LI>
      <LI>Espera la confirmación técnica para entrar</LI>
    </UL>
    <KeyTakeaway label={ATOM_LABELS.es.takeaway}>
      El técnico te dice <strong>dónde</strong> actuar. El macro te dice <strong>por qué</strong> se mueve el mercado. Los profesionales usan ambos.
    </KeyTakeaway>
  </>
);

const MacroBody_PT = () => (
  <>
    <P>
      A análise macro estuda o comportamento de uma economia como um todo no médio prazo,
      considerando todas as forças que impulsionam seu desempenho. Cada economia tem dinâmica
      própria — moldada pela política monetária e fiscal, pela política, pela tecnologia e pela
      legislação — mas todas são medidas com o mesmo conjunto padronizado de dados econômicos.
    </P>
    <P>
      Quando você analisa um par de moedas, está comparando a perspectiva macro de dois países.
      A mesma lógica vale para ações, índices, metais preciosos e commodities: cada ativo está
      ancorado em uma história econômica subjacente. A combinação de{" "}
      <strong>análise macro</strong> para definir a direção com{" "}
      <strong>análise técnica</strong> para entradas e saídas é uma das ferramentas mais
      poderosas do arsenal de um trader.
    </P>
    <ImgHint locale="pt">
      "Painel macro global — taxas de juros, inflação, PIB e sentimento de risco em uma só visão"
    </ImgHint>
    <H2>1. Indicadores Antecedentes</H2>
    <P>
      Indicadores antecedentes se movem <em>antes</em> da economia. Antecipam expansão ou
      contração — e é aí que está o edge.
    </P>
    <H3>Dados de Emprego (ex. Payroll dos EUA)</H3>
    <P>
      Coletados mensalmente pelas agências oficiais. É o termômetro mais observado do mercado de
      trabalho. <strong>+200 mil</strong> é típico de expansão; leituras próximas de zero ou
      negativas indicam contração.
    </P>
    <H3>Indicadores de Produção</H3>
    <UL>
      <LI><strong>Produção Industrial</strong> — variação % real da produção da indústria.</LI>
      <LI><strong>Produção Manufatureira</strong> — recorte da indústria de transformação.</LI>
      <LI><strong>Níveis de Estoque</strong> — estoques em alta sinalizam demanda fraca.</LI>
    </UL>
    <H3>Vendas no Varejo</H3>
    <P>O indicador mais confiável do consumo, que responde por <strong>60–70 % do PIB</strong> na maioria das economias ocidentais.</P>
    <H3>Pedidos de Auxílio-Desemprego, Licenças de Construção e PMI</H3>
    <UL>
      <LI><strong>Pedidos de Auxílio</strong> — alta sustentada antecipa deterioração do emprego.</LI>
      <LI><strong>Licenças de Construção</strong> — setor que costuma liderar a recessão.</LI>
      <LI><strong>PMI / ISM</strong> — &gt;50 expansão, &lt;50 contração.</LI>
    </UL>
    <H2>2. Indicadores Coincidentes/Atrasados</H2>
    <P>Confirmam o que os antecedentes já sugeriam. Ainda assim movem mercados porque os bancos centrais agem com base neles.</P>
    <H3>PIB, Desemprego e Inflação</H3>
    <UL>
      <LI><strong>PIB</strong> — duas leituras negativas trimestrais consecutivas = recessão.</LI>
      <LI><strong>Taxa de Desemprego</strong> — analise em conjunto com a taxa de participação.</LI>
      <LI><strong>Inflação</strong> — IPCA, CPI e PCE são as três medidas-chave.</LI>
    </UL>
    <H3>Taxas de Juros</H3>
    <UL>
      <LI><strong>Cortes</strong> reduzem o incentivo a poupar → estimulam consumo e risco.</LI>
      <LI><strong>Altas</strong> encarecem o crédito → esfriam a economia.</LI>
    </UL>
    <H2>3. A Lente Risk-On / Risk-Off</H2>
    <UL>
      <LI><strong>Risk-on:</strong> ações, AUD, NZD, moedas emergentes e cripto em alta</LI>
      <LI><strong>Risk-off:</strong> USD, JPY, CHF, ouro e títulos recebem demanda</LI>
    </UL>
    <H2>4. Construindo seu Viés Macro — Processo Semanal</H2>
    <UL>
      <LI>Todo domingo, revise o calendário econômico da semana</LI>
      <LI>Identifique os 1–2 eventos de maior impacto (decisões de juros, IPCA, Payroll, PIB)</LI>
      <LI>Defina cenários — nunca opere macro às cegas</LI>
      <LI>Espere a confirmação técnica para entrar</LI>
    </UL>
    <KeyTakeaway label={ATOM_LABELS.pt.takeaway}>
      O técnico mostra <strong>onde</strong> agir. O macro mostra <strong>por que</strong> o mercado se move. Profissionais usam os dois.
    </KeyTakeaway>
  </>
);

/* ---------- Technical ---------- */

const TechnicalBody_EN = () => (
  <>
    <P>
      Technical analysis began with Japanese rice traders in the 17th century and was
      formalised in the West by Charles Dow around 1900. Different origins — same core
      principles:
    </P>
    <UL>
      <LI>The <strong>"what"</strong> (price action) matters more than the <strong>"why"</strong></LI>
      <LI>All known information is already reflected in the price</LI>
      <LI>Buyers and sellers move markets through expectation, fear, and greed</LI>
    </UL>
    <H2>1. Market Regimes</H2>
    <H3>Trending Market</H3>
    <P>An <strong>uptrend</strong> is a succession of higher highs and higher lows. A <strong>downtrend</strong> is a succession of lower highs and lower lows.</P>
    <H3>Ranging Market</H3>
    <P>Sideways action that repeatedly tests the same highs and lows. Support and resistance levels tend to hold with high probability.</P>
    <ImgHint locale="en">"Side-by-side comparison: trending market vs ranging market"</ImgHint>
    <H2>2. Support, Resistance &amp; Confluence</H2>
    <UL>
      <LI><strong>Support</strong> — a price area where buying interest is expected to emerge.</LI>
      <LI><strong>Resistance</strong> — a price area where selling interest is expected to emerge.</LI>
      <LI><strong>Confluence Zone</strong> — when several key levels cluster. <em>Confluence is where the pros wait.</em></LI>
    </UL>
    <H2>3. Fibonacci Retracements &amp; Extensions</H2>
    <UL>
      <LI><strong>Retracement levels:</strong> 0%, 23.6%, 38.2%, 50%, 61.8%, 100%</LI>
      <LI><strong>The 61.8% level</strong> is the most-watched of all</LI>
      <LI><strong>Extensions</strong> project a move forward — used for measured moves and Elliott Wave projections.</LI>
    </UL>
    <H2>4. Reading Candlesticks</H2>
    <P>A candlestick is a snapshot of the battle between buyers and sellers in a fixed time window.</P>
    <H3>Single-Candle Signals</H3>
    <UL>
      <LI><strong>Marubozu</strong> — no wicks. The strongest single-candle signal.</LI>
      <LI><strong>Hammer</strong> — bullish reversal at downtrend bottom.</LI>
      <LI><strong>Shooting Star</strong> — bearish reversal at uptrend top.</LI>
      <LI><strong>Doji</strong> — open = close. Indecision; reversal candidate at extremes.</LI>
    </UL>
    <H3>Two- and Three-Candle Patterns</H3>
    <UL>
      <LI><strong>Bullish / Bearish Engulfing</strong> — strong reversal at structure.</LI>
      <LI><strong>Harami</strong> — small candle inside a prior large body.</LI>
      <LI><strong>Morning / Evening Star</strong> — reliable three-candle reversals.</LI>
    </UL>
    <H2>5. Trend &amp; Moving Averages</H2>
    <UL>
      <LI><strong>SMA</strong> — equal weight to every data point</LI>
      <LI><strong>EMA</strong> — more weight to recent data</LI>
      <LI><strong>50- &amp; 200-day SMAs</strong> — institutional benchmarks</LI>
      <LI><strong>Golden / Death Cross</strong> — regime signals</LI>
    </UL>
    <H2>6. Indicators That Actually Help</H2>
    <H3>RSI &amp; Volume</H3>
    <UL>
      <LI><strong>RSI &lt; 30</strong> — oversold; <strong>&gt; 70</strong> — overbought; divergence = warning of trend exhaustion.</LI>
      <LI>Real moves are confirmed by rising volume; breakouts without volume are traps.</LI>
    </UL>
    <H2>7. Multi-Timeframe Analysis</H2>
    <P>Define the trend on the higher timeframe (Daily / 4H), then time the entry on the lower (15M / 5M). Higher-timeframe context filters out 80% of bad setups.</P>
    <KeyTakeaway label={ATOM_LABELS.en.takeaway}>
      Less is more. A clean chart with structure, one moving average, one momentum tool and a trained eye for candlesticks beats a screen full of noise — every time.
    </KeyTakeaway>
  </>
);

const TechnicalBody_ES = () => (
  <>
    <P>
      El análisis técnico nace con los traders japoneses de arroz en el siglo XVII y fue
      formalizado en Occidente por Charles Dow hacia 1900. Orígenes distintos, mismos principios:
    </P>
    <UL>
      <LI>El <strong>"qué"</strong> (la acción del precio) importa más que el <strong>"por qué"</strong></LI>
      <LI>Toda la información conocida ya está reflejada en el precio</LI>
      <LI>Compradores y vendedores mueven el mercado por expectativa, miedo y codicia</LI>
    </UL>
    <H2>1. Regímenes de Mercado</H2>
    <H3>Mercado en Tendencia</H3>
    <P>Una <strong>tendencia alcista</strong> es una sucesión de máximos y mínimos crecientes. Una <strong>bajista</strong> es lo contrario.</P>
    <H3>Mercado en Rango</H3>
    <P>Movimiento lateral que prueba repetidamente los mismos máximos y mínimos. Los soportes y resistencias suelen aguantar con alta probabilidad.</P>
    <ImgHint locale="es">"Comparativa: mercado en tendencia vs mercado en rango"</ImgHint>
    <H2>2. Soportes, Resistencias y Confluencia</H2>
    <UL>
      <LI><strong>Soporte</strong> — zona donde se espera interés comprador.</LI>
      <LI><strong>Resistencia</strong> — zona donde se espera interés vendedor.</LI>
      <LI><strong>Zona de Confluencia</strong> — varios niveles clave coinciden. <em>Ahí esperan los profesionales.</em></LI>
    </UL>
    <H2>3. Retrocesos y Extensiones de Fibonacci</H2>
    <UL>
      <LI><strong>Retrocesos:</strong> 0%, 23.6%, 38.2%, 50%, 61.8%, 100%</LI>
      <LI><strong>El nivel 61.8%</strong> es el más vigilado</LI>
      <LI><strong>Extensiones</strong> proyectan el movimiento hacia adelante.</LI>
    </UL>
    <H2>4. Lectura de Velas Japonesas</H2>
    <P>Una vela es la fotografía de la batalla entre compradores y vendedores en una ventana de tiempo fija.</P>
    <H3>Señales de una sola vela</H3>
    <UL>
      <LI><strong>Marubozu</strong> — sin mechas. La señal individual más fuerte.</LI>
      <LI><strong>Martillo</strong> — reversión alcista en suelo bajista.</LI>
      <LI><strong>Estrella Fugaz</strong> — reversión bajista en techo alcista.</LI>
      <LI><strong>Doji</strong> — apertura = cierre. Indecisión; candidato a reversión.</LI>
    </UL>
    <H3>Patrones de dos y tres velas</H3>
    <UL>
      <LI><strong>Envolvente Alcista / Bajista</strong> — reversión fuerte en estructura.</LI>
      <LI><strong>Harami</strong> — vela pequeña dentro del cuerpo grande anterior.</LI>
      <LI><strong>Estrella de la Mañana / Tarde</strong> — reversiones fiables de tres velas.</LI>
    </UL>
    <H2>5. Tendencia y Medias Móviles</H2>
    <UL>
      <LI><strong>SMA</strong> — peso igual a cada dato</LI>
      <LI><strong>EMA</strong> — más peso a los datos recientes</LI>
      <LI><strong>SMAs de 50 y 200</strong> — referencia institucional</LI>
      <LI><strong>Cruce Dorado / de la Muerte</strong> — señales de régimen</LI>
    </UL>
    <H2>6. Indicadores Que Realmente Ayudan</H2>
    <H3>RSI y Volumen</H3>
    <UL>
      <LI><strong>RSI &lt; 30</strong> — sobrevendido; <strong>&gt; 70</strong> — sobrecomprado; divergencia = aviso de agotamiento.</LI>
      <LI>Los movimientos reales se confirman con volumen creciente; las rupturas sin volumen son trampas.</LI>
    </UL>
    <H2>7. Análisis Multi-Temporalidad</H2>
    <P>Define la tendencia en la temporalidad mayor (Diario / 4H) y cronometra la entrada en la menor (15M / 5M). El contexto superior filtra el 80% de los malos setups.</P>
    <KeyTakeaway label={ATOM_LABELS.es.takeaway}>
      Menos es más. Un gráfico limpio con estructura, una media móvil, una herramienta de momento y un buen ojo para las velas supera a una pantalla llena de ruido — siempre.
    </KeyTakeaway>
  </>
);

const TechnicalBody_PT = () => (
  <>
    <P>
      A análise técnica nasceu com traders japoneses de arroz no século XVII e foi formalizada
      no Ocidente por Charles Dow por volta de 1900. Origens distintas, mesmos princípios:
    </P>
    <UL>
      <LI>O <strong>"o quê"</strong> (price action) importa mais que o <strong>"por quê"</strong></LI>
      <LI>Toda informação conhecida já está refletida no preço</LI>
      <LI>Compradores e vendedores movem o mercado por expectativa, medo e ganância</LI>
    </UL>
    <H2>1. Regimes de Mercado</H2>
    <H3>Mercado em Tendência</H3>
    <P>Uma <strong>tendência de alta</strong> é uma sucessão de topos e fundos mais altos. Uma <strong>tendência de baixa</strong> é o oposto.</P>
    <H3>Mercado em Range</H3>
    <P>Movimento lateral que testa repetidamente os mesmos topos e fundos. Suportes e resistências tendem a segurar com alta probabilidade.</P>
    <ImgHint locale="pt">"Comparativo: mercado em tendência vs mercado em range"</ImgHint>
    <H2>2. Suporte, Resistência e Confluência</H2>
    <UL>
      <LI><strong>Suporte</strong> — região onde se espera interesse comprador.</LI>
      <LI><strong>Resistência</strong> — região onde se espera interesse vendedor.</LI>
      <LI><strong>Zona de Confluência</strong> — vários níveis-chave coincidem. <em>É onde os profissionais esperam.</em></LI>
    </UL>
    <H2>3. Retrações e Extensões de Fibonacci</H2>
    <UL>
      <LI><strong>Retrações:</strong> 0%, 23.6%, 38.2%, 50%, 61.8%, 100%</LI>
      <LI><strong>O nível 61.8%</strong> é o mais observado</LI>
      <LI><strong>Extensões</strong> projetam o movimento à frente.</LI>
    </UL>
    <H2>4. Leitura de Candles</H2>
    <P>Um candle é a fotografia da batalha entre compradores e vendedores em uma janela de tempo fixa.</P>
    <H3>Sinais de uma única vela</H3>
    <UL>
      <LI><strong>Marubozu</strong> — sem pavios. O sinal individual mais forte.</LI>
      <LI><strong>Martelo</strong> — reversão de alta em fundo de tendência baixista.</LI>
      <LI><strong>Estrela Cadente</strong> — reversão de baixa em topo de tendência altista.</LI>
      <LI><strong>Doji</strong> — abertura = fechamento. Indecisão; candidato a reversão.</LI>
    </UL>
    <H3>Padrões de duas e três velas</H3>
    <UL>
      <LI><strong>Engolfo de Alta / Baixa</strong> — reversão forte em estrutura.</LI>
      <LI><strong>Harami</strong> — vela pequena dentro do corpo grande anterior.</LI>
      <LI><strong>Estrela da Manhã / Tarde</strong> — reversões confiáveis de três velas.</LI>
    </UL>
    <H2>5. Tendência e Médias Móveis</H2>
    <UL>
      <LI><strong>SMA</strong> — peso igual a cada dado</LI>
      <LI><strong>EMA</strong> — mais peso aos dados recentes</LI>
      <LI><strong>SMAs de 50 e 200</strong> — referência institucional</LI>
      <LI><strong>Cruzamento Dourado / da Morte</strong> — sinais de regime</LI>
    </UL>
    <H2>6. Indicadores Que Realmente Ajudam</H2>
    <H3>RSI e Volume</H3>
    <UL>
      <LI><strong>RSI &lt; 30</strong> — sobrevendido; <strong>&gt; 70</strong> — sobrecomprado; divergência = aviso de exaustão.</LI>
      <LI>Movimentos reais são confirmados por volume crescente; rompimentos sem volume são armadilhas.</LI>
    </UL>
    <H2>7. Análise Multi-Tempo Gráfico</H2>
    <P>Defina a tendência no tempo gráfico maior (Diário / 4H) e cronometre a entrada no menor (15M / 5M). O contexto superior filtra 80% dos setups ruins.</P>
    <KeyTakeaway label={ATOM_LABELS.pt.takeaway}>
      Menos é mais. Um gráfico limpo com estrutura, uma média móvel, uma ferramenta de momentum e um olho treinado para candles supera uma tela cheia de ruído — sempre.
    </KeyTakeaway>
  </>
);

/* ---------- Patterns ---------- */

const PatternsBody_EN = () => (
  <>
    <P>Chart patterns are the visible signature of crowd psychology. They form because traders react the same way to the same conditions, generation after generation.</P>
    <H2>1. Continuation Patterns</H2>
    <UL>
      <LI><strong>Flag</strong> — short sloping rectangle after a strong impulsive move ("the pole").</LI>
      <LI><strong>Pennant</strong> — large move followed by consolidation between converging trendlines.</LI>
      <LI><strong>Wedges &amp; Triangles</strong> — pressure building against converging or horizontal levels.</LI>
    </UL>
    <H2>2. Reversal Patterns</H2>
    <H3>Double / Triple Top &amp; Bottom</H3>
    <P>Two or three failed attempts at the same level — the more attempts, the more reliable the reversal.</P>
    <H3>Head &amp; Shoulders (Regular &amp; Inverse)</H3>
    <UL>
      <LI><strong>Entry:</strong> just below (or above) the neckline</LI>
      <LI><strong>Stop:</strong> above (or below) the right shoulder</LI>
      <LI><strong>Target:</strong> distance from head to neckline, projected from the breakout</LI>
    </UL>
    <H3>Cup &amp; Handle</H3>
    <UL>
      <LI><strong>Entry:</strong> just beyond the neckline</LI>
      <LI><strong>Target:</strong> distance from extreme of the cup to the neckline</LI>
    </UL>
    <H2>3. How to Trade a Pattern Correctly</H2>
    <UL>
      <LI>Identify the pattern <em>before</em> the breakout — not after</LI>
      <LI>Wait for a clean break + close beyond the level</LI>
      <LI>Look for a retest for a low-risk entry</LI>
      <LI>Measure the pattern's height to project a realistic target</LI>
      <LI>Place the stop on the opposite side of the pattern</LI>
      <LI>Confirm with volume — real breakouts show expanding participation</LI>
    </UL>
    <KeyTakeaway label={ATOM_LABELS.en.takeaway}>
      Patterns don't predict — they prepare. They give you a framework for <em>where</em> to act and <em>where</em> you're wrong. The edge is in execution.
    </KeyTakeaway>
  </>
);

const PatternsBody_ES = () => (
  <>
    <P>Los patrones gráficos son la firma visible de la psicología del mercado. Aparecen porque los traders reaccionan igual ante las mismas condiciones, generación tras generación.</P>
    <H2>1. Patrones de Continuación</H2>
    <UL>
      <LI><strong>Bandera</strong> — pequeño rectángulo inclinado tras un movimiento impulsivo fuerte ("el mástil").</LI>
      <LI><strong>Banderín</strong> — movimiento amplio seguido de consolidación entre líneas convergentes.</LI>
      <LI><strong>Cuñas y Triángulos</strong> — presión que se acumula contra niveles convergentes u horizontales.</LI>
    </UL>
    <H2>2. Patrones de Reversión</H2>
    <H3>Doble / Triple Techo y Suelo</H3>
    <P>Dos o tres intentos fallidos al mismo nivel — cuantos más intentos, más fiable la reversión.</P>
    <H3>Hombro-Cabeza-Hombro (Regular e Invertido)</H3>
    <UL>
      <LI><strong>Entrada:</strong> justo por debajo (o encima) del cuello</LI>
      <LI><strong>Stop:</strong> sobre (o bajo) el hombro derecho</LI>
      <LI><strong>Objetivo:</strong> distancia cabeza–cuello proyectada desde la ruptura</LI>
    </UL>
    <H3>Taza con Asa</H3>
    <UL>
      <LI><strong>Entrada:</strong> justo por encima del cuello</LI>
      <LI><strong>Objetivo:</strong> distancia desde el extremo de la taza hasta el cuello</LI>
    </UL>
    <H2>3. Cómo Operar un Patrón Correctamente</H2>
    <UL>
      <LI>Identifica el patrón <em>antes</em> de la ruptura — no después</LI>
      <LI>Espera una ruptura limpia con cierre fuera del nivel</LI>
      <LI>Busca un retest para una entrada de bajo riesgo</LI>
      <LI>Mide la altura del patrón para proyectar un objetivo realista</LI>
      <LI>Coloca el stop al lado opuesto del patrón</LI>
      <LI>Confirma con volumen — las rupturas reales muestran participación creciente</LI>
    </UL>
    <KeyTakeaway label={ATOM_LABELS.es.takeaway}>
      Los patrones no predicen — preparan. Te dan un marco para saber <em>dónde</em> actuar y <em>dónde</em> estás equivocado. El edge está en la ejecución.
    </KeyTakeaway>
  </>
);

const PatternsBody_PT = () => (
  <>
    <P>Padrões gráficos são a assinatura visível da psicologia do mercado. Surgem porque traders reagem da mesma forma às mesmas condições, geração após geração.</P>
    <H2>1. Padrões de Continuação</H2>
    <UL>
      <LI><strong>Bandeira</strong> — pequeno retângulo inclinado após um movimento impulsivo forte ("o mastro").</LI>
      <LI><strong>Flâmula</strong> — movimento amplo seguido de consolidação entre linhas convergentes.</LI>
      <LI><strong>Cunhas e Triângulos</strong> — pressão acumulando contra níveis convergentes ou horizontais.</LI>
    </UL>
    <H2>2. Padrões de Reversão</H2>
    <H3>Topo / Fundo Duplo e Triplo</H3>
    <P>Duas ou três tentativas falhas no mesmo nível — quanto mais tentativas, mais confiável a reversão.</P>
    <H3>Ombro-Cabeça-Ombro (Regular e Invertido)</H3>
    <UL>
      <LI><strong>Entrada:</strong> logo abaixo (ou acima) da linha de pescoço</LI>
      <LI><strong>Stop:</strong> acima (ou abaixo) do ombro direito</LI>
      <LI><strong>Alvo:</strong> distância cabeça–pescoço projetada a partir do rompimento</LI>
    </UL>
    <H3>Xícara com Alça</H3>
    <UL>
      <LI><strong>Entrada:</strong> logo acima da linha de pescoço</LI>
      <LI><strong>Alvo:</strong> distância do extremo da xícara até a linha de pescoço</LI>
    </UL>
    <H2>3. Como Operar um Padrão Corretamente</H2>
    <UL>
      <LI>Identifique o padrão <em>antes</em> do rompimento — não depois</LI>
      <LI>Aguarde rompimento limpo com fechamento além do nível</LI>
      <LI>Busque um reteste para entrada de baixo risco</LI>
      <LI>Meça a altura do padrão para projetar um alvo realista</LI>
      <LI>Coloque o stop do lado oposto do padrão</LI>
      <LI>Confirme com volume — rompimentos reais mostram participação crescente</LI>
    </UL>
    <KeyTakeaway label={ATOM_LABELS.pt.takeaway}>
      Padrões não preveem — preparam. Dão um framework para saber <em>onde</em> agir e <em>onde</em> você está errado. O edge está na execução.
    </KeyTakeaway>
  </>
);

/* ---------- Risk & Psychology ---------- */

const RiskBody_EN = () => (
  <>
    <P>Strategy gets you into the game. Risk management keeps you in it. Psychology decides whether you ever become consistent. This is the module that separates traders from gamblers.</P>
    <H2>1. The First Rule: Protect Your Capital</H2>
    <UL>
      <LI>Risk no more than <strong>0.5% – 1%</strong> of your account per trade</LI>
      <LI>Cap your daily loss at <strong>2% – 3%</strong>. Hit it? Stop trading.</LI>
      <LI>Cap your weekly loss at <strong>5%</strong>. Reset before resuming.</LI>
    </UL>
    <H2>2. Position Sizing</H2>
    <P>Position size = (Account × Risk %) ÷ (Stop distance × Pip value). Use a calculator every single trade.</P>
    <H2>3. The Risk-Reward Ratio</H2>
    <UL>
      <LI>Minimum target: <strong>1:2 R:R</strong></LI>
      <LI>With a 40% win rate at 1:2 R:R you are still profitable</LI>
      <LI>Skip any setup that doesn't offer at least 1:2</LI>
    </UL>
    <H2>4. The Psychology Stack</H2>
    <H3>Fear, Greed, Revenge &amp; FOMO</H3>
    <UL>
      <LI><strong>Fear</strong> cuts winners early. Cure: written plan, small enough size.</LI>
      <LI><strong>Greed</strong> makes you oversize and remove stops. Cure: pre-defined risk per trade.</LI>
      <LI><strong>Revenge Trading</strong> — the most expensive habit. Lose a trade → close the platform 30 minutes.</LI>
      <LI><strong>FOMO</strong> — the market opens 24/5. There is no last bus.</LI>
    </UL>
    <H2>5. The Trading Journal — Your Mirror</H2>
    <UL>
      <LI>Log every trade: setup, entry, stop, target, emotion, outcome</LI>
      <LI>Review weekly — patterns of mistakes always emerge</LI>
      <LI>Patterns you can <em>see</em> are patterns you can <em>fix</em></LI>
    </UL>
    <H2>6. The Process Mindset</H2>
    <P>Stop grading yourself by P&amp;L. Grade yourself by execution: did you follow the plan? Process is the only thing you control. Outcome will follow.</P>
    <KeyTakeaway label={ATOM_LABELS.en.takeaway}>Amateurs focus on entries. Professionals focus on risk. Masters focus on themselves.</KeyTakeaway>
  </>
);

const RiskBody_ES = () => (
  <>
    <P>La estrategia te mete en el juego. La gestión de riesgo te mantiene en él. La psicología decide si llegas a ser consistente. Este es el módulo que separa al trader del apostador.</P>
    <H2>1. Primera Regla: Protege tu Capital</H2>
    <UL>
      <LI>No arriesgues más del <strong>0.5 % – 1 %</strong> de la cuenta por operación</LI>
      <LI>Limita la pérdida diaria al <strong>2 % – 3 %</strong>. Si la alcanzas, paras de operar.</LI>
      <LI>Limita la pérdida semanal al <strong>5 %</strong>. Resetea antes de continuar.</LI>
    </UL>
    <H2>2. Tamaño de Posición</H2>
    <P>Tamaño = (Cuenta × % Riesgo) ÷ (Distancia al stop × Valor del pip). Usa la calculadora en <em>cada</em> operación.</P>
    <H2>3. La Relación Riesgo-Beneficio</H2>
    <UL>
      <LI>Objetivo mínimo: <strong>1:2 R:B</strong></LI>
      <LI>Con un 40 % de aciertos a 1:2 sigues siendo rentable</LI>
      <LI>Descarta cualquier setup que no ofrezca al menos 1:2</LI>
    </UL>
    <H2>4. La Pila Psicológica</H2>
    <H3>Miedo, Codicia, Venganza y FOMO</H3>
    <UL>
      <LI><strong>Miedo</strong>: corta los ganadores antes de tiempo. Cura: plan escrito y tamaño pequeño.</LI>
      <LI><strong>Codicia</strong>: te hace sobredimensionar y quitar stops. Cura: riesgo predefinido por trade.</LI>
      <LI><strong>Trading de venganza</strong>: el hábito más caro. Pierdes una operación → cierras la plataforma 30 minutos.</LI>
      <LI><strong>FOMO</strong>: el mercado abre 24/5. No hay último autobús.</LI>
    </UL>
    <H2>5. El Diario de Trading — Tu Espejo</H2>
    <UL>
      <LI>Registra cada operación: setup, entrada, stop, objetivo, emoción, resultado</LI>
      <LI>Revísalo cada semana — siempre emergen patrones de error</LI>
      <LI>Lo que puedes <em>ver</em> es lo que puedes <em>corregir</em></LI>
    </UL>
    <H2>6. La Mentalidad de Proceso</H2>
    <P>Deja de evaluarte por el P&amp;L. Evalúate por la ejecución: ¿seguiste el plan? El proceso es lo único que controlas. El resultado vendrá detrás.</P>
    <KeyTakeaway label={ATOM_LABELS.es.takeaway}>Los aficionados se centran en las entradas. Los profesionales se centran en el riesgo. Los maestros se centran en sí mismos.</KeyTakeaway>
  </>
);

const RiskBody_PT = () => (
  <>
    <P>A estratégia coloca você no jogo. A gestão de risco mantém você nele. A psicologia decide se você se tornará consistente. Este é o módulo que separa o trader do apostador.</P>
    <H2>1. Primeira Regra: Proteja seu Capital</H2>
    <UL>
      <LI>Nunca arrisque mais que <strong>0,5 % – 1 %</strong> da conta por operação</LI>
      <LI>Limite a perda diária a <strong>2 % – 3 %</strong>. Atingiu? Pare de operar.</LI>
      <LI>Limite a perda semanal a <strong>5 %</strong>. Resetar antes de continuar.</LI>
    </UL>
    <H2>2. Tamanho de Posição</H2>
    <P>Tamanho = (Conta × % de Risco) ÷ (Distância do stop × Valor do pip). Use uma calculadora em <em>toda</em> operação.</P>
    <H2>3. A Relação Risco-Retorno</H2>
    <UL>
      <LI>Alvo mínimo: <strong>1:2 R:R</strong></LI>
      <LI>Com 40 % de acerto a 1:2 você ainda é lucrativo</LI>
      <LI>Descarte qualquer setup que não ofereça ao menos 1:2</LI>
    </UL>
    <H2>4. A Pilha Psicológica</H2>
    <H3>Medo, Ganância, Vingança e FOMO</H3>
    <UL>
      <LI><strong>Medo</strong>: corta vencedores cedo demais. Cura: plano escrito e tamanho pequeno.</LI>
      <LI><strong>Ganância</strong>: faz você superdimensionar e tirar stops. Cura: risco pré-definido por trade.</LI>
      <LI><strong>Trading de vingança</strong>: o hábito mais caro. Perdeu uma operação → feche a plataforma por 30 minutos.</LI>
      <LI><strong>FOMO</strong>: o mercado abre 24/5. Não existe "último ônibus".</LI>
    </UL>
    <H2>5. O Diário de Trading — Seu Espelho</H2>
    <UL>
      <LI>Registre cada operação: setup, entrada, stop, alvo, emoção, resultado</LI>
      <LI>Revise semanalmente — padrões de erro sempre aparecem</LI>
      <LI>O que você consegue <em>ver</em> é o que consegue <em>corrigir</em></LI>
    </UL>
    <H2>6. A Mentalidade de Processo</H2>
    <P>Pare de se avaliar pelo P&amp;L. Avalie-se pela execução: você seguiu o plano? O processo é a única coisa que você controla. O resultado vem depois.</P>
    <KeyTakeaway label={ATOM_LABELS.pt.takeaway}>Amadores focam em entradas. Profissionais focam em risco. Mestres focam em si mesmos.</KeyTakeaway>
  </>
);

/* ---------- Strategies ---------- */

const StrategiesBody_EN = () => (
  <>
    <P>A strategy is a repeatable set of rules with a measurable edge. You don't need many — you need one you trust and can execute on autopilot.</P>
    <H3>Trend Following</H3>
    <UL>
      <LI>Higher highs, higher lows on Daily / 4H</LI>
      <LI>Buy pullbacks to EMA 20 / 50 in the direction of trend</LI>
      <LI>Stop below the swing low. Target the prior high. Trail aggressively.</LI>
    </UL>
    <H3>Breakout Trading</H3>
    <UL>
      <LI>Identify a clean range on the higher timeframe</LI>
      <LI>Wait for a candle close beyond the level on increased volume</LI>
      <LI>Enter on retest. Stop inside the range. Target = range height.</LI>
    </UL>
    <H3>Mean Reversion</H3>
    <UL>
      <LI>Best in ranging markets and near key S/R</LI>
      <LI>RSI extremes + reversal candle at structure</LI>
      <LI>Quick targets — mean reversion fades fast</LI>
    </UL>
    <H3>News &amp; Macro Plays</H3>
    <UL>
      <LI>Define scenarios <em>before</em> the release</LI>
      <LI>Wait for the dust to settle — never trade the first 60 seconds</LI>
      <LI>Combine the macro bias with a clean technical entry</LI>
    </UL>
    <KeyTakeaway label={ATOM_LABELS.en.takeaway}>Don't collect strategies — master one. A boring strategy executed flawlessly beats a brilliant strategy executed sometimes.</KeyTakeaway>
  </>
);

const StrategiesBody_ES = () => (
  <>
    <P>Una estrategia es un conjunto repetible de reglas con un edge medible. No necesitas muchas — necesitas una en la que confíes y puedas ejecutar en automático.</P>
    <H3>Seguimiento de Tendencia</H3>
    <UL>
      <LI>Máximos y mínimos crecientes en Diario / 4H</LI>
      <LI>Compra retrocesos a EMA 20 / 50 a favor de la tendencia</LI>
      <LI>Stop bajo el mínimo previo. Objetivo en el máximo anterior. Trailing agresivo.</LI>
    </UL>
    <H3>Trading de Rupturas (Breakout)</H3>
    <UL>
      <LI>Identifica un rango limpio en la temporalidad mayor</LI>
      <LI>Espera cierre de vela fuera del nivel con volumen creciente</LI>
      <LI>Entra en el retest. Stop dentro del rango. Objetivo = altura del rango.</LI>
    </UL>
    <H3>Reversión a la Media</H3>
    <UL>
      <LI>Funciona mejor en rango y cerca de S/R clave</LI>
      <LI>RSI en extremos + vela de reversión en estructura</LI>
      <LI>Objetivos rápidos — la reversión se agota rápido</LI>
    </UL>
    <H3>Noticias y Macro</H3>
    <UL>
      <LI>Define los escenarios <em>antes</em> de la publicación</LI>
      <LI>Deja que el polvo se asiente — nunca operes los primeros 60 segundos</LI>
      <LI>Combina el sesgo macro con una entrada técnica limpia</LI>
    </UL>
    <KeyTakeaway label={ATOM_LABELS.es.takeaway}>No coleccionas estrategias — domina una. Una estrategia aburrida ejecutada impecablemente vence a una brillante ejecutada a medias.</KeyTakeaway>
  </>
);

const StrategiesBody_PT = () => (
  <>
    <P>Uma estratégia é um conjunto repetível de regras com um edge mensurável. Você não precisa de muitas — precisa de uma em que confie e consiga executar no automático.</P>
    <H3>Seguidor de Tendência</H3>
    <UL>
      <LI>Topos e fundos mais altos no Diário / 4H</LI>
      <LI>Compre pullbacks à EMA 20 / 50 a favor da tendência</LI>
      <LI>Stop abaixo do fundo anterior. Alvo no topo prévio. Trailing agressivo.</LI>
    </UL>
    <H3>Trading de Rompimento</H3>
    <UL>
      <LI>Identifique um range limpo no tempo gráfico maior</LI>
      <LI>Aguarde fechamento de vela além do nível com volume crescente</LI>
      <LI>Entre no reteste. Stop dentro do range. Alvo = altura do range.</LI>
    </UL>
    <H3>Reversão à Média</H3>
    <UL>
      <LI>Funciona melhor em range e perto de S/R-chave</LI>
      <LI>RSI em extremos + candle de reversão em estrutura</LI>
      <LI>Alvos rápidos — a reversão se esgota depressa</LI>
    </UL>
    <H3>Notícias e Macro</H3>
    <UL>
      <LI>Defina cenários <em>antes</em> da divulgação</LI>
      <LI>Espere a poeira baixar — nunca opere os primeiros 60 segundos</LI>
      <LI>Combine o viés macro com uma entrada técnica limpa</LI>
    </UL>
    <KeyTakeaway label={ATOM_LABELS.pt.takeaway}>Não colecione estratégias — domine uma. Uma estratégia chata executada com perfeição vence uma estratégia brilhante executada às vezes.</KeyTakeaway>
  </>
);

/* ---------- Advanced ---------- */

const AdvancedBody_EN = () => (
  <>
    <P>Once your foundation is solid, these are the levers that take you from consistent to elite — including two of the most powerful frameworks in technical analysis: <strong>Harmonic Patterns</strong> and <strong>Elliott Wave Theory</strong>.</P>
    <H3>Order Flow &amp; Liquidity</H3>
    <UL>
      <LI>Where are stops sitting? Above prior highs and below prior lows</LI>
      <LI>Smart money hunts liquidity before reversing — learn to spot the sweep</LI>
      <LI>Use volume profile and footprint charts to read intent</LI>
    </UL>
    <H3>Intermarket Analysis</H3>
    <UL>
      <LI>DXY ↑ → most pairs lower, gold pressured</LI>
      <LI>US10Y ↑ → growth stocks compressed, JPY weaker</LI>
      <LI>Oil ↑ → CAD strength, inflation pressure</LI>
    </UL>
    <H3>Correlation &amp; Portfolio Risk</H3>
    <P>Three "different" trades that are all short USD is one trade with triple size. Always sum your <em>true</em> exposure.</P>
    <H2>Harmonic Patterns</H2>
    <P>Geometric price structures that use Fibonacci ratios to define precise reversal zones. First discovered by H.M. Gartley in 1935.</P>
    <H3>ABCD, Gartley, Bat, Butterfly, Crab, Shark</H3>
    <UL>
      <LI><strong>ABCD</strong> — C 0.618 → D 1.618 of BC, or C 0.786 → D 1.27 of BC</LI>
      <LI><strong>Gartley</strong> — B at 0.618 of XA, D at 0.786 of XA</LI>
      <LI><strong>Bat</strong> — D at 0.886 retracement of XA, tight stops</LI>
      <LI><strong>Butterfly</strong> — D extends beyond X, usually 1.27 of XA</LI>
      <LI><strong>Crab / Deep Crab</strong> — D extends to 1.618 of XA</LI>
      <LI><strong>Shark</strong> — trend-change pattern at 0.886 / 1.13</LI>
    </UL>
    <H2>Elliott Wave Theory</H2>
    <H3>The Core Pattern: 5 + 3</H3>
    <UL>
      <LI><strong>Motive waves</strong> — five sub-waves (1, 2, 3, 4, 5) with the larger trend</LI>
      <LI><strong>Corrective waves</strong> — three sub-waves (A, B, C) against the trend</LI>
    </UL>
    <H3>Impulse Wave Rules</H3>
    <UL>
      <LI>Wave 2 cannot retrace &gt; 100% of Wave 1</LI>
      <LI>Wave 3 must be longer than Wave 2 and never the shortest</LI>
      <LI>Wave 4 must NOT trade into Wave 1 territory</LI>
    </UL>
    <H3>Corrective Patterns</H3>
    <UL>
      <LI><strong>Zig-zag (5-3-5)</strong> — sharp 3-wave correction</LI>
      <LI><strong>Flat (3-3-5)</strong> — Regular, Expanded, Running variants</LI>
      <LI><strong>Triangle (3-3-3-3-3)</strong> — five-wave A-B-C-D-E counter-trend</LI>
    </UL>
    <KeyTakeaway label={ATOM_LABELS.en.takeaway}>
      Advanced edge isn't a secret indicator. It's reading what others can't see — liquidity, correlation, harmonic geometry, the wave structure beneath the noise, and your own behaviour.
    </KeyTakeaway>
  </>
);

const AdvancedBody_ES = () => (
  <>
    <P>Una vez sólidas las bases, estos son los niveles que llevan al trader de consistente a élite — incluyendo dos de los marcos más potentes del análisis técnico: <strong>Patrones Armónicos</strong> y <strong>Teoría de Ondas de Elliott</strong>.</P>
    <H3>Order Flow y Liquidez</H3>
    <UL>
      <LI>¿Dónde están los stops? Sobre máximos previos y bajo mínimos previos</LI>
      <LI>El dinero institucional caza liquidez antes de revertir — aprende a detectar el barrido</LI>
      <LI>Usa volume profile y footprint para leer la intención</LI>
    </UL>
    <H3>Análisis Intermercado</H3>
    <UL>
      <LI>DXY ↑ → la mayoría de pares baja, el oro se presiona</LI>
      <LI>US10Y ↑ → acciones growth comprimidas, JPY más débil</LI>
      <LI>Petróleo ↑ → fortaleza del CAD, presión inflacionaria</LI>
    </UL>
    <H3>Correlación y Riesgo de Cartera</H3>
    <P>Tres trades "distintos" todos cortos en USD son un solo trade con triple tamaño. Suma siempre tu exposición <em>real</em>.</P>
    <H2>Patrones Armónicos</H2>
    <P>Estructuras geométricas de precio que usan ratios de Fibonacci para definir zonas precisas de reversión. Descubiertos por H.M. Gartley en 1935.</P>
    <H3>ABCD, Gartley, Bat, Butterfly, Crab, Shark</H3>
    <UL>
      <LI><strong>ABCD</strong> — C 0.618 → D 1.618 de BC, o C 0.786 → D 1.27 de BC</LI>
      <LI><strong>Gartley</strong> — B en 0.618 de XA, D en 0.786 de XA</LI>
      <LI><strong>Bat</strong> — D al 0.886 del retroceso de XA, stops ajustados</LI>
      <LI><strong>Butterfly</strong> — D se extiende más allá de X, normalmente 1.27 de XA</LI>
      <LI><strong>Crab / Deep Crab</strong> — D extiende a 1.618 de XA</LI>
      <LI><strong>Shark</strong> — patrón de cambio de tendencia en 0.886 / 1.13</LI>
    </UL>
    <H2>Teoría de Ondas de Elliott</H2>
    <H3>El Patrón Base: 5 + 3</H3>
    <UL>
      <LI><strong>Ondas motrices</strong> — cinco subondas (1, 2, 3, 4, 5) con la tendencia mayor</LI>
      <LI><strong>Ondas correctivas</strong> — tres subondas (A, B, C) en contra</LI>
    </UL>
    <H3>Reglas de la Onda Impulsiva</H3>
    <UL>
      <LI>La onda 2 no puede retroceder &gt; 100 % de la onda 1</LI>
      <LI>La onda 3 debe ser mayor que la 2 y nunca la más corta</LI>
      <LI>La onda 4 NO puede entrar en el territorio de la onda 1</LI>
    </UL>
    <H3>Patrones Correctivos</H3>
    <UL>
      <LI><strong>Zig-zag (5-3-5)</strong> — corrección rápida de tres ondas</LI>
      <LI><strong>Plana (3-3-5)</strong> — variantes regular, expandida y corrida</LI>
      <LI><strong>Triángulo (3-3-3-3-3)</strong> — cinco ondas A-B-C-D-E contra-tendencia</LI>
    </UL>
    <KeyTakeaway label={ATOM_LABELS.es.takeaway}>
      El edge avanzado no es un indicador secreto. Es leer lo que otros no ven — liquidez, correlación, geometría armónica, la estructura de ondas bajo el ruido y tu propio comportamiento.
    </KeyTakeaway>
  </>
);

const AdvancedBody_PT = () => (
  <>
    <P>Com a base sólida, estes são os níveis que levam o trader de consistente a elite — incluindo dois dos frameworks mais poderosos da análise técnica: <strong>Padrões Harmônicos</strong> e <strong>Teoria das Ondas de Elliott</strong>.</P>
    <H3>Order Flow e Liquidez</H3>
    <UL>
      <LI>Onde estão os stops? Acima de topos anteriores e abaixo de fundos anteriores</LI>
      <LI>O dinheiro institucional caça liquidez antes de reverter — aprenda a identificar a varredura</LI>
      <LI>Use volume profile e footprint para ler a intenção</LI>
    </UL>
    <H3>Análise Intermercado</H3>
    <UL>
      <LI>DXY ↑ → maioria dos pares cai, ouro pressionado</LI>
      <LI>US10Y ↑ → ações de crescimento comprimidas, JPY mais fraco</LI>
      <LI>Petróleo ↑ → fortalecimento do CAD, pressão inflacionária</LI>
    </UL>
    <H3>Correlação e Risco de Portfólio</H3>
    <P>Três trades "diferentes" todos vendidos em USD são um único trade com tamanho triplo. Some sempre sua exposição <em>real</em>.</P>
    <H2>Padrões Harmônicos</H2>
    <P>Estruturas geométricas de preço que usam razões de Fibonacci para definir zonas precisas de reversão. Descobertos por H.M. Gartley em 1935.</P>
    <H3>ABCD, Gartley, Bat, Butterfly, Crab, Shark</H3>
    <UL>
      <LI><strong>ABCD</strong> — C 0.618 → D 1.618 de BC, ou C 0.786 → D 1.27 de BC</LI>
      <LI><strong>Gartley</strong> — B em 0.618 de XA, D em 0.786 de XA</LI>
      <LI><strong>Bat</strong> — D na retração 0.886 de XA, stops apertados</LI>
      <LI><strong>Butterfly</strong> — D se estende além de X, normalmente 1.27 de XA</LI>
      <LI><strong>Crab / Deep Crab</strong> — D estende a 1.618 de XA</LI>
      <LI><strong>Shark</strong> — padrão de mudança de tendência em 0.886 / 1.13</LI>
    </UL>
    <H2>Teoria das Ondas de Elliott</H2>
    <H3>O Padrão Base: 5 + 3</H3>
    <UL>
      <LI><strong>Ondas motoras</strong> — cinco subondas (1, 2, 3, 4, 5) a favor da tendência maior</LI>
      <LI><strong>Ondas corretivas</strong> — três subondas (A, B, C) contra</LI>
    </UL>
    <H3>Regras da Onda Impulsiva</H3>
    <UL>
      <LI>Onda 2 não pode retrair &gt; 100 % da onda 1</LI>
      <LI>Onda 3 deve ser maior que a 2 e nunca a mais curta</LI>
      <LI>Onda 4 NÃO pode entrar no território da onda 1</LI>
    </UL>
    <H3>Padrões Corretivos</H3>
    <UL>
      <LI><strong>Zig-zag (5-3-5)</strong> — correção rápida de três ondas</LI>
      <LI><strong>Plana (3-3-5)</strong> — variantes regular, expandida e corrida</LI>
      <LI><strong>Triângulo (3-3-3-3-3)</strong> — cinco ondas A-B-C-D-E contra-tendência</LI>
    </UL>
    <KeyTakeaway label={ATOM_LABELS.pt.takeaway}>
      O edge avançado não é um indicador secreto. É ler o que outros não veem — liquidez, correlação, geometria harmônica, a estrutura de ondas sob o ruído e seu próprio comportamento.
    </KeyTakeaway>
  </>
);

/* ---------- Video library ---------- */

const VideoBody_EN = () => (
  <>
    <P>Theory becomes intuition when you watch real traders execute in real markets. Our live webinars and on-demand video library are <strong>free for every member</strong> of the IX Sala de Trading.</P>
    <UL>
      <LI>Daily live sessions — London &amp; New York opens, with Q&amp;A</LI>
      <LI>Recorded archive — every webinar, indexed by topic and instrument</LI>
      <LI>Trade-of-the-day breakdowns from our senior analysts</LI>
      <LI>Member workshops on journaling, risk, and psychology</LI>
    </UL>
    <div className="mt-6 flex flex-wrap gap-3">
      <Link to="/webinars" className="inline-flex items-center gap-2 rounded-xl bg-primary px-5 py-2.5 font-proxima text-sm font-bold uppercase tracking-wider text-primary-foreground shadow-[0_10px_30px_-10px_hsl(48_100%_51%/0.6)] hover:brightness-110 transition">
        <Video className="h-4 w-4" />{ATOM_LABELS.en.joinWebinars}
      </Link>
      <Link to="/videos" className="inline-flex items-center gap-2 rounded-xl border border-primary/30 bg-card/40 px-5 py-2.5 font-proxima text-sm font-bold uppercase tracking-wider text-foreground hover:border-primary/60 hover:bg-primary/10 transition">
        {ATOM_LABELS.en.openVideos}
      </Link>
    </div>
  </>
);

const VideoBody_ES = () => (
  <>
    <P>La teoría se convierte en intuición cuando ves a traders reales ejecutar en mercados reales. Nuestros webinars en vivo y la videoteca bajo demanda son <strong>gratis para cada miembro</strong> de la IX Sala de Trading.</P>
    <UL>
      <LI>Sesiones en vivo diarias — apertura de Londres y Nueva York, con Q&amp;A</LI>
      <LI>Archivo grabado — cada webinar, indexado por tema e instrumento</LI>
      <LI>Análisis del trade del día de nuestros analistas senior</LI>
      <LI>Talleres para miembros sobre diario, riesgo y psicología</LI>
    </UL>
    <div className="mt-6 flex flex-wrap gap-3">
      <Link to="/webinars" className="inline-flex items-center gap-2 rounded-xl bg-primary px-5 py-2.5 font-proxima text-sm font-bold uppercase tracking-wider text-primary-foreground shadow-[0_10px_30px_-10px_hsl(48_100%_51%/0.6)] hover:brightness-110 transition">
        <Video className="h-4 w-4" />{ATOM_LABELS.es.joinWebinars}
      </Link>
      <Link to="/videos" className="inline-flex items-center gap-2 rounded-xl border border-primary/30 bg-card/40 px-5 py-2.5 font-proxima text-sm font-bold uppercase tracking-wider text-foreground hover:border-primary/60 hover:bg-primary/10 transition">
        {ATOM_LABELS.es.openVideos}
      </Link>
    </div>
  </>
);

const VideoBody_PT = () => (
  <>
    <P>A teoria vira intuição quando você assiste traders reais executando em mercados reais. Nossos webinars ao vivo e a videoteca sob demanda são <strong>gratuitos para todos os membros</strong> da IX Sala de Trading.</P>
    <UL>
      <LI>Sessões ao vivo diárias — aberturas de Londres e Nova York, com Q&amp;A</LI>
      <LI>Acervo gravado — cada webinar, indexado por tema e instrumento</LI>
      <LI>Análise do trade do dia pelos nossos analistas seniores</LI>
      <LI>Workshops para membros sobre diário, risco e psicologia</LI>
    </UL>
    <div className="mt-6 flex flex-wrap gap-3">
      <Link to="/webinars" className="inline-flex items-center gap-2 rounded-xl bg-primary px-5 py-2.5 font-proxima text-sm font-bold uppercase tracking-wider text-primary-foreground shadow-[0_10px_30px_-10px_hsl(48_100%_51%/0.6)] hover:brightness-110 transition">
        <Video className="h-4 w-4" />{ATOM_LABELS.pt.joinWebinars}
      </Link>
      <Link to="/videos" className="inline-flex items-center gap-2 rounded-xl border border-primary/30 bg-card/40 px-5 py-2.5 font-proxima text-sm font-bold uppercase tracking-wider text-foreground hover:border-primary/60 hover:bg-primary/10 transition">
        {ATOM_LABELS.pt.openVideos}
      </Link>
    </div>
  </>
);

/* -------------------- Module metadata per locale -------------------- */

type ModuleMeta = Pick<EducationModule, "title" | "shortTitle" | "summary" | "read">;

const META: Record<Locale, Record<ModuleSlug, ModuleMeta>> = {
  en: {
    "getting-started": { title: "Getting Started: Your First Steps as a Trader", shortTitle: "Getting Started", summary: "Foundations every successful trader builds on — markets, brokers, charts, and your toolkit.", read: "6 min read" },
    "macro-analysis": { title: "Macro Analysis: Reading the Global Economic Engine", shortTitle: "Macro Analysis", summary: "Leading & lagging indicators, central banks, and the risk-on / risk-off lens that drives every market.", read: "14 min read" },
    "technical-analysis": { title: "Technical Analysis: The Language of Price", shortTitle: "Technical Analysis", summary: "Market regimes, support/resistance, Fibonacci, candlestick encyclopedia, indicators, multi-TF.", read: "18 min read" },
    "chart-patterns": { title: "Chart Patterns: Recurring Footprints of the Market", shortTitle: "Chart Patterns", summary: "Continuation and reversal patterns with precise entries, stops, and target projections.", read: "13 min read" },
    "risk-psychology": { title: "Risk Management & Trading Psychology", shortTitle: "Risk & Psychology", summary: "The math, the mindset, and the discipline that separates traders from gamblers.", read: "12 min read" },
    "trading-strategies": { title: "Trading Strategies: Frameworks That Actually Work", shortTitle: "Trading Strategies", summary: "Trend following, breakouts, mean reversion, and macro plays — battle-tested frameworks.", read: "8 min read" },
    "advanced-topics": { title: "Advanced Topics: Where Edge Compounds", shortTitle: "Advanced Topics", summary: "Order flow, intermarket analysis, harmonic patterns, and the full Elliott Wave framework.", read: "20 min read" },
    "video-library": { title: "Webinars & Video Library", shortTitle: "Webinars & Videos", summary: "Watch real traders execute in real markets — live sessions, recordings, and member workshops.", read: "Always-on" },
  },
  es: {
    "getting-started": { title: "Primeros Pasos: Inicia tu Camino como Trader", shortTitle: "Primeros Pasos", summary: "Los fundamentos sobre los que se construye toda carrera consistente: mercados, brokers, gráficos y kit de herramientas.", read: "6 min de lectura" },
    "macro-analysis": { title: "Análisis Macro: Lee el Motor Económico Global", shortTitle: "Análisis Macro", summary: "Indicadores adelantados y rezagados, bancos centrales y la lente risk-on / risk-off que mueve cada mercado.", read: "14 min de lectura" },
    "technical-analysis": { title: "Análisis Técnico: El Lenguaje del Precio", shortTitle: "Análisis Técnico", summary: "Regímenes de mercado, soportes y resistencias, Fibonacci, velas japonesas, indicadores y multi-temporalidad.", read: "18 min de lectura" },
    "chart-patterns": { title: "Patrones Gráficos: La Huella Recurrente del Mercado", shortTitle: "Patrones Gráficos", summary: "Patrones de continuación y reversión con entradas precisas, stops y proyecciones de objetivo.", read: "13 min de lectura" },
    "risk-psychology": { title: "Gestión de Riesgo y Psicología del Trading", shortTitle: "Riesgo y Psicología", summary: "Las matemáticas, la mentalidad y la disciplina que separan al trader del apostador.", read: "12 min de lectura" },
    "trading-strategies": { title: "Estrategias de Trading: Marcos Que Sí Funcionan", shortTitle: "Estrategias de Trading", summary: "Seguimiento de tendencia, rupturas, reversión a la media y operativa macro — frameworks probados.", read: "8 min de lectura" },
    "advanced-topics": { title: "Temas Avanzados: Donde el Edge se Compone", shortTitle: "Temas Avanzados", summary: "Order flow, análisis intermercado, patrones armónicos y el framework completo de Ondas de Elliott.", read: "20 min de lectura" },
    "video-library": { title: "Webinars y Videoteca", shortTitle: "Webinars y Videos", summary: "Observa a traders reales ejecutar en mercados reales — sesiones en vivo, grabaciones y talleres para miembros.", read: "Siempre disponible" },
  },
  pt: {
    "getting-started": { title: "Começando: Seus Primeiros Passos como Trader", shortTitle: "Começando", summary: "Os fundamentos sobre os quais toda carreira consistente é construída: mercados, brokers, gráficos e kit de ferramentas.", read: "6 min de leitura" },
    "macro-analysis": { title: "Análise Macro: Leia o Motor Econômico Global", shortTitle: "Análise Macro", summary: "Indicadores antecedentes e atrasados, bancos centrais e a lente risk-on / risk-off que move todo mercado.", read: "14 min de leitura" },
    "technical-analysis": { title: "Análise Técnica: A Linguagem do Preço", shortTitle: "Análise Técnica", summary: "Regimes de mercado, suporte/resistência, Fibonacci, candles, indicadores e multi-tempos gráficos.", read: "18 min de leitura" },
    "chart-patterns": { title: "Padrões Gráficos: As Pegadas Recorrentes do Mercado", shortTitle: "Padrões Gráficos", summary: "Padrões de continuação e reversão com entradas precisas, stops e projeções de alvo.", read: "13 min de leitura" },
    "risk-psychology": { title: "Gestão de Risco e Psicologia do Trading", shortTitle: "Risco e Psicologia", summary: "A matemática, a mentalidade e a disciplina que separam o trader do apostador.", read: "12 min de leitura" },
    "trading-strategies": { title: "Estratégias de Trading: Frameworks Que Realmente Funcionam", shortTitle: "Estratégias de Trading", summary: "Seguidor de tendência, rompimentos, reversão à média e operações macro — frameworks testados.", read: "8 min de leitura" },
    "advanced-topics": { title: "Tópicos Avançados: Onde o Edge se Acumula", shortTitle: "Tópicos Avançados", summary: "Order flow, análise intermercado, padrões harmônicos e o framework completo das Ondas de Elliott.", read: "20 min de leitura" },
    "video-library": { title: "Webinars e Videoteca", shortTitle: "Webinars e Vídeos", summary: "Veja traders reais executando em mercados reais — sessões ao vivo, gravações e workshops para membros.", read: "Sempre disponível" },
  },
};

/* -------------------- Bodies map -------------------- */

const BODIES: Record<Locale, Record<ModuleSlug, () => JSX.Element>> = {
  en: {
    "getting-started": GettingStartedBody_EN,
    "macro-analysis": MacroBody_EN,
    "technical-analysis": TechnicalBody_EN,
    "chart-patterns": PatternsBody_EN,
    "risk-psychology": RiskBody_EN,
    "trading-strategies": StrategiesBody_EN,
    "advanced-topics": AdvancedBody_EN,
    "video-library": VideoBody_EN,
  },
  es: {
    "getting-started": GettingStartedBody_ES,
    "macro-analysis": MacroBody_ES,
    "technical-analysis": TechnicalBody_ES,
    "chart-patterns": PatternsBody_ES,
    "risk-psychology": RiskBody_ES,
    "trading-strategies": StrategiesBody_ES,
    "advanced-topics": AdvancedBody_ES,
    "video-library": VideoBody_ES,
  },
  pt: {
    "getting-started": GettingStartedBody_PT,
    "macro-analysis": MacroBody_PT,
    "technical-analysis": TechnicalBody_PT,
    "chart-patterns": PatternsBody_PT,
    "risk-psychology": RiskBody_PT,
    "trading-strategies": StrategiesBody_PT,
    "advanced-topics": AdvancedBody_PT,
    "video-library": VideoBody_PT,
  },
};

/* -------------------- Static module skeleton (icons, heroes, slugs) -------------------- */

type ModuleSkeleton = Pick<EducationModule, "slug" | "number" | "icon" | "hero" | "badgeSlug">;

const SKELETONS: ModuleSkeleton[] = [
  { slug: "getting-started",    number: "01", icon: Rocket,           hero: gettingStartedHero, badgeSlug: "edu_getting_started" },
  { slug: "macro-analysis",     number: "02", icon: Globe,            hero: macroHero,          badgeSlug: "edu_macro_analysis" },
  { slug: "technical-analysis", number: "03", icon: CandlestickChart, hero: technicalHero,      badgeSlug: "edu_technical_analysis" },
  { slug: "chart-patterns",     number: "04", icon: Activity,         hero: patternsHero,       badgeSlug: "edu_chart_patterns" },
  { slug: "risk-psychology",    number: "05", icon: ShieldCheck,      hero: riskHero,           badgeSlug: "edu_risk_psychology" },
  { slug: "trading-strategies", number: "06", icon: Target,           hero: strategiesHero,     badgeSlug: "edu_trading_strategies" },
  { slug: "advanced-topics",    number: "07", icon: Sparkles,         hero: advancedHero,       badgeSlug: "edu_advanced_topics" },
  { slug: "video-library",      number: "08", icon: Video,            hero: videoHero,          badgeSlug: "edu_video_library" },
];

export const getModules = (locale: Locale): EducationModule[] =>
  SKELETONS.map((s) => ({
    ...s,
    ...META[locale][s.slug],
    body: BODIES[locale][s.slug],
  }));

/** Hook returning locale-aware modules. */
export const useModules = (): EducationModule[] => {
  const { locale } = useLanguage();
  return useMemo(() => getModules(locale), [locale]);
};

/** Backward-compat: English modules. Prefer useModules() in components. */
export const MODULES: EducationModule[] = getModules("en");

export const TOTAL_MODULES = SKELETONS.length;
