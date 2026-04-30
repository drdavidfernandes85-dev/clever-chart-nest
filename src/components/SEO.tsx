import { useEffect } from "react";

interface SEOProps {
  title: string;
  description?: string;
  canonical?: string;
  image?: string;
  type?: "website" | "article";
  jsonLd?: Record<string, unknown> | Record<string, unknown>[];
  keywords?: string;
}

const setMeta = (selector: string, attr: string, key: string, value: string) => {
  let el = document.head.querySelector<HTMLMetaElement>(selector);
  if (!el) {
    el = document.createElement("meta");
    el.setAttribute(attr, key);
    document.head.appendChild(el);
  }
  el.setAttribute("content", value);
};

const setLink = (rel: string, href: string) => {
  let el = document.head.querySelector<HTMLLinkElement>(`link[rel="${rel}"]`);
  if (!el) {
    el = document.createElement("link");
    el.setAttribute("rel", rel);
    document.head.appendChild(el);
  }
  el.setAttribute("href", href);
};

/**
 * Refresh the alternate-language hreflang link tags. The site does not
 * yet use locale-prefixed URLs, so each alternate points at the same URL
 * — this still signals to crawlers that translated content exists at the
 * same address (selected via the in-app switcher / stored preference).
 */
const HREFLANG_LOCALES: { hreflang: string }[] = [
  { hreflang: "en" },
  { hreflang: "es" },
  { hreflang: "pt-BR" },
  { hreflang: "x-default" },
];
const setHreflangs = (canonical: string) => {
  // Remove any previously-injected alternates so the set stays clean
  document.head
    .querySelectorAll('link[rel="alternate"][data-i18n="1"]')
    .forEach((n) => n.remove());
  HREFLANG_LOCALES.forEach(({ hreflang }) => {
    const link = document.createElement("link");
    link.setAttribute("rel", "alternate");
    link.setAttribute("hreflang", hreflang);
    link.setAttribute("href", canonical);
    link.setAttribute("data-i18n", "1");
    document.head.appendChild(link);
  });
};

const SEO = ({ title, description, canonical, image, type = "website", jsonLd, keywords }: SEOProps) => {
  useEffect(() => {
    const fullTitle = title.length > 60 ? title.slice(0, 57) + "…" : title;
    document.title = fullTitle;

    if (description) {
      const desc = description.length > 160 ? description.slice(0, 157) + "…" : description;
      setMeta('meta[name="description"]', "name", "description", desc);
      setMeta('meta[property="og:description"]', "property", "og:description", desc);
      setMeta('meta[name="twitter:description"]', "name", "twitter:description", desc);
    }

    if (keywords) {
      setMeta('meta[name="keywords"]', "name", "keywords", keywords);
    }

    setMeta('meta[property="og:title"]', "property", "og:title", fullTitle);
    setMeta('meta[name="twitter:title"]', "name", "twitter:title", fullTitle);
    setMeta('meta[property="og:type"]', "property", "og:type", type);

    if (canonical) {
      setLink("canonical", canonical);
      setMeta('meta[property="og:url"]', "property", "og:url", canonical);
      setHreflangs(canonical);
    }

    if (image) {
      setMeta('meta[property="og:image"]', "property", "og:image", image);
      setMeta('meta[name="twitter:image"]', "name", "twitter:image", image);
    }

    let scriptEl = document.head.querySelector<HTMLScriptElement>("script#page-jsonld");
    if (jsonLd) {
      if (!scriptEl) {
        scriptEl = document.createElement("script");
        scriptEl.id = "page-jsonld";
        scriptEl.type = "application/ld+json";
        document.head.appendChild(scriptEl);
      }
      scriptEl.textContent = JSON.stringify(jsonLd);
    } else if (scriptEl) {
      scriptEl.remove();
    }
  }, [title, description, canonical, image, type, jsonLd]);

  return null;
};

export default SEO;
