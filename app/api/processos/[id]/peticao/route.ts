/**
 * POST /api/processos/[id]/peticao
 *
 * Executa o Agente 3 (gerador de petição) e retorna o arquivo .docx
 * pronto para download.
 */
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { gerarPeticaoInicial } from "@/lib/agents/gerador-peticao";
import type { DadosPeticao } from "@/types";

export async function POST(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const processoId = params.id;
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ erro: "Não autenticado" }, { status: 401 });

  // Busca processo + cliente + advogado
  const { data: processo, error: procError } = await supabase
    .from("processos")
    .select(`*, cliente:clientes(*)`)
    .eq("id", processoId)
    .eq("advogado_id", user.id)
    .single();

  if (procError || !processo) {
    return NextResponse.json({ erro: "Processo não encontrado" }, { status: 404 });
  }

  if (processo.status !== "calculado" && processo.status !== "peticao_gerada") {
    return NextResponse.json(
      { erro: "Execute o cálculo antes de gerar a petição." },
      { status: 400 }
    );
  }

  const { data: advogado } = await supabase
    .from("advogados")
    .select("nome, email, oab")
    .eq("id", user.id)
    .single();

  if (!advogado) {
    return NextResponse.json({ erro: "Perfil do advogado não encontrado." }, { status: 400 });
  }

  try {
    const dadosPeticao: DadosPeticao = {
      cliente: processo.cliente,
      processo,
      resultado: processo.resultado_json,
      advogado,
    };

    const buffer = await gerarPeticaoInicial(dadosPeticao);

    // Atualiza status do processo
    await supabase
      .from("processos")
      .update({ status: "peticao_gerada" })
      .eq("id", processoId);

    const nomeArquivo = `peticao_icms_${processo.cliente.nome
      .toLowerCase()
      .replace(/\s+/g, "_")}_${processoId.substring(0, 8)}.docx`;

    return new NextResponse(new Uint8Array(buffer), {
      status: 200,
      headers: {
        "Content-Type":
          "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "Content-Disposition": `attachment; filename="${nomeArquivo}"`,
      },
    });
  } catch (err) {
    return NextResponse.json({ erro: String(err) }, { status: 500 });
  }
}
