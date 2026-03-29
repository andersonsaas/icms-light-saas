/**
 * ═══════════════════════════════════════════════════════════════════════════
 * AGENTE 1 — EXTRATOR DE PDF
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Responsabilidade:
 *   - Recebe o texto bruto de uma fatura da Light (Rio de Janeiro)
 *   - Usa Claude para identificar e extrair todos os componentes tarifários
 *   - Retorna dados estruturados prontos para o Agente 2 (calculadora)
 *
 * Base legal considerada:
 *   - TUSD e TUST: Tema 986 STJ (incide ICMS → cobrança deve ser identificada)
 *   - Demanda: Súmula 391 STJ (só sobre potência efetivamente utilizada)
 *   - Prazo: 10 anos (STF, agosto 2025)
 */

import Anthropic from "@anthropic-ai/sdk";
import type { AgentExtracao, DadosFatura } from "@/types";

const client = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

// ─── Prompt de sistema do agente ──────────────────────────────────────────────

const SYSTEM_PROMPT = `Você é um especialista em faturas de energia elétrica da Light S.A. (distribuidora do Rio de Janeiro).
Sua tarefa é extrair dados estruturados de uma fatura da Light com máxima precisão.

ESTRUTURA TÍPICA DE UMA FATURA LIGHT:
- Cabeçalho: número da instalação (UC), endereço, mês de referência, vencimento
- Tabela de consumo: kWh consumidos, demanda contratada vs faturada
- Tabela de valores:
  * Energia Elétrica (kWh × tarifa)
  * TUSD – Tarifa de Uso do Sistema de Distribuição (em R$ ou kWh × tarifa)
  * TUST – Tarifa de Uso do Sistema de Transmissão (pode estar embutida na TUSD)
  * Demanda Ativa (kW × tarifa)
  * Encargos: CIP/COSIP, RGR, CCC, P&D, PROINFA
  * Tributos: ICMS, PIS, COFINS
- Total da fatura

REGRAS CRÍTICAS DE EXTRAÇÃO:
1. Identifique a ALÍQUOTA DO ICMS — geralmente entre 18% e 30% no RJ
2. Identifique o VALOR DA TUSD em R$ (linha "TUSD" ou "Distribuição" ou "Uso do Sistema de Distribuição")
3. Identifique o VALOR DA TUST em R$ (às vezes aparece separado, às vezes embutido na TUSD)
4. Identifique DEMANDA CONTRATADA (kW) vs DEMANDA FATURADA/MEDIDA (kW) — a diferença entre elas é parte do indevido
5. Identifique o VALOR DO ICMS COBRADO na fatura
6. O MÊS DE REFERÊNCIA deve estar no formato YYYY-MM (ex: 2024-03)
7. Se um campo não existir ou não for legível, use null — NUNCA invente valores

Responda EXCLUSIVAMENTE com JSON válido, sem markdown, sem explicações.`;

const USER_PROMPT_TEMPLATE = (textoPdf: string) => `
Extraia os dados da seguinte fatura da Light e retorne o JSON estruturado.

TEXTO DA FATURA:
---
${textoPdf}
---

Retorne exatamente neste formato JSON (use null para campos ausentes):
{
  "mes_referencia": "YYYY-MM",
  "vencimento": "YYYY-MM-DD",
  "numero_instalacao": "string ou null",

  "energia_kwh": number ou null,
  "energia_valor": number ou null,

  "tusd_kwh": number ou null,
  "tusd_valor": number ou null,
  "tust_valor": number ou null,

  "demanda_contratada_kw": number ou null,
  "demanda_faturada_kw": number ou null,
  "demanda_valor": number ou null,

  "cip_valor": number ou null,
  "cofins_valor": number ou null,
  "pis_valor": number ou null,

  "icms_aliquota": number ou null,
  "icms_base_calculo": number ou null,
  "icms_valor_cobrado": number ou null,

  "total_fatura": number ou null,

  "confianca": number entre 0 e 1,
  "observacoes": "string com problemas encontrados ou null"
}`;

// ─── Função principal ─────────────────────────────────────────────────────────

export async function extrairDadosFatura(
  textoPdf: string,
  nomeArquivo: string
): Promise<AgentExtracao> {
  try {
    // Limpa e normaliza o texto do PDF
    const textoNormalizado = normalizarTextoPdf(textoPdf);

    if (textoNormalizado.length < 100) {
      return {
        sucesso: false,
        erro: "PDF com texto insuficiente. Pode ser um arquivo escaneado (imagem). Use um PDF com texto selecionável.",
      };
    }

    const response = await client.messages.create({
      model: "claude-opus-4-6",
      max_tokens: 1024,
      system: SYSTEM_PROMPT,
      messages: [
        {
          role: "user",
          content: USER_PROMPT_TEMPLATE(textoNormalizado),
        },
      ],
    });

    const jsonBruto = response.content[0].type === "text"
      ? response.content[0].text.trim()
      : null;

    if (!jsonBruto) {
      return { sucesso: false, erro: "Resposta vazia do modelo de IA." };
    }

    // Remove markdown se houver
    const jsonLimpo = jsonBruto
      .replace(/^```json\n?/, "")
      .replace(/\n?```$/, "")
      .trim();

    const dados = JSON.parse(jsonLimpo);

    // Validação básica
    if (!dados.mes_referencia) {
      return {
        sucesso: false,
        erro: `Não foi possível identificar o mês de referência na fatura "${nomeArquivo}".`,
        dados,
      };
    }

    // Calcula a base indevida automaticamente
    const baseIndevida = calcularBaseIndevida(dados);

    const dadosCompletos: Partial<DadosFatura> = {
      ...dados,
      arquivo_nome: nomeArquivo,
      icms_base_indevida: baseIndevida,
      icms_valor_indevido:
        baseIndevida && dados.icms_aliquota
          ? parseFloat((baseIndevida * dados.icms_aliquota).toFixed(2))
          : null,
      extracao_confianca: dados.confianca,
      extracao_observacoes: dados.observacoes,
    };

    return {
      sucesso: true,
      dados: dadosCompletos,
      confianca: dados.confianca,
    };
  } catch (error) {
    if (error instanceof SyntaxError) {
      return {
        sucesso: false,
        erro: `Erro ao parsear resposta da IA para "${nomeArquivo}". Tente novamente.`,
      };
    }
    return {
      sucesso: false,
      erro: `Erro inesperado ao processar "${nomeArquivo}": ${String(error)}`,
    };
  }
}

// ─── Helpers internos ─────────────────────────────────────────────────────────

/**
 * Calcula a base de ICMS cobrada indevidamente.
 *
 * Regras (baseadas em Tema 986 STJ + Súmula 391 STJ):
 * 1. TUSD integralmente → base indevida
 * 2. TUST integralmente → base indevida
 * 3. Demanda não utilizada (contratada − faturada) → base indevida
 *    Atenção: pela Súmula 391, APENAS a parcela não utilizada é indevida
 */
function calcularBaseIndevida(dados: Record<string, number | null>): number {
  let base = 0;

  // TUSD
  if (dados.tusd_valor) base += dados.tusd_valor;

  // TUST (quando aparece separado)
  if (dados.tust_valor) base += dados.tust_valor;

  // Demanda não utilizada
  if (
    dados.demanda_contratada_kw &&
    dados.demanda_faturada_kw &&
    dados.demanda_valor &&
    dados.demanda_contratada_kw > dados.demanda_faturada_kw
  ) {
    const fatorNaoUtilizado =
      (dados.demanda_contratada_kw - dados.demanda_faturada_kw) /
      dados.demanda_contratada_kw;
    base += parseFloat((dados.demanda_valor * fatorNaoUtilizado).toFixed(2));
  }

  return parseFloat(base.toFixed(2));
}

/**
 * Normaliza o texto extraído do PDF:
 * - Remove caracteres especiais problemáticos
 * - Reduz espaços excessivos
 * - Limita tamanho para não exceder o contexto do modelo
 */
function normalizarTextoPdf(texto: string): string {
  return texto
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .replace(/[ \t]{3,}/g, "  ")
    .replace(/\n{4,}/g, "\n\n\n")
    .trim()
    .substring(0, 8000); // Suficiente para uma fatura completa
}
