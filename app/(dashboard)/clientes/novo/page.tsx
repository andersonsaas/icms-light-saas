"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import Link from "next/link";
import type { ClasseConsumidor } from "@/types";

const CLASSES: { value: ClasseConsumidor; label: string }[] = [
  { value: "residencial", label: "Residencial" },
  { value: "residencial_baixa_renda", label: "Residencial Baixa Renda" },
  { value: "comercial", label: "Comercial" },
  { value: "industrial", label: "Industrial" },
  { value: "rural", label: "Rural" },
  { value: "poder_publico", label: "Poder Público" },
];

export default function NovoClientePage() {
  const router = useRouter();
  const supabase = createClient();
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [form, setForm] = useState({
    nome: "",
    cpf_cnpj: "",
    email: "",
    telefone: "",
    endereco: "",
    classe_consumidor: "residencial" as ClasseConsumidor,
    numero_instalacao: "",
  });

  function handleChange(e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) {
    setForm((f) => ({ ...f, [e.target.name]: e.target.value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setCarregando(true);
    setErro(null);

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setErro("Sessão expirada."); setCarregando(false); return; }

    const { data: cliente, error } = await supabase
      .from("clientes")
      .insert({ ...form, advogado_id: user.id })
      .select()
      .single();

    if (error) { setErro(error.message); setCarregando(false); return; }

    // Cria processo automaticamente
    const { data: processo } = await supabase
      .from("processos")
      .insert({ cliente_id: cliente.id, advogado_id: user.id, status: "pendente" })
      .select()
      .single();

    router.push(`/processos/${processo?.id}`);
  }

  return (
    <div className="p-8 max-w-2xl">
      <div className="flex items-center gap-3 mb-8">
        <Link href="/clientes" className="text-gray-400 hover:text-gray-600 text-sm">← Clientes</Link>
        <span className="text-gray-200">/</span>
        <h1 className="text-xl font-bold text-gray-900">Novo cliente</h1>
      </div>

      <div className="card p-6">
        {erro && (
          <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-4 py-3 mb-5">{erro}</div>
        )}

        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Nome completo / Razão social *</label>
              <input name="nome" value={form.nome} onChange={handleChange} className="input" placeholder="Maria da Silva" required />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">CPF / CNPJ *</label>
              <input name="cpf_cnpj" value={form.cpf_cnpj} onChange={handleChange} className="input" placeholder="000.000.000-00" required />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Nº da Instalação (UC Light) *</label>
              <input name="numero_instalacao" value={form.numero_instalacao} onChange={handleChange} className="input" placeholder="7012345678" required />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Classe do consumidor *</label>
              <select name="classe_consumidor" value={form.classe_consumidor} onChange={handleChange} className="input">
                {CLASSES.map((c) => (
                  <option key={c.value} value={c.value}>{c.label}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">E-mail</label>
              <input type="email" name="email" value={form.email} onChange={handleChange} className="input" placeholder="cliente@email.com" />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Telefone</label>
              <input name="telefone" value={form.telefone} onChange={handleChange} className="input" placeholder="(21) 99999-9999" />
            </div>

            <div className="col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Endereço completo</label>
              <input name="endereco" value={form.endereco} onChange={handleChange} className="input" placeholder="Rua Exemplo, 123, Bairro, Rio de Janeiro/RJ" />
            </div>
          </div>

          <div className="flex gap-3 pt-2">
            <button type="submit" disabled={carregando} className="btn-primary">
              {carregando ? "Salvando..." : "Cadastrar e iniciar processo"}
            </button>
            <Link href="/clientes" className="btn-secondary">Cancelar</Link>
          </div>
        </form>
      </div>
    </div>
  );
}
