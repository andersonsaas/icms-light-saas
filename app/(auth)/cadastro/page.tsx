"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import Link from "next/link";

export default function CadastroPage() {
  const router = useRouter();
  const supabase = createClient();
  const [form, setForm] = useState({ nome: "", email: "", oab: "", senha: "" });
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    setForm((f) => ({ ...f, [e.target.name]: e.target.value }));
  }

  async function handleCadastro(e: React.FormEvent) {
    e.preventDefault();
    setCarregando(true);
    setErro(null);

    const { error } = await supabase.auth.signUp({
      email: form.email,
      password: form.senha,
      options: {
        data: { nome: form.nome, oab: form.oab },
      },
    });

    if (error) {
      setErro(error.message);
      setCarregando(false);
      return;
    }

    router.push("/dashboard");
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-brand-950 to-brand-800 flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-2 text-white mb-2">
            <span className="text-2xl">⚡</span>
            <span className="text-2xl font-bold">ICMS Light</span>
          </div>
          <p className="text-white/60 text-sm">Crie sua conta gratuitamente</p>
        </div>

        <div className="card p-8">
          <h1 className="text-xl font-semibold text-gray-900 mb-6">Criar conta</h1>

          {erro && (
            <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-4 py-3 mb-5">
              {erro}
            </div>
          )}

          <form onSubmit={handleCadastro} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Nome completo</label>
              <input name="nome" value={form.nome} onChange={handleChange} className="input" placeholder="Dr. João Silva" required />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">E-mail</label>
              <input type="email" name="email" value={form.email} onChange={handleChange} className="input" placeholder="seu@escritorio.com.br" required />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">OAB</label>
              <input name="oab" value={form.oab} onChange={handleChange} className="input" placeholder="RJ 123456" required />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Senha</label>
              <input type="password" name="senha" value={form.senha} onChange={handleChange} className="input" placeholder="Mínimo 8 caracteres" minLength={8} required />
            </div>

            <button type="submit" disabled={carregando} className="btn-primary w-full justify-center py-3 mt-2">
              {carregando ? "Criando conta..." : "Criar conta grátis"}
            </button>
          </form>

          <p className="text-center text-sm text-gray-500 mt-6">
            Já tem conta?{" "}
            <Link href="/login" className="text-brand-700 hover:underline font-medium">Entrar</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
