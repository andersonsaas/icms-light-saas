import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// GET /api/processos — lista processos do advogado logado
export async function GET() {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ erro: "Não autenticado" }, { status: 401 });

  const { data, error } = await supabase
    .from("processos")
    .select(`*, cliente:clientes(nome, cpf_cnpj, classe_consumidor, numero_instalacao)`)
    .eq("advogado_id", user.id)
    .order("created_at", { ascending: false });

  if (error) return NextResponse.json({ erro: error.message }, { status: 500 });
  return NextResponse.json(data);
}

// POST /api/processos — cria novo processo
export async function POST(req: NextRequest) {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ erro: "Não autenticado" }, { status: 401 });

  const body = await req.json();
  const { cliente_id } = body;

  if (!cliente_id) {
    return NextResponse.json({ erro: "cliente_id é obrigatório" }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("processos")
    .insert({
      cliente_id,
      advogado_id: user.id,
      status: "pendente",
    })
    .select()
    .single();

  if (error) return NextResponse.json({ erro: error.message }, { status: 500 });
  return NextResponse.json(data, { status: 201 });
}
