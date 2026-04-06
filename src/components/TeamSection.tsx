import luisArias from "@/assets/luis-arias.png";
import ScrollReveal from "@/components/ScrollReveal";

const TeamSection = () => (
  <section id="team" className="py-24">
    <div className="container">
      <ScrollReveal>
        <div className="mx-auto mb-16 max-w-2xl text-center">
          <h2 className="font-heading text-3xl font-bold text-foreground md:text-4xl">
            Meet Our <span className="text-gradient">Expert Analyst</span>
          </h2>
        </div>
      </ScrollReveal>
      <ScrollReveal delay={150}>
        <div className="mx-auto max-w-sm">
          <div className="card-glass group rounded-xl p-8 text-center transition-all hover:glow-border">
            <img
              src={luisArias}
              alt="Luis Arias"
              className="mx-auto mb-6 h-32 w-32 rounded-full object-cover border-2 border-primary/30"
            />
            <h3 className="font-heading text-xl font-semibold text-foreground">
              Luis Arias
            </h3>
            <p className="mt-2 text-sm text-muted-foreground">
              Regional Sales Manager &amp; Market Analyst
            </p>
          </div>
        </div>
      </ScrollReveal>
    </div>
  </section>
);

export default TeamSection;
