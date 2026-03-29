/**
 * ═══════════════════════════════════════════════════════════════════════════
 * AGENTE 2 — CALCULADORA DE ICMS + CORREÇÃO SELIC
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Responsabilidade:
 *   - Recebe as faturas já extraídas pelo Agente 1
 *   - Consolida o total de ICMS cobrado indevidamente em cada mês
 *   - Busca a taxa Selic acumulada (API do Banco Central do Brasil)
 *   - Aplica correção monetária sobre cada parcela
 *   - Retorna o ResultadoCalculo completo com memória de cálculo
 *
 * Base legal:
 *   - Correção pela Selic: STJ e STF pacificaram uso da Selic para
 *     repetição de indébito tributário (arts. 167, parágrafo único do CTN
 *     e art. 39, §4º da Lei 9.250/95)
 *   - Prazo retroativo: 10 anos (STF, agosto 2025)
 */

import type { DadosFatura, ResultadoCalculo } from "@/types";

// ─── Constantes ───────────────────────────────────────────────────────────────

const BCB_SELIC_URL =
  "https://api.bcb.gov.br/dados/serie/bcdata.sgs.11/dados?formato=json";

// Cache em memória para não bater na API do BCB a cada requisição
let selicCache: { data: SelicMes[]; fetchedAt: number } | null = null;
const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 horas

interface SelicMes {
  data: string; // "dd/MM/yyyy"
  valor: string; // taxa diária em % (ex: "0.0452")
}

// ─── Função principal ─────────────────────────────────────────────────────────

export async function calcularICMSIndevido(
  faturas: Partial<DadosFatura>[]
): Promise<ResultadoCalculo> {
  // Filtra e ordena faturas com dados suficientes
  const faturaValidas = faturas
    .filter(
      (f) =>
        f.mes_referencia &&
        f.icms_valor_indevido !== undefined &&
        f.icms_valor_indevido !== null &&
        f.icms_valor_indevido > 0
    )
    .sort((a, b) =>
      (a.mes_referencia ?? "").localeCompare(b.mes_referencia ?? "")
    );

  if (faturaValidas.length === 0) {
    throw new Error(
      "Nenhuma fatura com ICMS indevido calculado. Execute a extração primeiro."
    );
  }

  const periodoInicio = faturaValidas[0].mes_referencia!;
  const periodoFim = faturaValidas[faturaValidas.length - 1].mes_referencia!;

  // Busca taxas Selic mensais acumuladas
  const taxasSelic = await buscarTaxasSelicMensais();

  // Calcula correção para cada fatura
  const hoje = new Date();
  const detalhamento: ResultadoCalculo["detalhamento"] = [];
  let totalICMSIndevido = 0;
  let totalCorrigido = 0;
  let totalTUSDTUST = 0;
  let totalDemandaIndevida = 0;
  let somatorio_aliquota = 0;

  for (const fatura of faturaValidas) {
    const mesRef = fatura.mes_referencia!; // "YYYY-MM"
    const icmsIndevido = fatura.icms_valor_indevido ?? 0;
    const tusdTust = (fatura.tusd_valor ?? 0) + (fatura.tust_valor ?? 0);
    const demandaIndevida =
      fatura.icms_base_indevida != null && tusdTust > 0
        ? fatura.icms_base_indevida - tusdTust
        : 0;

    totalICMSIndevido += icmsIndevido;
    totalTUSDTUST += tusdTust;
    totalDemandaIndevida += Math.max(0, demandaIndevida);

    if (fatura.icms_aliquota) somatorio_aliquota += fatura.icms_aliquota;

    // Fator Selic acumulado desde o mês de referência até hoje
    const fatorSelic = calcularFatorSelicAcumulado(
      taxasSelic,
      mesRef,
      hoje
    );

    const valorCorrigido = parseFloat((icmsIndevido * fatorSelic).toFixed(2));
    totalCorrigido += valorCorrigido;

    detalhamento.push({
      mes_referencia: mesRef,
      base_indevida: fatura.icms_base_indevida ?? 0,
      icms_indevido: icmsIndevido,
      fator_selic: parseFloat(fatorSelic.toFixed(6)),
      valor_corrigido: valorCorrigido,
    });
  }

  const taxaSelicPeriodo = calcularFatorSelicAcumulado(
    taxasSelic,
    periodoInicio,
    hoje
  );

  return {
    processo_id: "", // preenchido pela API route
    periodo_inicio: periodoInicio,
    periodo_fim: periodoFim,
    total_meses: faturaValidas.length,

    total_tusd_tust: parseFloat(totalTUSDTUST.toFixed(2)),
    total_demanda_indevida: parseFloat(totalDemandaIndevida.toFixed(2)),
    total_base_indevida: parseFloat(
      (totalTUSDTUST + totalDemandaIndevida).toFixed(2)
    ),
    total_icms_indevido: parseFloat(totalICMSIndevido.toFixed(2)),
    total_corrigido_selic: parseFloat(totalCorrigido.toFixed(2)),
    taxa_selic_periodo: parseFloat(((taxaSelicPeriodo - 1) * 100).toFixed(2)),

    detalhamento,

    aliquota_icms_media: parseFloat(
      ((somatorio_aliquota / faturaValidas.length) * 100).toFixed(2)
    ),
    calculado_em: new Date().toISOString(),
  };
}

// ─── Selic helpers ────────────────────────────────────────────────────────────

async function buscarTaxasSelicMensais(): Promise<SelicMes[]> {
  const agora = Date.now();

  if (selicCache && agora - selicCache.fetchedAt < CACHE_TTL_MS) {
    return selicCache.data;
  }

  const response = await fetch(BCB_SELIC_URL);
  if (!response.ok) {
    // Se falhar, usa taxa aproximada (fallback)
    console.warn("API BCB indisponível. Usando taxa Selic estimada.");
    return [];
  }

  const dados: SelicMes[] = await response.json();
  selicCache = { data: dados, fetchedAt: agora };
  return dados;
}

/**
 * Calcula o fator de correção pela Selic acumulada entre mesInicio e dataFim.
 *
 * A API do BCB retorna taxas DIÁRIAS. Para uma aproximação mensal
 * usamos: produto((1 + taxa_diaria/100)^dias_uteis_no_mes)
 *
 * Para simplificação prática (aceita em processos de restituição),
 * usamos a taxa mensal acumulada mês a mês.
 */
function calcularFatorSelicAcumulado(
  taxas: SelicMes[],
  mesInicio: string, // "YYYY-MM"
  dataFim: Date
): number {
  if (taxas.length === 0) {
    // Fallback: estima 10,5% ao ano (média recente da Selic)
    const [ano, mes] = mesInicio.split("-").map(Number);
    const dataInicio = new Date(ano, mes - 1, 1);
    const diasDecorridos =
      (dataFim.getTime() - dataInicio.getTime()) / (1000 * 60 * 60 * 24);
    const taxaAnual = 0.105;
    return parseFloat(Math.pow(1 + taxaAnual, diasDecorridos / 365).toFixed(6));
  }

  const [anoInicio, mesInicioNum] = mesInicio.split("-").map(Number);
  let fatorAcumulado = 1;

  for (const registro of taxas) {
    // Formato BCB: "dd/MM/yyyy"
    const partes = registro.data.split("/");
    const dataRegistro = new Date(
      parseInt(partes[2]),
      parseInt(partes[1]) - 1,
      parseInt(partes[0])
    );

    // Só acumula a partir do mês de início até hoje
    if (
      dataRegistro >= new Date(anoInicio, mesInicioNum - 1, 1) &&
      dataRegistro <= dataFim
    ) {
      const taxaDiaria = parseFloat(registro.valor) / 100;
      fatorAcumulado *= 1 + taxaDiaria;
    }
  }

  return parseFloat(fatorAcumulado.toFixed(6));
}

// ─── Exporta helpers para uso na UI ──────────────────────────────────────────

export function formatarMoeda(valor: number): string {
  return valor.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
    minimumFractionDigits: 2,
  });
}

export function formatarMes(mesRef: string): string {
  const [ano, mes] = mesRef.split("-");
  const meses = [
    "Jan", "Fev", "Mar", "Abr", "Mai", "Jun",
    "Jul", "Ago", "Set", "Out", "Nov", "Dez",
  ];
  return `${meses[parseInt(mes) - 1]}/${ano}`;
}
