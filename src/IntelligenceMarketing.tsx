import { Check, Minus, Sparkles } from "lucide-react";
import { plans } from "./domain.mjs";

const features = [
  ["Gestão financeira", false],
  ["Clientes e fornecedores", false],
  ["PWA", false],
  ["Alertas financeiros", false],
  ["Consultas básicas pelo assistente", false],
  ["Análises financeiras inteligentes", true],
  ["Cadastros pelo chat", true],
  ["Parcelamentos pelo chat", true],
  ["Importação pelo chat", true],
  ["Automações e lembretes avançados", true],
  ["Relatórios inteligentes", true],
] as const;

export function IntelligenceShowcase() {
  return (
    <section
      className="intelligence-showcase"
      aria-labelledby="intelligence-title"
    >
      <div>
        <span className="eyebrow">
          <Sparkles size={17} aria-hidden="true" /> MD FLUX INTELLIGENCE
        </span>
        <h2 id="intelligence-title">Conheça o MD Flux Intelligence</h2>
        <p>
          Seu assistente trabalha com você. Pergunte, cadastre, consulte e
          automatize.
        </p>
        <a href="#comparar-planos" className="secondary">
          Comparar os planos
        </a>
      </div>
      <figure>
        <figcaption>Conversa demonstrativa · valores ilustrativos</figcaption>
        <p>
          <strong>Você</strong>Quanto tenho para receber este mês?
        </p>
        <p>
          <strong>Assistente</strong>Você tem R$ 8.450 a receber. Desse valor,
          R$ 2.300 estão atrasados. Deseja preparar as cobranças?
        </p>
        <p>
          <strong>Você</strong>Sim, prepare as cobranças.
        </p>
        <p>
          <strong>Assistente</strong>Preparei as mensagens para os clientes em
          atraso. Você pode revisá-las e enviá-las pelo WhatsApp.
        </p>
      </figure>
    </section>
  );
}

export function PlanComparison({ choose }: { choose: (plan: string) => void }) {
  return (
    <div id="comparar-planos" className="plan-comparison">
      <h2 id="compare-title">
        Compare os planos e escolha o ideal para sua empresa
      </h2>
      <p>
        Com o Profissional, use o MD Flux Intelligence para analisar as finanças
        e executar tarefas pelo chat.
      </p>
      <div
        className="comparison-scroll"
        role="region"
        tabIndex={0}
        aria-labelledby="compare-title"
      >
        <table aria-labelledby="compare-title">
          <thead>
            <tr>
              <th scope="col">Funcionalidade</th>
              {Object.entries(plans).map(([key, plan]) => (
                <th
                  className={key === "profissional" ? "recommended-plan" : ""}
                  key={key}
                  scope="col"
                >
                  {plan.name}
                  {key === "profissional" && <small>Mais recomendado</small>}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {features.map(([label, advanced]) => (
              <tr key={label} className={advanced ? "operational-feature" : ""}>
                <th scope="row">{label}</th>
                {Object.keys(plans).map((key) => {
                  const included = !advanced || key !== "essencial";
                  return (
                    <td
                      key={key}
                      className={
                        key === "profissional" ? "recommended-plan" : ""
                      }
                    >
                      {included ? (
                        <Check
                          className="included"
                          size={19}
                          role="img"
                          aria-label="Incluído"
                        />
                      ) : (
                        <Minus size={17} role="img" aria-label="Indisponível" />
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr>
              <th scope="row">Contratação</th>
              {Object.entries(plans).map(([key, plan]) => (
                <td
                  className={key === "profissional" ? "recommended-plan" : ""}
                  key={key}
                >
                  <button
                    className={key === "profissional" ? "primary" : "secondary"}
                    onClick={() => choose(key)}
                    aria-label={"Escolher " + plan.name}
                  >
                    Escolher
                  </button>
                </td>
              ))}
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}
