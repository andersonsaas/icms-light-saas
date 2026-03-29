import Link from "next/link";

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-brand-950 via-brand-900 to-brand-800 text-white">
      {/* Navbar */}
      <nav className="max-w-7xl mx-auto px-6 py-5 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 bg-white/10 rounded-lg flex items-center justify-center">
            <span className="text-lg">⚡</span>
          </div>
          <span className="text-xl font-semibold tracking-tight">ICMS Light</span>
        </div>
        <div className="flex items-center gap-4">
          <Link href="/login" className="text-white/80 hover:text-white text-sm transition-colors">
            Entrar
          </Link>
          <Link
            href="/cadastro"
            className="bg-white text-brand-900 hover:bg-brand-50 px-4 py-2 rounded-lg text-sm font-medium transition-colors"
          >
            Cadastrar grátis
          </Link>
        </div>
      </nav>

      {/* Hero */}
      <main className="max-w-5xl mx-auto px-6 pt-20 pb-32 text-center">
        <div className="inline-flex items-center gap-2 bg-white/10 rounded-full px-4 py-1.5 text-sm mb-8">
          <span className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
          STF fixou prazo de 10 anos — janela histórica aberta
        </div>

        <h1 className="text-5xl md:text-6xl font-bold leading-tight mb-6">
          Restituição de ICMS
          <br />
          <span className="text-brand-300">na conta da Light</span>
          <br />
          em 3 cliques
        </h1>

        <p className="text-xl text-white/70 max-w-2xl mx-auto mb-10 leading-relaxed">
          Plataforma jurídica que extrai automaticamente os dados das faturas,
          calcula o ICMS cobrado indevidamente (TUSD + TUST + demanda) e gera
          a petição inicial pronta para protocolo.
        </p>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-20">
          <Link
            href="/cadastro"
            className="bg-white text-brand-900 hover:bg-brand-50 px-8 py-4 rounded-xl text-lg font-semibold transition-colors shadow-xl"
          >
            Começar agora — grátis
          </Link>
          <Link
            href="#como-funciona"
            className="text-white/80 hover:text-white px-8 py-4 rounded-xl text-lg border border-white/20 hover:border-white/40 transition-colors"
          >
            Como funciona →
          </Link>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-8 max-w-2xl mx-auto">
          {[
            { label: "Prazo retroativo", valor: "10 anos" },
            { label: "Base legal", valor: "Tema 986 STJ" },
            { label: "Taxa de sucesso", valor: "+85%" },
          ].map((stat) => (
            <div key={stat.label} className="text-center">
              <div className="text-3xl font-bold text-white mb-1">{stat.valor}</div>
              <div className="text-sm text-white/60">{stat.label}</div>
            </div>
          ))}
        </div>
      </main>

      {/* Como funciona */}
      <section
        id="como-funciona"
        className="bg-white py-20"
      >
        <div className="max-w-5xl mx-auto px-6">
          <h2 className="text-3xl font-bold text-gray-900 text-center mb-4">
            Como funciona
          </h2>
          <p className="text-gray-500 text-center mb-14 max-w-xl mx-auto">
            Três agentes de IA trabalham em sequência para automatizar 100% do
            processo técnico — deixando o advogado livre para o que importa.
          </p>

          <div className="grid md:grid-cols-3 gap-8">
            {[
              {
                numero: "01",
                agente: "Agente Extrator",
                titulo: "Upload das faturas",
                desc: "Envie os PDFs das contas de luz da Light. A IA lê e extrai automaticamente todos os componentes: TUSD, TUST, demanda, alíquota ICMS e valores cobrados.",
                cor: "bg-blue-50 text-blue-700",
              },
              {
                numero: "02",
                agente: "Agente Calculadora",
                titulo: "Cálculo + Selic",
                desc: "Identifica o ICMS cobrado indevidamente em cada fatura. Aplica a correção pela taxa Selic acumulada (API do Banco Central), gerando a memória de cálculo completa.",
                cor: "bg-green-50 text-green-700",
              },
              {
                numero: "03",
                agente: "Agente Jurídico",
                titulo: "Petição pronta",
                desc: "Gera a petição inicial completa em .docx — com qualificação das partes, fundamentação legal (Tema 986 STJ, Súmula 391), pedidos e valor da causa.",
                cor: "bg-purple-50 text-purple-700",
              },
            ].map((step) => (
              <div key={step.numero} className="card p-6">
                <div className="flex items-center gap-3 mb-4">
                  <span className="text-3xl font-black text-gray-200">{step.numero}</span>
                  <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${step.cor}`}>
                    {step.agente}
                  </span>
                </div>
                <h3 className="text-lg font-semibold text-gray-900 mb-2">{step.titulo}</h3>
                <p className="text-gray-500 text-sm leading-relaxed">{step.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA final */}
      <footer className="bg-brand-950 py-12 text-center text-white/40 text-sm">
        <p>© {new Date().getFullYear()} ICMS Light — Desenvolvido para escritórios de advocacia</p>
      </footer>
    </div>
  );
}
