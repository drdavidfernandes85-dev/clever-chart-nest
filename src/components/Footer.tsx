import infinoxLogo from "@/assets/infinox-logo-white.png";

const Footer = () => (
  <footer className="border-t border-border/40 py-16">
    <div className="container">
      <div className="grid gap-10 md:grid-cols-4">
        <div>
          <a href="#home" className="flex items-center gap-3">
            <img src={infinoxLogo} alt="INFINOX" className="h-6" />
          </a>
          <span className="mt-3 inline-block font-heading text-sm font-semibold text-foreground tracking-tight">
            Elite <span className="text-primary">Live Trading Room</span>
          </span>
          <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
            The Elite Live Trading Room for the INFINOX LATAM community.
          </p>
        </div>
        {[
          {
            title: "Platform",
            links: ["Features", "Mobile App", "Pricing", "Webinars"],
          },
          {
            title: "Company",
            links: ["About", "Team", "Blog", "Careers"],
          },
          {
            title: "Support",
            links: ["Contact Us", "FAQ", "Newsletter", "Privacy Policy"],
          },
        ].map((col) => (
          <div key={col.title}>
            <h4 className="mb-4 font-heading text-sm font-semibold text-foreground">{col.title}</h4>
            <ul className="space-y-2.5">
              {col.links.map((link) => (
                <li key={link}>
                  <a href="#" className="text-sm text-muted-foreground hover:text-primary transition-colors">
                    {link}
                  </a>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
      <div className="mt-12 border-t border-border/40 pt-8 text-center text-sm text-muted-foreground">
        © {new Date().getFullYear()} Elite Live Trading Room — Powered by INFINOX. All rights reserved.
      </div>
    </div>
  </footer>
);

export default Footer;
