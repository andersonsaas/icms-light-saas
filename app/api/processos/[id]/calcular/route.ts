/**
 * POST /api/processos/[id]/calcular
 *
 * Executa o Agente 2 (calculadora de ICMS + Selic) sobre as faturas
 * já extraídas do processo e salva o resultado no banco.
 */
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { calcularICMSIndevido } from "@/lib/agents/calculadora-icms";

export async function POST(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const processoId = params.id;
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ erro: "Não autenticado" }, { status: 401 });

  // Busca as faturas do processo
  const { data: faturas, error: faturasError } = await supabase
    .from("faturas")
    .select("*")
    .eq("processo_id", processoId);

  if (faturasError || !faturas?.length) {
    return NextResponse.json(
      { erro: "Nenhuma fatura encontrada para este processo. Faça o upload primeiro." },
      { status: 400 }
    );
  }

  try {
    // Agente 2: calcula ICMS indevido + Selic
    const resultado = await calcularICMSIndevido(faturas);
    resultado.processo_id = processoId;

    // Atualiza cada fatura com os valores calculados (se não vieram do extrator)
    for (const det of resultado.detalhamento) {
      const fatura = faturas.find((f) => f.mes_referencia === det.mes_referencia);
      if (fatura && !fatura.icms_base_indevida) {
        await supabase
          .from("faturas")
          .update({
            icms_base_indevida: det.base_indevida,
            icms_valor_indevido: det.icms_indevido,
          })
          .eq("id", fatura.id);
      }
    }

    // Salva resultado no processo
    const { error: updateError } = await supabase
      .from("processos")
      .update({
        status: "calculado",
        valor_total_indevido: resultado.total_icms_indevido,
        valor_corrigido_selic: resultado.total_corrigido_selic,
        periodo_inicio: resultado.periodo_inicio,
        periodo_fim: resultado.periodo_fim,
        resultado_json: resultado,
      })
      .eq("id", processoId)
      .eq("advogado_id", user.id);

    if (updateError) {
      return NextResponse.json({ erro: updateError.message }, { status: 500 });
    }

    return NextResponse.json(resultado);
  } catch (err) {
    return NextResponse.json({ erro: String(err) }, { status: 500 });
  }
}
