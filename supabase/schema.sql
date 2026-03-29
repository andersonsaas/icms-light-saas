-- ═══════════════════════════════════════════════════════════════════════════
-- ICMS Light SaaS — Schema do Banco de Dados (Supabase / PostgreSQL)
-- Execute no SQL Editor do Supabase: https://supabase.com/dashboard
-- ═══════════════════════════════════════════════════════════════════════════

-- Habilitar UUID
create extension if not exists "uuid-ossp";

-- ─── Tabela: advogados (perfil estendido do usuário Supabase Auth) ───────────
create table public.advogados (
  id           uuid primary key references auth.users(id) on delete cascade,
  nome         text not null,
  email        text not null,
  oab          text not null,         -- ex: "RJ 12345"
  telefone     text,
  created_at   timestamptz default now()
);

alter table public.advogados enable row level security;

create policy "Advogado vê apenas seu perfil"
  on public.advogados for all
  using (auth.uid() = id);

-- ─── Tabela: clientes ─────────────────────────────────────────────────────────
create table public.clientes (
  id                  uuid primary key default uuid_generate_v4(),
  advogado_id         uuid not null references public.advogados(id) on delete cascade,
  nome                text not null,
  cpf_cnpj            text not null,
  email               text,
  telefone            text,
  endereco            text,
  classe_consumidor   text not null check (
    classe_consumidor in (
      'residencial', 'residencial_baixa_renda',
      'comercial', 'industrial', 'rural', 'poder_publico'
    )
  ),
  numero_instalacao   text not null,    -- número da UC na Light
  created_at          timestamptz default now(),
  updated_at          timestamptz default now()
);

alter table public.clientes enable row level security;

create policy "Advogado gerencia seus clientes"
  on public.clientes for all
  using (advogado_id = auth.uid());

-- ─── Tabela: processos ────────────────────────────────────────────────────────
create table public.processos (
  id                    uuid primary key default uuid_generate_v4(),
  cliente_id            uuid not null references public.clientes(id) on delete cascade,
  advogado_id           uuid not null references public.advogados(id) on delete cascade,
  status                text not null default 'pendente' check (
    status in (
      'pendente', 'faturas_carregadas', 'dados_extraidos',
      'calculado', 'peticao_gerada', 'concluido'
    )
  ),
  total_faturas         integer default 0,
  periodo_inicio        text,           -- "YYYY-MM"
  periodo_fim           text,           -- "YYYY-MM"
  valor_total_indevido  numeric(12,2),
  valor_corrigido_selic numeric(12,2),
  observacoes           text,
  resultado_json        jsonb,          -- ResultadoCalculo completo
  created_at            timestamptz default now(),
  updated_at            timestamptz default now()
);

alter table public.processos enable row level security;

create policy "Advogado gerencia seus processos"
  on public.processos for all
  using (advogado_id = auth.uid());

-- ─── Tabela: faturas ──────────────────────────────────────────────────────────
create table public.faturas (
  id                      uuid primary key default uuid_generate_v4(),
  processo_id             uuid not null references public.processos(id) on delete cascade,
  arquivo_nome            text not null,
  arquivo_url             text,           -- URL no Supabase Storage

  -- Dados extraídos pelo Agente 1
  mes_referencia          text,           -- "YYYY-MM"
  vencimento              date,
  numero_instalacao       text,

  -- Componentes tarifários (R$)
  energia_kwh             numeric(10,3),
  energia_valor           numeric(10,2),
  tusd_kwh                numeric(10,3),
  tusd_valor              numeric(10,2),
  tust_valor              numeric(10,2),
  demanda_contratada_kw   numeric(10,3),
  demanda_faturada_kw     numeric(10,3),
  demanda_valor           numeric(10,2),

  -- Encargos
  cip_valor               numeric(10,2),
  cofins_valor            numeric(10,2),
  pis_valor               numeric(10,2),

  -- ICMS
  icms_aliquota           numeric(5,4),   -- ex: 0.2500
  icms_base_calculo       numeric(10,2),
  icms_valor_cobrado      numeric(10,2),

  -- Cálculo de indevido (preenchido pelo Agente 2)
  icms_base_indevida      numeric(10,2),
  icms_valor_indevido     numeric(10,2),

  total_fatura            numeric(10,2),

  -- Metadados da extração
  extracao_confianca      numeric(3,2),   -- 0.00 a 1.00
  extracao_observacoes    text,

  created_at              timestamptz default now()
);

alter table public.faturas enable row level security;

create policy "Advogado acessa faturas dos seus processos"
  on public.faturas for all
  using (
    exists (
      select 1 from public.processos p
      where p.id = processo_id
        and p.advogado_id = auth.uid()
    )
  );

-- ─── Storage bucket: faturas-pdf ─────────────────────────────────────────────
-- Execute no Storage do Supabase ou via SQL:
insert into storage.buckets (id, name, public)
values ('faturas-pdf', 'faturas-pdf', false)
on conflict do nothing;

create policy "Advogado faz upload dos seus PDFs"
  on storage.objects for insert
  with check (
    bucket_id = 'faturas-pdf'
    and auth.uid() is not null
  );

create policy "Advogado lê seus PDFs"
  on storage.objects for select
  using (
    bucket_id = 'faturas-pdf'
    and auth.uid() is not null
  );

create policy "Advogado deleta seus PDFs"
  on storage.objects for delete
  using (
    bucket_id = 'faturas-pdf'
    and auth.uid() is not null
  );

-- ─── Funções auxiliares ───────────────────────────────────────────────────────

-- Atualiza updated_at automaticamente
create or replace function public.handle_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger clientes_updated_at
  before update on public.clientes
  for each row execute function public.handle_updated_at();

create trigger processos_updated_at
  before update on public.processos
  for each row execute function public.handle_updated_at();

-- Cria perfil do advogado após signup
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.advogados (id, nome, email, oab)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'nome', 'Advogado'),
    new.email,
    coalesce(new.raw_user_meta_data->>'oab', '')
  );
  return new;
end;
$$ language plpgsql security definer;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ─── Índices ──────────────────────────────────────────────────────────────────
create index idx_clientes_advogado on public.clientes(advogado_id);
create index idx_processos_advogado on public.processos(advogado_id);
create index idx_processos_cliente on public.processos(cliente_id);
create index idx_faturas_processo on public.faturas(processo_id);
create index idx_faturas_mes on public.faturas(mes_referencia);
