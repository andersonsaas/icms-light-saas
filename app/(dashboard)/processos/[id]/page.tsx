"use client";

import { useEffect, useState, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import { useParams } from "next/navigation";
import { formatarMoeda, formatarMes } from "@/lib/agents/calculadora-icms";
import Link from "next/link";
import type { Processo, ResultadoCalculo } from "@/types";

type Step = "upload" | "extraindo" | "calculando" | "gerando" | "concluido";

export default function ProcessoPage() {
  const { id } = useParams<{ id: string }>();
  const supabase = createClient();

  const [processo, setProcesso] = useState<Processo | null>(null);
  const [faturas, setFaturas] = useState<any[]>([]);
  const [resultado, setResultado] = useState<ResultadoCalculo | null>(null);
  const [step, setStep] = useState<Step>("upload");
  const [arquivos, setArquivos] = useState<File[]>([]);
  const [log, setLog] = useState<string[]>([]);
  const [carregando, setCarregando] = useState(false);

  const addLog = (msg: string) => setLog((l) => [...l, msg]);

  const carregarProcesso = useCallback(async () => {
    const { data } = await supabase
      .from("processos")
      .select("*, cliente:clientes(*)")
      .eq("id", id)
      .single();

    if (data) {
      setProcesso(data);
      if (data.resultado_json) setResultado(data.resultado_json);
      if (data.status === "peticao_gerada" || data.status === "concluido") setStep("concluido");
      else if (data.status === "calculado") setStep("gerando");
      else if (data.status === "dados_extraidos") setStep("calculando");
      else if (data.status === "faturas_carregadas") setStep("extraindo");
    }

    const { data: fat } = await supabase
      .from("faturas")
      .select("*")
      .eq("processo_id", id)
      .order("mes_referencia");
    setFaturas(fat ?? []);
  }, [id, supabase]);

  useEffect(() => { carregarProcesso(); }, [carregarProcesso]);

  // ── Passo 1: Upload + Extração ────────────────────────────────────────────

  async function handleUploadExtrair() {
    if (!arquivos.length) return;
    setCarregando(true);
    setLog([]);
    addLog(`📤 Processando ${arquivos.length} fatura(s) uma a uma...`);

    let sucessos = 0;

    for (let i = 0; i < arquivos.length; i++) {
      const arquivo = arquivos[i];
      addLog(`⏳ [${i + 1}/${arquivos.length}] Extraindo ${arquivo.name}...`);

      const fd = new FormData();
      fd.append("faturas", arquivo);

      try {
        const res = await fetch(`/api/processos/${id}/extrair`, { method: "POST", body: fd });
        const data = await res.json();

        const r = data.resultados?.[0];
        if (r?.sucesso) {
          addLog(`✅ ${arquivo.name} → mês ${r.fatura?.mes_referencia}`);
          sucessos++;
        } else {
          addLog(`❌ ${arquivo.name}: ${r?.erro ?? "erro desconhecido"}`);
        }
      } catch {
        addLog(`❌ ${arquivo.name}: falha na requisição`);
      }
    }

    addLog(`✔ ${sucessos}/${arquivos.length} faturas extraídas com sucesso.`);
    await carregarProcesso();
    setStep("calculando");
    setCarregando(false);
  }

  // ── Passo 2: Calcular ─────────────────────────────────────────────────────

  async function handleCalcular() {
    setCarregando(true);
    addLog("🧮 Calculando ICMS indevido + Selic...");

    const res = await fetch(`/api/processos/${id}/calcular`, { method: "POST" });
    const data = await res.json();

    if (!res.ok) { addLog(`❌ ${data.erro}`); setCarregando(false); return; }

    setResultado(data);
    addLog(`💰 Total indevido: ${formatarMoeda(data.total_icms_indevido)}`);
    addLog(`💰 Corrigido Selic: ${formatarMoeda(data.total_corrigido_selic)}`);
    await carregarProcesso();
    setStep("gerando");
    setCarregando(false);
  }

  // ── Passo 3: Gerar petição ────────────────────────────────────────────────

  async function handleGerarPeticao() {
    setCarregando(true);
    addLog("📝 Gerando petição inicial...");

    const res = await fetch(`/api/processos/${id}/peticao`, { method: "POST" });

    if (!res.ok) {
      const data = await res.json();
      addLog(`❌ ${data.erro}`);
      setCarregando(false);
      return;
    }

    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `peticao_icms_${id.substring(0, 8)}.docx`;
    a.click();
    URL.revokeObjectURL(url);

    addLog("✅ Petição gerada e baixada com sucesso!");
    await carregarProcesso();
    setStep("concluido");
    setCarregando(false);
  }

  if (!processo) return <div className="p-8 text-gray-400">Carregando...</div>;

  const cliente = (processo as any).cliente;

  return (
    <div className="p-8">
      {/* Header */}
      <div className="flex items-center gap-3 mb-2">
        <Link href="/dashboard" className="text-gray-400 hover:text-gray-600 text-sm">← Dashboard</Link>
      </div>
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{cliente?.nome}</h1>
          <p className="text-gray-500 text-sm">
            UC {cliente?.numero_instalacao} · {cliente?.classe_consumidor} ·{" "}
            CPF/CNPJ {cliente?.cpf_cnpj}
          </p>
        </div>
        <StatusBadge status={processo.status} />
      </div>

      <div className="grid grid-cols-3 gap-6">
        {/* Coluna principal */}
        <div className="col-span-2 space-y-5">

          {/* Passo 1 — Upload */}
          <div className={`card p-6 ${step !== "upload" && step !== "extraindo" ? "opacity-60" : ""}`}>
            <h2 className="font-semibold text-gray-900 mb-1 flex items-center gap-2">
              <span className="w-6 h-6 rounded-full bg-brand-100 text-brand-700 text-xs flex items-center justify-center font-bold">1</span>
              Upload das faturas da Light (PDF)
            </h2>
            <p className="text-sm text-gray-500 mb-4">Selecione todas as contas de luz disponíveis (até 10 anos)</p>

            <input
              type="file"
              accept=".pdf"
              multiple
              onChange={(e) => setArquivos(Array.from(e.target.files ?? []))}
              className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-medium file:bg-brand-50 file:text-brand-700 hover:file:bg-brand-100 mb-4"
            />

            {arquivos.length > 0 && (
              <p className="text-sm text-gray-600 mb-4">{arquivos.length} arquivo(s) selecionado(s)</p>
            )}

            <button
              onClick={handleUploadExtrair}
              disabled={carregando || !arquivos.length}
              className="btn-primary"
            >
              {carregando && step === "upload" ? "Extraindo..." : "Enviar e extrair dados"}
            </button>
          </div>

          {/* Passo 2 — Calcular */}
          {(step === "calculando" || step === "gerando" || step === "concluido") && (
            <div className="card p-6">
              <h2 className="font-semibold text-gray-900 mb-1 flex items-center gap-2">
                <span className="w-6 h-6 rounded-full bg-brand-100 text-brand-700 text-xs flex items-center justify-center font-bold">2</span>
                Calcular ICMS indevido + Selic
              </h2>
              <p className="text-sm text-gray-500 mb-4">
                {faturas.length} fatura(s) extraída(s). Clique para calcular o total indevido com correção pelo Banco Central.
              </p>
              <button onClick={handleCalcular} disabled={carregando || step !== "calculando"} className="btn-primary">
                {carregando && step === "calculando" ? "Calculando..." : "Calcular agora"}
              </button>
            </div>
          )}

          {/* Resultado do cálculo */}
          {resultado && (
            <div className="card p-6 border-green-200 bg-green-50">
              <h3 className="font-semibold text-green-800 mb-4">Resultado do cálculo</h3>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-green-600 font-medium">Período</p>
                  <p className="text-green-900">{formatarMes(resultado.periodo_inicio)} a {formatarMes(resultado.periodo_fim)} ({resultado.total_meses} meses)</p>
                </div>
                <div>
                  <p className="text-green-600 font-medium">Alíquota média ICMS</p>
                  <p className="text-green-900">{resultado.aliquota_icms_media}%</p>
                </div>
                <div>
                  <p className="text-green-600 font-medium">TUSD + TUST</p>
                  <p className="text-green-900">{formatarMoeda(resultado.total_tusd_tust)}</p>
                </div>
                <div>
                  <p className="text-green-600 font-medium">ICMS indevido bruto</p>
                  <p className="text-green-900 font-semibold">{formatarMoeda(resultado.total_icms_indevido)}</p>
                </div>
                <div>
                  <p className="text-green-600 font-medium">Selic acumulada</p>
                  <p className="text-green-900">{resultado.taxa_selic_periodo}%</p>
                </div>
                <div>
                  <p className="text-green-600 font-medium">Total corrigido (Selic)</p>
                  <p className="text-green-900 text-xl font-bold">{formatarMoeda(resultado.total_corrigido_selic)}</p>
                </div>
              </div>
            </div>
          )}

          {/* Passo 3 — Petição */}
          {(step === "gerando" || step === "concluido") && (
            <div className="card p-6">
              <h2 className="font-semibold text-gray-900 mb-1 flex items-center gap-2">
                <span className="w-6 h-6 rounded-full bg-brand-100 text-brand-700 text-xs flex items-center justify-center font-bold">3</span>
                Gerar petição inicial (.docx)
              </h2>
              <p className="text-sm text-gray-500 mb-4">
                Petição para Ação de Repetição de Indébito contra o Estado do RJ, com fundamentação em Tema 986 STJ e Súmula 391 STJ.
              </p>
              <button onClick={handleGerarPeticao} disabled={carregando} className="btn-primary">
                {carregando ? "Gerando..." : "⬇ Gerar e baixar petição"}
              </button>
            </div>
          )}
        </div>

        {/* Coluna lateral — Log */}
        <div>
          <div className="card p-5 sticky top-6">
            <h3 className="font-semibold text-gray-900 mb-3 text-sm">Log de execução</h3>
            <div className="space-y-1.5 max-h-96 overflow-y-auto">
              {!log.length && (
                <p className="text-xs text-gray-400">Nenhuma ação executada ainda.</p>
              )}
              {log.map((linha, i) => (
                <p key={i} className="text-xs text-gray-600 font-mono">{linha}</p>
              ))}
            </div>
          </div>

          {/* Faturas extraídas */}
          {faturas.length > 0 && (
            <div className="card p-5 mt-4">
              <h3 className="font-semibold text-gray-900 mb-3 text-sm">Faturas ({faturas.length})</h3>
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {faturas.map((f) => (
                  <div key={f.id} className="flex items-center justify-between text-xs">
                    <span className="text-gray-600">{formatarMes(f.mes_referencia)}</span>
                    <span className={`font-medium ${f.icms_valor_indevido > 0 ? "text-red-600" : "text-gray-400"}`}>
                      {f.icms_valor_indevido ? formatarMoeda(f.icms_valor_indevido) : "—"}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; cor: string }> = {
    pendente: { label: "Pendente", cor: "bg-gray-100 text-gray-600" },
    faturas_carregadas: { label: "Faturas carregadas", cor: "bg-blue-100 text-blue-700" },
    dados_extraidos: { label: "Dados extraídos", cor: "bg-yellow-100 text-yellow-700" },
    calculado: { label: "Calculado", cor: "bg-green-100 text-green-700" },
    peticao_gerada: { label: "Petição gerada ✓", cor: "bg-purple-100 text-purple-700" },
    concluido: { label: "Concluído", cor: "bg-emerald-100 text-emerald-700" },
  };
  const s = map[status] ?? { label: status, cor: "bg-gray-100 text-gray-600" };
  return <span className={`badge-status ${s.cor}`}>{s.label}</span>;
}
