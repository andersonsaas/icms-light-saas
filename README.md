# ⚡ ICMS Light SaaS

Plataforma para advogados gerenciarem pedidos de **restituição de ICMS** cobrado indevidamente nas contas de energia da **Light S.A. (Rio de Janeiro)**.

Fundamentação legal: Tema 986 STJ · Súmula 391 STJ · STF (prazo 10 anos, ago/2025)

---

## Como funciona

```
PDF das faturas → Agente 1 (extração) → Agente 2 (cálculo + Selic) → Agente 3 (petição .docx)
```

1. **Agente Extrator** (`lib/agents/extrator-pdf.ts`) — usa Claude para ler o PDF da Light e extrair TUSD, TUST, demanda, alíquota ICMS
2. **Agente Calculadora** (`lib/agents/calculadora-icms.ts`) — calcula o ICMS indevido mês a mês, corrige pela Selic (API do BCB)
3. **Agente Jurídico** (`lib/agents/gerador-peticao.ts`) — gera petição inicial em `.docx` pronta para protocolo na Justiça Estadual do RJ

---

## Stack

| Camada | Tecnologia |
|--------|-----------|
| Frontend + Backend | Next.js 14 (App Router) + TypeScript |
| Estilização | Tailwind CSS |
| Banco de dados | Supabase (PostgreSQL) |
| Autenticação | Supabase Auth |
| Storage (PDFs) | Supabase Storage |
| IA (agentes) | Claude API (Anthropic) |
| Deploy | Vercel |

---

## Configuração — passo a passo

### 1. Clone o repositório

```bash
git clone https://github.com/SEU_USUARIO/icms-light-saas.git
cd icms-light-saas
npm install
```

### 2. Configure o Supabase

1. Crie um projeto em [supabase.com](https://supabase.com)
2. No SQL Editor do Supabase, execute o arquivo `supabase/schema.sql`
3. Anote as chaves em **Settings → API**

### 3. Configure a API do Claude

1. Acesse [console.anthropic.com](https://console.anthropic.com/settings/keys)
2. Crie uma API key

### 4. Variáveis de ambiente

```bash
cp .env.example .env.local
```

Preencha `.env.local`:

```env
NEXT_PUBLIC_SUPABASE_URL=https://xxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...
ANTHROPIC_API_KEY=sk-ant-api03-...
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

### 5. Rode localmente

```bash
npm run dev
```

Acesse: http://localhost:3000

---

## Deploy no Vercel

### Via GitHub (recomendado)

1. Faça push do projeto para o GitHub
2. Acesse [vercel.com](https://vercel.com) → **Import Project** → selecione o repositório
3. Em **Environment Variables**, adicione as mesmas variáveis do `.env.local`
4. Clique em **Deploy**

### Via CLI

```bash
npm i -g vercel
vercel --prod
```

---

## Estrutura do projeto

```
icms-light-saas/
├── app/
│   ├── page.tsx                    # Landing page
│   ├── (auth)/
│   │   ├── login/page.tsx          # Login
│   │   └── cadastro/page.tsx       # Cadastro de advogado
│   ├── (dashboard)/
│   │   ├── layout.tsx              # Sidebar + nav
│   │   ├── dashboard/page.tsx      # Dashboard com métricas
│   │   ├── clientes/novo/page.tsx  # Cadastro de cliente
│   │   └── processos/[id]/page.tsx # Fluxo completo (upload→calc→petição)
│   └── api/
│       ├── processos/route.ts      # CRUD processos
│       └── processos/[id]/
│           ├── extrair/route.ts    # Agente 1 (upload + extração)
│           ├── calcular/route.ts   # Agente 2 (cálculo + Selic)
│           └── peticao/route.ts    # Agente 3 (gera .docx)
├── lib/
│   ├── supabase/                   # Clientes Supabase (browser/server)
│   └── agents/
│       ├── extrator-pdf.ts         # IA: extrai dados das faturas
│       ├── calculadora-icms.ts     # Cálculo + API BCB (Selic)
│       └── gerador-peticao.ts      # Petição inicial em .docx
├── types/index.ts                  # Tipos TypeScript do domínio
├── supabase/schema.sql             # Schema completo do banco
└── middleware.ts                   # Auth guard (Supabase)
```

---

## Base legal implementada

| Fundamento | Aplicação no sistema |
|-----------|---------------------|
| STJ Tema 986 | TUSD e TUST identificadas como base indevida de ICMS |
| STJ Súmula 391 | Demanda não utilizada excluída do cálculo |
| STF (ago/2025) | Prazo de 10 anos para retroatividade |
| STJ Súmula 523 | Correção pela taxa Selic |
| Lei 14.385/2022 | Via administrativa pela ANEEL |

---

## Roadmap

- [ ] Página de listagem de clientes
- [ ] Relatório em PDF do demonstrativo de cálculo (para anexar à petição)
- [ ] Planilha Excel com memória de cálculo (.xlsx)
- [ ] Suporte a faturas escaneadas (OCR via Claude Vision)
- [ ] Notificação por e-mail ao gerar a petição
- [ ] Painel multi-usuário (escritório com vários advogados)
- [ ] Integração com sistemas de processo eletrônico (e-SAJ, PJe)

---

## Licença

Uso restrito — desenvolvido para escritórios de advocacia especializados em direito tributário.
