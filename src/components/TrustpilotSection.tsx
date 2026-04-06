import { Star } from "lucide-react";

const reviews = [
  { name: "Arnaldo Tsukamoto", date: "23 Março", title: "Ótima experiência com a corretora e…", text: "Ótima experiência e atendimento TOP pelo Gabriel Chiqueti." },
  { name: "Arnaldo Tsukamoto", date: "20 Março", title: "Corretora com pagamento e execução…", text: "Corretora com pagamento e execução rápida, gerente de contas Gabriel Chiqueti atenci…" },
  { name: "Marcio Pereira", date: "20 Março", title: "muito boa a experiencia atendimento…", text: "muito boa a experiencia atendimento primeira linha" },
  { name: "juarez pereira", date: "20 Março", title: "Rapidez e confiança", text: "Rapidez e confiança. A Corretora disperta confiança e rapidez nas soluções solicita…" },
  { name: "Nilson Vieira", date: "20 Março", title: "Rapidez e eficiência", text: "Rapidez e eficiência" },
];

const Stars = () => (
  <div className="flex gap-0.5">
    {[...Array(5)].map((_, i) => (
      <div key={i} className="flex h-5 w-5 items-center justify-center bg-emerald-500">
        <Star className="h-3 w-3 fill-white text-white" />
      </div>
    ))}
  </div>
);

const TrustpilotSection = () => {
  return (
    <section className="bg-background py-16">
      <div className="container">
        <h2 className="mb-10 text-center font-heading text-3xl font-bold text-foreground">
          O que dizem nossos clientes
        </h2>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          {reviews.map((r, i) => (
            <div key={i} className="rounded-lg border border-border/50 bg-card p-4 shadow-lg shadow-black/20 transition-all hover:border-primary/30 hover:shadow-primary/10 hover:shadow-xl">
              <Stars />
              <h3 className="mt-3 text-sm font-semibold text-foreground line-clamp-1">{r.title}</h3>
              <p className="mt-1 text-xs text-muted-foreground line-clamp-2">{r.text}</p>
              <p className="mt-3 text-xs text-muted-foreground">
                <span className="font-medium text-foreground">{r.name}</span>, {r.date}
              </p>
            </div>
          ))}
        </div>

        <div className="mt-8 text-center">
          <p className="text-sm text-muted-foreground">
            Pontuação <span className="font-semibold text-foreground">4.7 / 5</span> | baseado em{" "}
            <a href="https://www.trustpilot.com" target="_blank" rel="noopener noreferrer" className="font-medium text-foreground underline">
              1.142 avaliações
            </a>
            . Nossas avaliações com 4 & 5 estrelas.
          </p>
          <div className="mt-2 flex items-center justify-center gap-1.5">
            <Star className="h-4 w-4 fill-emerald-500 text-emerald-500" />
            <span className="text-sm font-semibold text-foreground">Trustpilot</span>
          </div>
        </div>
      </div>
    </section>
  );
};

export default TrustpilotSection;
