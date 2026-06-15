import { Helmet } from "react-helmet-async";
import { useLocation } from "react-router-dom";
import { useLanguage } from "@/i18n/LanguageContext";

/**
 * Per-language SEO head:
 *  - One canonical URL per language (self-referential, includes ?lang= for non-default)
 *  - hreflang block in the required order: x-default (es) → pt-BR → en
 *  - <html lang> is kept in sync by LanguageContext; we also set the og:locale here
 *
 * NOTE on rendering for crawlers: Lovable static hosting does NOT do SSR. JS-executing
 * crawlers (Googlebot, Bingbot) will execute React and see this Helmet output + the
 * full rendered DOM. Non-JS social-preview crawlers (LinkedIn, Slack, Facebook, X
 * fallback) only see the static `index.html` head, which already contains the
 * Spanish-first metadata and the full hreflang block as a fallback.
 * For full prerendering at build time, the project would need an external
 * prerender step (e.g. @prerenderer/rollup-plugin with Puppeteer) or a real SSR
 * runtime — neither runs in the Lovable static-hosting build pipeline today.
 */

const SITE = "https://ixsalatrading.com";

const localeToHreflang = (l: "es" | "pt" | "en") =>
  l === "pt" ? "pt-BR" : l; // we ship Brazilian Portuguese only — never pt-PT

const langParamFor = (l: "es" | "pt" | "en") =>
  l === "es" ? "" : l === "pt" ? "?lang=pt-BR" : "?lang=en";

const ogLocaleFor = (l: "es" | "pt" | "en") =>
  l === "es" ? "es_LA" : l === "pt" ? "pt_BR" : "en_US";

export default function LocalizedHead() {
  const { locale } = useLanguage();
  const { pathname } = useLocation();
  const path = pathname === "/" ? "" : pathname;
  const canonical = `${SITE}${path}${langParamFor(locale)}`;

  return (
    <Helmet>
      <html lang={localeToHreflang(locale)} />
      <link rel="canonical" href={canonical} />
      <meta property="og:locale" content={ogLocaleFor(locale)} />
      <meta property="og:url" content={canonical} />

      {/* Order is mandatory: x-default (es) → pt-BR → en. No pt-PT. */}
      <link rel="alternate" hrefLang="x-default" href={`${SITE}${path}`} />
      <link rel="alternate" hrefLang="es" href={`${SITE}${path}`} />
      <link rel="alternate" hrefLang="pt-BR" href={`${SITE}${path}?lang=pt-BR`} />
      <link rel="alternate" hrefLang="en" href={`${SITE}${path}?lang=en`} />
    </Helmet>
  );
}
