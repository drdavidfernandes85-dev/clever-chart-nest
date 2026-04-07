
## Phase 1: Quick Wins
1. **Loading animations** — Add skeleton loaders and page transition animations (fade-in on route change)
2. **SEO & meta tags** — Add proper title, meta descriptions, Open Graph tags, and JSON-LD structured data

## Phase 2: User Profiles & Settings
3. **Profile page** — Create `/profile` page with avatar upload (to existing `chat-attachments` bucket), display name editing, and account settings
4. **Notification preferences** — Toggle settings for browser notifications, sound effects

## Phase 3: Landing Page Polish
5. **Animated counters** — Numbers in stats row animate up when scrolled into view
6. **Testimonial carousel** — Auto-rotating testimonials in the TrustpilotSection
7. **Smooth scroll reveal** — Staggered reveal animations on each section as user scrolls

## Phase 4: Chatroom Upgrades (from existing plan)
8. **Message grouping** — Collapse consecutive messages from same user
9. **Date separators** — "Today", "Yesterday", date headers
10. **Typing indicators** — "User is typing..." with animated dots
11. **Scroll-to-bottom button** — Floating button with new message count
12. **Mobile sidebar toggle** — Hamburger menu for channel list on mobile

## Phase 5: Dashboard Enhancements
13. **Economic calendar widget** — Display upcoming economic events using the existing edge function
14. **Live forex tickers** — Scrolling ticker bar using existing edge function
15. **Trading journal** — Simple table for users to log trades (requires new DB table)

## Phase 6: Advanced (Optional)
16. **Dark/light mode toggle** — Theme switcher (requires light theme CSS variables)
17. **PWA support** — Make app installable with manifest + service worker
