## Problem

Several homepage sections render hardcoded Spanish text instead of using the `t()` translation function, so switching the language to EN/PT has no effect on those areas.

Confirmed offenders (not wired into i18n):
- `src/components/home/PlatformPillars.tsx` (~370 lines, lots of copy)
- `src/components/home/CTAButtons.tsx`
- `src/components/home/ComplianceBlock.tsx`

The translation infrastructure (`LanguageContext`, `translations.ts`, `LanguageSwitcher`) is working correctly — the issue is only that these components never call `useLanguage()`/`t()`.

## Plan

1. **Add translation keys** to `src/i18n/translations.ts` for every user-visible Spanish string in the three components, with EN, ES, and PT-BR values. Group them under `home.pillars.*`, `home.cta.*`, and `home.compliance.*`.

2. **Refactor `PlatformPillars.tsx`** to:
   - Import `useLanguage` and call `t()` for every section header, pillar title, body copy, pill label, button label, and mock-UI label.
   - Keep all layout, icons, and styling identical.

3. **Refactor `CTAButtons.tsx`** to read the default button label and any helper text from `t()`.

4. **Refactor `ComplianceBlock.tsx`** to translate eyebrow, title, paragraphs, and disclaimer copy.

5. **Sanity sweep** of other home-rendered components (`HeroSection`, `MentoringSection`, `TeamSection`, `Footer`, `Navbar`, `FAQSection`, `SponsorsSection`, `TrustpilotSection`) — they already use `t()`. Spot-check for any leftover hardcoded Spanish strings and add keys/translations only where found.

6. **Verify** by switching the language to US English in the preview and confirming the homepage renders fully in English.

## Out of scope

- Dashboard/terminal/chatroom pages (separate request if needed later).
- Changing default locale or auto-detecting browser language.
