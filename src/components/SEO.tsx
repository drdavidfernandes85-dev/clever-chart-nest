import { useEffect } from "react";

interface SEOProps {
  title: string;
  description?: string;
  canonical?: string;
  image?: string;
  imageAlt?: string;
  twitterCard?: "summary" | "summary_large_image";
  shareTitle?: string;
  shareDescription?: string;
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

const SEO = ({
  title,
  description,
  canonical,
  image,
  imageAlt,
  twitterCard,
  shareTitle,
  shareDescription,
  type = "website",
  jsonLd,
  keywords,
}: SEOProps) => {
  useEffect(() => {
    const fullTitle = title.length > 60 ? title.slice(0, 57) + "…" : title;
    document.title = fullTitle;

    const ogTitle = (shareTitle ?? title);
    const ogTitleClipped = ogTitle.length > 90 ? ogTitle.slice(0, 87) + "…" : ogTitle;

    if (description) {
      const desc = description.length > 160 ? description.slice(0, 157) + "…" : description;
      setMeta('meta[name="description"]', "name", "description", desc);
    }

    const ogDesc = shareDescription ?? description;
    if (ogDesc) {
      const desc = ogDesc.length > 200 ? ogDesc.slice(0, 197) + "…" : ogDesc;
      setMeta('meta[property="og:description"]', "property", "og:description", desc);
      setMeta('meta[name="twitter:description"]', "name", "twitter:description", desc);
    }

    if (keywords) {
      setMeta('meta[name="keywords"]', "name", "keywords", keywords);
    }

    setMeta('meta[property="og:title"]', "property", "og:title", ogTitleClipped);
    setMeta('meta[name="twitter:title"]', "name", "twitter:title", ogTitleClipped);
    setMeta('meta[property="og:type"]', "property", "og:type", type);
    setMeta(
      'meta[name="twitter:card"]',
      "name",
      "twitter:card",
      twitterCard ?? "summary_large_image",
    );

    if (canonical) {
      setLink("canonical", canonical);
      setMeta('meta[property="og:url"]', "property", "og:url", canonical);
      setHreflangs(canonical);
    }

    if (image) {
      setMeta('meta[property="og:image"]', "property", "og:image", image);
      setMeta('meta[name="twitter:image"]', "name", "twitter:image", image);
      setMeta('meta[property="og:image:width"]', "property", "og:image:width", "1200");
      setMeta('meta[property="og:image:height"]', "property", "og:image:height", "630");
      if (imageAlt) {
        setMeta('meta[property="og:image:alt"]', "property", "og:image:alt", imageAlt);
        setMeta('meta[name="twitter:image:alt"]', "name", "twitter:image:alt", imageAlt);
      }
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
  }, [title, description, canonical, image, imageAlt, twitterCard, shareTitle, shareDescription, type, jsonLd, keywords]);

  return null;
};

export default SEO;
