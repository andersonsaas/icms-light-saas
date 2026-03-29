// ─── Tipos do domínio ────────────────────────────────────────────────────────

export type ClasseConsumidor =
  | "residencial"
  | "residencial_baixa_renda"
  | "comercial"
  | "industrial"
  | "rural"
  | "poder_publico";

export type StatusProcesso =
  | "pendente"
  | "faturas_carregadas"
  | "dados_extraidos"
  | "calculado"
  | "peticao_gerada"
  | "concluido";

// ─── Cliente ─────────────────────────────────────────────────────────────────

export interface Cliente {
  id: string;
  advogado_id: string;
  nome: string;
  cpf_cnpj: string;
  email?: string;
  telefone?: string;
  endereco?: string;
  classe_consumidor: ClasseConsumidor;
  numero_instalacao: string; // número da UC na Light
  created_at: string;
  updated_at: string;
}

// ─── Processo ────────────────────────────────────────────────────────────────

export interface Processo {
  id: string;
  cliente_id: string;
  advogado_id: string;
  status: StatusProcesso;
  total_faturas: number;
  periodo_inicio?: string; // "YYYY-MM"
  periodo_fim?: string;    // "YYYY-MM"
  valor_total_indevido?: number; // R$ calculado
  valor_corrigido_selic?: number;
  observacoes?: string;
  created_at: string;
  updated_at: string;
  cliente?: Cliente;
}

// ─── Fatura extraída ─────────────────────────────────────────────────────────

export interface DadosFatura {
  id: string;
  processo_id: string;
  arquivo_nome: string;
  arquivo_url?: string;

  // Dados extraídos do PDF
  mes_referencia: string;   // "YYYY-MM"
  vencimento?: string;      // "YYYY-MM-DD"
  numero_instalacao?: string;

  // Componentes tarifários (R$)
  energia_kwh?: number;
  energia_valor?: number;
  tusd_kwh?: number;
  tusd_valor?: number;        // ← base do ICMS indevido
  tust_valor?: number;        // ← base do ICMS indevido (se aparecer)
  demanda_contratada_kw?: number;
  demanda_faturada_kw?: number;
  demanda_valor?: number;     // ← parte pode ser indevida

  // Encargos setoriais (R$)
  cip_valor?: number;
  cofins_valor?: number;
  pis_valor?: number;

  // ICMS
  icms_aliquota?: number;     // ex: 0.25
  icms_base_calculo?: number; // base declarada pela Light
  icms_valor_cobrado?: number;// valor cobrado

  // Cálculo de indevido
  icms_base_indevida?: number; // TUSD+TUST+demanda não utilizada
  icms_valor_indevido?: number;// = icms_base_indevida * aliquota

  total_fatura?: number;

  created_at: string;
}

// ─── Resultado do cálculo ─────────────────────────────────────────────────────

export interface ResultadoCalculo {
  processo_id: string;
  periodo_inicio: string;
  periodo_fim: string;
  total_meses: number;

  // Valores brutos
  total_tusd_tust: number;
  total_demanda_indevida: number;
  total_base_indevida: number;
  total_icms_indevido: number;

  // Valores corrigidos
  total_corrigido_selic: number;
  taxa_selic_periodo: number; // % acumulado

  // Detalhamento mensal
  detalhamento: Array<{
    mes_referencia: string;
    base_indevida: number;
    icms_indevido: number;
    fator_selic: number;
    valor_corrigido: number;
  }>;

  // Metadados
  aliquota_icms_media: number;
  calculado_em: string;
}

// ─── Dados para petição ───────────────────────────────────────────────────────

export interface DadosPeticao {
  cliente: Cliente;
  processo: Processo;
  resultado: ResultadoCalculo;
  advogado: {
    nome: string;
    oab: string;
    email: string;
  };
}

// ─── Resposta dos agents ──────────────────────────────────────────────────────

export interface AgentExtracao {
  sucesso: boolean;
  dados?: Partial<DadosFatura>;
  erro?: string;
  confianca?: number; // 0-1
}
