# Google Search Console — Checklist de verificación

Dominio: **https://ixsalatrading.com**

## 1. Propiedades a verificar
- [ ] `https://ixsalatrading.com/` (Dominio o prefijo URL)
- [ ] (Opcional) `https://www.ixsalatrading.com/`
- [ ] Alias: `https://www.salatradingelite.com/`, `https://salatradingelite.com/` (redirección 301 → dominio principal)

## 2. Sitemaps a enviar (Indexación → Sitemaps)
- [ ] `https://ixsalatrading.com/sitemap.xml` (índice)
- [ ] `https://ixsalatrading.com/sitemap-es.xml`
- [ ] `https://ixsalatrading.com/sitemap-pt-BR.xml`
- [ ] `https://ixsalatrading.com/sitemap-en.xml`

Estado esperado: **Correcto** y `Discovered URLs ≥ 10` por sitemap.

## 3. robots.txt (Configuración → robots.txt)
- [ ] Probador devuelve `Allow: /` para `/`, `/education`, `/webinars`, `/videos`, `/leaderboard`, `/community/guidelines`, `/register`, `/login`, `/forgot-password`, `/webinar`.
- [ ] Probador devuelve `Disallow` para `/dashboard`, `/chatroom`, `/analytics`, `/signals`, `/connect`, `/connect-mt`, `/admin`, `/u/`, `/__qa/`.

## 4. Inspección de URL (URL Inspection)
Para cada URL listada en sitemap-es.xml ejecutar:
- [ ] `https://ixsalatrading.com/`
- [ ] `https://ixsalatrading.com/education`
- [ ] `https://ixsalatrading.com/webinars`
- [ ] `https://ixsalatrading.com/videos`
- [ ] `https://ixsalatrading.com/leaderboard`
- [ ] `https://ixsalatrading.com/community/guidelines`
- [ ] `https://ixsalatrading.com/register`
- [ ] `https://ixsalatrading.com/login`
- [ ] `https://ixsalatrading.com/webinar`
- [ ] `https://ixsalatrading.com/forgot-password`

Para cada una confirmar:
- [ ] `URL is on Google` o solicitar **Request Indexing**
- [ ] **Coverage** = `Submitted and indexed`
- [ ] **Mobile usability** = OK
- [ ] **Rich results detected**: Organization + WebSite (todas), Course/ItemList/FAQPage (education), FAQPage (webinars, videos), FAQPage + EducationalOrganization (home)
- [ ] **hreflang** detectados: `es`, `pt-BR`, `en`, `x-default`

## 5. Cobertura (Pages → Indexed/Not indexed)
- [ ] 0 errores "Submitted URL blocked by robots.txt" en URLs públicas
- [ ] 0 "Duplicate without user-selected canonical" en `/`, `/education`, `/webinars`, `/videos`
- [ ] URLs gated (`/dashboard`, etc.) aparecen como **Excluded → Blocked by robots.txt** (correcto)

## 6. Internacional (Legacy tools → International Targeting)
- [ ] Pestaña Language: 0 errores hreflang
- [ ] Pares recíprocos detectados entre `es` ↔ `pt-BR` ↔ `en` para cada URL

## 7. Rich Results Test
Validar manualmente con https://search.google.com/test/rich-results:
- [ ] `https://ixsalatrading.com/` → EducationalOrganization, WebSite, FAQPage válidos
- [ ] `https://ixsalatrading.com/education` → Course, ItemList, BreadcrumbList, FAQPage válidos
- [ ] `https://ixsalatrading.com/webinars` → Organization, WebSite, BreadcrumbList, FAQPage válidos
- [ ] `https://ixsalatrading.com/videos` → Organization, WebSite, CollectionPage, FAQPage válidos

## 8. Re-ejecución
Repetir secciones 4–7 después de cada despliegue mayor o cambio de copy / schema.
