// supabase/functions/send-webinar-confirmation/index.ts
// Sends a localized email confirmation to a webinar registrant, with the
// session topic, date/time, and an .ics calendar invite attached so users
// can add the session to their calendar in one click.
//
// Uses Resend (same provider as send-contact-email). Requires RESEND_API_KEY.

import { z } from 'https://deno.land/x/zod@v3.22.4/mod.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type',
}

const BodySchema = z.object({
  name: z.string().trim().min(1).max(120),
  email: z.string().trim().email().max(255),
  locale: z.enum(['en', 'es', 'pt']).default('en'),
  webinar: z.object({
    id: z.string().nullable().optional(),
    topic: z.string().min(1).max(300),
    scheduledAt: z.string().min(1).max(100), // ISO
    durationMinutes: z.number().int().positive().max(720),
    hostName: z.string().max(160).nullable().optional(),
    joinUrl: z.string().url().max(500).nullable().optional(),
  }),
})

type Body = z.infer<typeof BodySchema>
type Locale = Body['locale']

const SITE_NAME = 'IX Live Trading Room'
const SITE_URL = 'https://elitelivetradingroom.com'

const COPY: Record<Locale, {
  subject: (topic: string) => string
  hello: (name: string) => string
  intro: string
  details: string
  topicLabel: string
  whenLabel: string
  durationLabel: string
  hostLabel: string
  joinLabel: string
  cta: string
  ics: string
  footer: string
  disclaimer: string
}> = {
  en: {
    subject: (topic) => `🎓 You're registered: ${topic}`,
    hello: (name) => `Hi ${name},`,
    intro:
      "You're confirmed for our next free live educational webinar. We've attached a calendar invite so you don't miss it.",
    details: 'Session details',
    topicLabel: 'Topic',
    whenLabel: 'Date & time',
    durationLabel: 'Duration',
    hostLabel: 'Host',
    joinLabel: 'Join link',
    cta: 'Add to calendar',
    ics: 'Open the attached file (.ics) to add this session to your calendar.',
    footer: `See you live! — The ${SITE_NAME} team`,
    disclaimer:
      'All content is for educational purposes only. Trading involves significant risk of loss.',
  },
  es: {
    subject: (topic) => `🎓 Inscripción confirmada: ${topic}`,
    hello: (name) => `Hola ${name},`,
    intro:
      'Tu inscripción al próximo webinar educativo gratuito en vivo está confirmada. Adjuntamos una invitación de calendario para que no te lo pierdas.',
    details: 'Detalles de la sesión',
    topicLabel: 'Tema',
    whenLabel: 'Fecha y hora',
    durationLabel: 'Duración',
    hostLabel: 'Presentador',
    joinLabel: 'Enlace de acceso',
    cta: 'Agregar al calendario',
    ics: 'Abre el archivo adjunto (.ics) para añadir esta sesión a tu calendario.',
    footer: `¡Nos vemos en vivo! — El equipo de ${SITE_NAME}`,
    disclaimer:
      'Todo el contenido es solo con fines educativos. Operar implica un riesgo significativo de pérdida.',
  },
  pt: {
    subject: (topic) => `🎓 Inscrição confirmada: ${topic}`,
    hello: (name) => `Olá ${name},`,
    intro:
      'Sua inscrição no próximo webinar educativo gratuito ao vivo está confirmada. Anexamos um convite de calendário para você não perder.',
    details: 'Detalhes da sessão',
    topicLabel: 'Tópico',
    whenLabel: 'Data e hora',
    durationLabel: 'Duração',
    hostLabel: 'Apresentador',
    joinLabel: 'Link de acesso',
    cta: 'Adicionar ao calendário',
    ics: 'Abra o arquivo anexado (.ics) para adicionar esta sessão ao seu calendário.',
    footer: `Vejo você ao vivo! — Equipe ${SITE_NAME}`,
    disclaimer:
      'Todo o conteúdo é apenas para fins educacionais. Trading envolve risco significativo de perda.',
  },
}

// HTML escape — protect against any unexpected punctuation in user-supplied
// or DB-supplied fields making it into the rendered email.
const esc = (s: string) =>
  s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')

const formatDateTime = (iso: string, locale: Locale): string => {
  try {
    const tag = locale === 'pt' ? 'pt-BR' : locale === 'es' ? 'es-ES' : 'en-US'
    return new Date(iso).toLocaleString(tag, {
      weekday: 'long',
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      timeZoneName: 'short',
    })
  } catch {
    return iso
  }
}

// ICS spec requires UTC formatted as YYYYMMDDTHHmmssZ
const toIcsDate = (d: Date): string =>
  d.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '')

const escIcs = (s: string): string =>
  s.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\n/g, '\\n')

const buildIcs = (params: {
  uid: string
  topic: string
  description: string
  start: Date
  end: Date
  url?: string | null
}): string => {
  const { uid, topic, description, start, end, url } = params
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    `PRODID:-//${SITE_NAME}//Webinar//EN`,
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'BEGIN:VEVENT',
    `UID:${uid}`,
    `DTSTAMP:${toIcsDate(new Date())}`,
    `DTSTART:${toIcsDate(start)}`,
    `DTEND:${toIcsDate(end)}`,
    `SUMMARY:${escIcs(topic)}`,
    `DESCRIPTION:${escIcs(description)}`,
    url ? `URL:${escIcs(url)}` : null,
    url ? `LOCATION:${escIcs(url)}` : null,
    'STATUS:CONFIRMED',
    'TRANSP:OPAQUE',
    'BEGIN:VALARM',
    'ACTION:DISPLAY',
    `DESCRIPTION:${escIcs(topic)}`,
    'TRIGGER:-PT15M',
    'END:VALARM',
    'END:VEVENT',
    'END:VCALENDAR',
  ].filter(Boolean) as string[]
  return lines.join('\r\n')
}

const buildHtml = (body: Body): string => {
  const c = COPY[body.locale]
  const when = formatDateTime(body.webinar.scheduledAt, body.locale)
  const join = body.webinar.joinUrl || `${SITE_URL}/webinars`

  return `<!doctype html>
<html lang="${body.locale}">
  <body style="margin:0;background:#ffffff;font-family:Arial,Helvetica,sans-serif;color:#0b0b0d;">
    <div style="max-width:560px;margin:0 auto;padding:32px 24px;">
      <h1 style="font-size:22px;margin:0 0 12px;color:#0b0b0d;">${esc(c.hello(body.name))}</h1>
      <p style="font-size:15px;line-height:1.55;color:#374151;margin:0 0 20px;">${esc(c.intro)}</p>

      <div style="border:1px solid #e5e7eb;border-radius:14px;padding:18px 20px;margin:18px 0;">
        <p style="font-size:11px;letter-spacing:.18em;text-transform:uppercase;color:#FFCD05;margin:0 0 12px;font-weight:700;">${esc(c.details)}</p>
        <table style="width:100%;font-size:14px;color:#111;border-collapse:collapse;">
          <tr><td style="padding:6px 0;color:#6b7280;width:120px;">${esc(c.topicLabel)}</td><td style="padding:6px 0;font-weight:600;">${esc(body.webinar.topic)}</td></tr>
          <tr><td style="padding:6px 0;color:#6b7280;">${esc(c.whenLabel)}</td><td style="padding:6px 0;font-weight:600;">${esc(when)}</td></tr>
          <tr><td style="padding:6px 0;color:#6b7280;">${esc(c.durationLabel)}</td><td style="padding:6px 0;font-weight:600;">${body.webinar.durationMinutes} min</td></tr>
          ${body.webinar.hostName ? `<tr><td style="padding:6px 0;color:#6b7280;">${esc(c.hostLabel)}</td><td style="padding:6px 0;font-weight:600;">${esc(body.webinar.hostName)}</td></tr>` : ''}
          <tr><td style="padding:6px 0;color:#6b7280;">${esc(c.joinLabel)}</td><td style="padding:6px 0;"><a href="${esc(join)}" style="color:#b48a00;font-weight:600;">${esc(join)}</a></td></tr>
        </table>
      </div>

      <div style="text-align:center;margin:24px 0;">
        <a href="${esc(join)}" style="display:inline-block;background:#FFCD05;color:#0b0b0d;text-decoration:none;font-weight:700;padding:13px 26px;border-radius:999px;font-size:15px;">${esc(c.cta)}</a>
      </div>
      <p style="font-size:12px;color:#6b7280;margin:0 0 20px;text-align:center;">${esc(c.ics)}</p>

      <p style="font-size:13px;color:#374151;margin:24px 0 8px;">${esc(c.footer)}</p>
      <p style="font-size:11px;color:#9ca3af;margin:24px 0 0;line-height:1.5;">${esc(c.disclaimer)}</p>
    </div>
  </body>
</html>`
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const parsed = BodySchema.safeParse(await req.json())
    if (!parsed.success) {
      return new Response(
        JSON.stringify({ error: parsed.error.flatten().fieldErrors }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      )
    }

    const body = parsed.data
    const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY')
    if (!RESEND_API_KEY) {
      console.error('RESEND_API_KEY not set — webinar confirmation skipped')
      // Return 200 so the client never sees a registration failure caused by
      // unconfigured email infra. The form is the source of truth, the email
      // is best-effort.
      return new Response(
        JSON.stringify({ success: false, skipped: 'email_not_configured' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      )
    }

    const start = new Date(body.webinar.scheduledAt)
    if (Number.isNaN(start.getTime())) {
      return new Response(
        JSON.stringify({ error: 'Invalid scheduledAt' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      )
    }
    const end = new Date(start.getTime() + body.webinar.durationMinutes * 60_000)

    const ics = buildIcs({
      uid: `${body.webinar.id ?? crypto.randomUUID()}@elitelivetradingroom.com`,
      topic: body.webinar.topic,
      description: `${body.webinar.topic}${body.webinar.hostName ? ` — ${body.webinar.hostName}` : ''} | ${SITE_URL}`,
      start,
      end,
      url: body.webinar.joinUrl,
    })

    const c = COPY[body.locale]
    const subject = c.subject(body.webinar.topic)
    const html = buildHtml(body)
    // Base64-encode the .ics file for the Resend attachment payload
    const icsB64 = btoa(unescape(encodeURIComponent(ics)))

    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: `${SITE_NAME} <onboarding@resend.dev>`,
        to: [body.email],
        subject,
        html,
        attachments: [
          {
            filename: 'webinar.ics',
            content: icsB64,
            content_type: 'text/calendar; charset=utf-8; method=PUBLISH',
          },
        ],
      }),
    })

    if (!res.ok) {
      const err = await res.text()
      console.error('Resend error:', err)
      return new Response(
        JSON.stringify({ error: 'Failed to send confirmation email' }),
        { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      )
    }

    return new Response(
      JSON.stringify({ success: true }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    )
  } catch (e) {
    console.error('send-webinar-confirmation error:', e)
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    )
  }
})
