import { Twitter } from "lucide-react";

const team = [
  { name: "Blake Morrow", role: "Co-Founder & CEO", handle: "@pipczar", initials: "BM" },
  { name: "Grega Horvat", role: "FX & Commodities Analyst", handle: "@GregaHorvatFX", initials: "GH" },
  { name: "Stelios Kontogoulas", role: "Co-Founder", handle: "@SteliosConto", initials: "SK" },
  { name: "Steve Voulgaridis", role: "Co-Founder & COO", handle: "@vulgi", initials: "SV" },
  { name: "Ryan Littlestone", role: "Managing Director", handle: "@forexflowlive", initials: "RL" },
  { name: "Dale Pinkert", role: "Trading Coach", handle: "@ForexStopHunter", initials: "DP" },
];

const TeamSection = () => (
  <section id="team" className="py-24">
    <div className="container">
      <div className="mx-auto mb-16 max-w-2xl text-center">
        <h2 className="font-heading text-3xl font-bold text-foreground md:text-4xl">
          Our <span className="text-gradient">Expert Team</span>
        </h2>
        <p className="mt-4 text-muted-foreground">
          Founded in 2016, our principal team of traders has extensive and wide-ranging experience.
        </p>
      </div>
      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {team.map((member) => (
          <div
            key={member.name}
            className="card-glass group rounded-xl p-6 text-center transition-all hover:glow-border"
          >
            <div className="mx-auto mb-4 flex h-20 w-20 items-center justify-center rounded-full bg-primary/10 text-primary font-heading text-2xl font-bold">
              {member.initials}
            </div>
            <h3 className="font-heading text-lg font-semibold text-foreground">
              {member.name}
            </h3>
            <p className="mt-1 text-sm text-muted-foreground">{member.role}</p>
            <a
              href={`https://twitter.com/${member.handle.slice(1)}`}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-3 inline-flex items-center gap-1.5 text-sm text-primary hover:text-primary/80"
            >
              <Twitter className="h-4 w-4" />
              {member.handle}
            </a>
          </div>
        ))}
      </div>
    </div>
  </section>
);

export default TeamSection;
