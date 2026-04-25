/**
 * Sitewide background — clean deep void, NO particles, NO ambient fiery glow.
 * Sits below all content (-z-10), fixed to viewport.
 */
const CyberpunkBackground = () => {
  return (
    <div
      aria-hidden
      className="pointer-events-none fixed inset-0 -z-10"
      style={{ backgroundColor: "#050505" }}
    />
  );
};

export default CyberpunkBackground;
