import { createClient } from "@/lib/supabase/server";
import Link from "next/link";
import { formatarMoeda } from "@/lib/agents/calculadora-icms";

export default async function DashboardPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const [{ data: processos }, { count: totalClientes }] = await Promise.all([
    supabase
      .from("processos")
      .select("id, status, valor_total_indevido, valor_corrigido_selic, created_at, cliente:clientes(nome)")
      .eq("advogado_id", user!.id)
      .order("created_at", { ascending: false })
      .limit(5),
    supabase
      .from("clientes")
      .select("id", { count: "exact" })
      .eq("advogado_id", user!.id),
  ]);

  const totalProcessos = processos?.length ?? 0;
  const valorTotal = processos?.reduce((sum, p) => sum + (p.valor_corrigido_selic ?? 0), 0) ?? 0;
  const concluidos = processos?.filter((p) => p.status === "peticao_gerada" || p.status === "concluido").length ?? 0;

  const statusLabel: Record<string, { label: string; cor: string }> = {
    pendente: { label: "Pendente", cor: "bg-gray-100 text-gray-600" },
    faturas_carregadas: { label: "Faturas", cor: "bg-blue-100 text-blue-700" },
    dados_extraidos: { label: "Extraído", cor: "bg-yellow-100 text-yellow-700" },
    calculado: { label: "Calculado", cor: "bg-green-100 text-green-700" },
    peticao_gerada: { label: "Petição ✓", cor: "bg-purple-100 text-purple-700" },
    concluido: { label: "Concluído", cor: "bg-emerald-100 text-emerald-700" },
  };

  return (
    <div className="p-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
          <p className="text-gray-500 text-sm mt-0.5">Visão geral dos processos de restituição de ICMS</p>
        </div>
        <Link href="/clientes/novo" className="btn-primary">
          + Novo cliente
        </Link>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-5 mb-8">
        {[
          { label: "Total clientes", valor: totalClientes ?? 0, icon: "👤", cor: "text-brand-700" },
          { label: "Processos ativos", valor: totalProcessos, icon: "📁", cor: "text-blue-700" },
          { label: "Valor total (corrigido)", valor: formatarMoeda(valorTotal), icon: "💰", cor: "text-green-700" },
          { label: "Petições geradas", valor: concluidos, icon: "📄", cor: "text-purple-700" },
        ].map((stat) => (
          <div key={stat.label} className="card p-5">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xl">{stat.icon}</span>
              <span className={`text-2xl font-bold ${stat.cor}`}>{stat.valor}</span>
            </div>
            <p className="text-sm text-gray-500">{stat.label}</p>
          </div>
        ))}
      </div>

      {/* Processos recentes */}
      <div className="card">
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
          <h2 className="font-semibold text-gray-900">Processos recentes</h2>
          <Link href="/processos" className="text-sm text-brand-700 hover:underline">Ver todos →</Link>
        </div>
        <div className="divide-y divide-gray-50">
          {!processos?.length && (
            <div className="px-6 py-12 text-center text-gray-400 text-sm">
              Nenhum processo ainda.{" "}
              <Link href="/clientes/novo" className="text-brand-700 hover:underline">Cadastre o primeiro cliente.</Link>
            </div>
          )}
          {processos?.map((p) => {
            const status = statusLabel[p.status] ?? { label: p.status, cor: "bg-gray-100 text-gray-600" };
            return (
              <Link
                key={p.id}
                href={`/processos/${p.id}`}
                className="flex items-center justify-between px-6 py-4 hover:bg-gray-50 transition-colors"
              >
                <div className="flex items-center gap-4">
                  <div className="w-9 h-9 bg-brand-100 text-brand-700 rounded-full flex items-center justify-center text-sm font-bold">
                    {(p.cliente as any)?.nome?.charAt(0) ?? "?"}
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-900">{(p.cliente as any)?.nome}</p>
                    <p className="text-xs text-gray-400">
                      {new Date(p.created_at).toLocaleDateString("pt-BR")}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  {p.valor_corrigido_selic && (
                    <span className="text-sm font-semibold text-green-700">
                      {formatarMoeda(p.valor_corrigido_selic)}
                    </span>
                  )}
                  <span className={`badge-status ${status.cor}`}>{status.label}</span>
                </div>
              </Link>
            );
          })}
        </div>
      </div>
    </div>
  );
}
