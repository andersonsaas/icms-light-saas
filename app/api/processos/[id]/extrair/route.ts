/**
 * POST /api/processos/[id]/extrair
 *
 * Recebe um ou mais PDFs de faturas da Light,
 * faz upload para o Supabase Storage e executa o Agente 1 (extração).
 */
import { NextRequest, NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { extrairDadosFatura } from "@/lib/agents/extrator-pdf";
import pdfParse from "pdf-parse";

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const processoId = params.id;
  const supabase = await createClient();
  const serviceClient = createServiceClient();

  // Autenticação
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ erro: "Não autenticado" }, { status: 401 });

  // Verifica que o processo pertence ao advogado
  const { data: processo, error: procError } = await supabase
    .from("processos")
    .select("id, advogado_id")
    .eq("id", processoId)
    .eq("advogado_id", user.id)
    .single();

  if (procError || !processo) {
    return NextResponse.json({ erro: "Processo não encontrado" }, { status: 404 });
  }

  const formData = await req.formData();
  const arquivos = formData.getAll("faturas") as File[];

  if (!arquivos.length) {
    return NextResponse.json({ erro: "Nenhum arquivo enviado" }, { status: 400 });
  }

  const resultados = [];

  for (const arquivo of arquivos) {
    try {
      const arrayBuffer = await arquivo.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);

      // 1) Upload para o Supabase Storage
      const storagePath = `${user.id}/${processoId}/${arquivo.name}`;
      const { error: uploadError } = await serviceClient.storage
        .from("faturas-pdf")
        .upload(storagePath, buffer, {
          contentType: "application/pdf",
          upsert: true,
        });

      if (uploadError) {
        resultados.push({ arquivo: arquivo.name, sucesso: false, erro: uploadError.message });
        continue;
      }

      const { data: urlData } = serviceClient.storage
        .from("faturas-pdf")
        .getPublicUrl(storagePath);

      // 2) Extrai texto do PDF
      const pdfData = await pdfParse(buffer);
      const textoPdf = pdfData.text;

      // 3) Agente 1: extrai dados estruturados
      const extracao = await extrairDadosFatura(textoPdf, arquivo.name);

      if (!extracao.sucesso || !extracao.dados) {
        resultados.push({ arquivo: arquivo.name, sucesso: false, erro: extracao.erro });
        continue;
      }

      // 4) Salva no banco
      const { data: fatura, error: dbError } = await supabase
        .from("faturas")
        .insert({
          processo_id: processoId,
          arquivo_nome: arquivo.name,
          arquivo_url: urlData.publicUrl,
          ...extracao.dados,
        })
        .select()
        .single();

      if (dbError) {
        resultados.push({ arquivo: arquivo.name, sucesso: false, erro: dbError.message });
        continue;
      }

      resultados.push({ arquivo: arquivo.name, sucesso: true, fatura });
    } catch (err) {
      resultados.push({ arquivo: arquivo.name, sucesso: false, erro: String(err) });
    }
  }

  // Atualiza status e contador do processo
  const sucessos = resultados.filter((r) => r.sucesso).length;
  if (sucessos > 0) {
    const { count } = await supabase
      .from("faturas")
      .select("id", { count: "exact" })
      .eq("processo_id", processoId)
      .then((r) => r);

    await supabase
      .from("processos")
      .update({
        status: "dados_extraidos",
        total_faturas: count ?? sucessos,
      })
      .eq("id", processoId);
  }

  return NextResponse.json({
    total: arquivos.length,
    sucesso: sucessos,
    falha: arquivos.length - sucessos,
    resultados,
  });
}
