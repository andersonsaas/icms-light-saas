/**
 * ═══════════════════════════════════════════════════════════════════════════
 * AGENTE 3 — GERADOR DE PETIÇÃO INICIAL
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Responsabilidade:
 *   - Recebe os dados do cliente, processo e resultado do cálculo
 *   - Gera uma petição inicial completa para Ação de Repetição de Indébito
 *     Tributário contra o Estado do Rio de Janeiro
 *   - Usa a biblioteca `docx` para gerar um arquivo .docx profissional
 *   - Retorna o Buffer do arquivo para download
 *
 * Competência: Justiça Estadual do RJ (Varas da Fazenda Pública)
 * Réu: Estado do Rio de Janeiro
 * Fundamento principal: Tema 986 STJ + Súmula 391 STJ
 *
 * ═══════════════════════════════════════════════════════════════════════════
 */

import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  HeadingLevel,
  AlignmentType,
  TabStopType,
  TabStopPosition,
  UnderlineType,
} from "docx";
import type { DadosPeticao } from "@/types";
import { formatarMoeda, formatarMes } from "./calculadora-icms";

// ─── Estilos ──────────────────────────────────────────────────────────────────

const FONTE = "Times New Roman";
const TAMANHO = 24; // 12pt em half-points
const TAMANHO_TITULO = 26; // 13pt

function p(
  texto: string,
  opcoes?: {
    bold?: boolean;
    underline?: boolean;
    center?: boolean;
    indent?: boolean;
    size?: number;
  }
): Paragraph {
  return new Paragraph({
    alignment: opcoes?.center ? AlignmentType.CENTER : AlignmentType.JUSTIFIED,
    indent: opcoes?.indent ? { left: 720 } : undefined,
    spacing: { line: 360, before: 0, after: 0 }, // 1,5 espaçamento
    children: [
      new TextRun({
        text: texto,
        font: FONTE,
        size: opcoes?.size ?? TAMANHO,
        bold: opcoes?.bold,
        underline: opcoes?.underline ? { type: UnderlineType.SINGLE } : undefined,
      }),
    ],
  });
}

function linha(): Paragraph {
  return new Paragraph({ children: [new TextRun({ text: "" })] });
}

// ─── Função principal ─────────────────────────────────────────────────────────

export async function gerarPeticaoInicial(
  dados: DadosPeticao
): Promise<Buffer> {
  const { cliente, resultado, advogado } = dados;

  const valorIndevido = formatarMoeda(resultado.total_icms_indevido);
  const valorCorrigido = formatarMoeda(resultado.total_corrigido_selic);
  const periodoFmt = `${formatarMes(resultado.periodo_inicio)} a ${formatarMes(resultado.periodo_fim)}`;
  const totalMeses = resultado.total_meses;

  const doc = new Document({
    styles: {
      default: {
        document: {
          run: { font: FONTE, size: TAMANHO },
          paragraph: {
            spacing: { line: 360 },
            alignment: AlignmentType.JUSTIFIED,
          },
        },
      },
    },
    sections: [
      {
        properties: {
          page: {
            margin: { top: 1701, right: 1134, bottom: 1134, left: 1701 }, // 3cm / 2cm
          },
        },
        children: [
          // ── Endereçamento ─────────────────────────────────────────────────
          p(
            "EXCELENTÍSSIMO(A) SENHOR(A) DOUTOR(A) JUIZ(A) DE DIREITO DA " +
              "___ VARA DA FAZENDA PÚBLICA DA COMARCA DO RIO DE JANEIRO",
            { bold: true, center: true, size: TAMANHO_TITULO }
          ),
          linha(),
          linha(),

          // ── Qualificação do autor ─────────────────────────────────────────
          p(
            `${cliente.nome.toUpperCase()}, ${qualificacaoConsumidor(cliente.classe_consumidor)}, ` +
              `inscrito(a) no ${cliente.cpf_cnpj.length <= 14 ? "CPF" : "CNPJ"} sob o nº ${cliente.cpf_cnpj}, ` +
              `com endereço em ${cliente.endereco ?? "[ENDEREÇO DO CLIENTE]"}, ` +
              `número de instalação (UC) ${cliente.numero_instalacao} perante a Light S.A., ` +
              `vem respeitosamente à presença de Vossa Excelência, por intermédio de seu advogado que esta subscreve ` +
              `(procuração em anexo), com escritório profissional em [ENDEREÇO DO ESCRITÓRIO], ` +
              `OAB/RJ nº ${advogado.oab}, propor`
          ),
          linha(),

          // ── Título da ação ────────────────────────────────────────────────
          p(
            "AÇÃO DE REPETIÇÃO DE INDÉBITO TRIBUTÁRIO\nCOM PEDIDO DE TUTELA DE URGÊNCIA ANTECIPADA",
            { bold: true, center: true, size: TAMANHO_TITULO }
          ),
          linha(),

          p("em face do"),
          linha(),

          p("ESTADO DO RIO DE JANEIRO,", { bold: true, center: true }),
          linha(),

          p(
            "pessoa jurídica de direito público interno, com sede na Rua Pinheiro Machado, s/n, Laranjeiras, " +
              "Rio de Janeiro/RJ, CEP 22231-090, representado pela Procuradoria-Geral do Estado, " +
              "pelos fatos e fundamentos a seguir expostos:"
          ),
          linha(),
          linha(),

          // ══════════════════════════════════════════════════════════════════
          // I — DOS FATOS
          // ══════════════════════════════════════════════════════════════════
          p("I — DOS FATOS", { bold: true, underline: true }),
          linha(),

          p(
            `O(A) Autor(a) é consumidor(a) de energia elétrica da Light S.A. ` +
              `(CNPJ 03.378.521/0001-75), distribuidora do Estado do Rio de Janeiro, ` +
              `há mais de ${totalMeses} meses, conforme faturas acostadas aos autos.`
          ),
          linha(),

          p(
            `Ocorre que, no período de ${periodoFmt}, verificou-se que o Estado do Rio de Janeiro, ` +
              `por meio da Light, exigiu ICMS sobre parcelas que não integram legitimamente a base de ` +
              `cálculo do imposto, a saber: (i) a Tarifa de Uso do Sistema de Distribuição – TUSD; ` +
              `(ii) a Tarifa de Uso do Sistema de Transmissão – TUST; e (iii) a demanda de potência ` +
              `contratada mas não efetivamente utilizada.`
          ),
          linha(),

          p(
            `A cobrança indevida totaliza ${valorIndevido}, ou ${valorCorrigido} quando corrigida ` +
              `pela taxa SELIC, conforme demonstrativo de cálculo em anexo.`
          ),
          linha(),
          linha(),

          // ══════════════════════════════════════════════════════════════════
          // II — DO DIREITO
          // ══════════════════════════════════════════════════════════════════
          p("II — DO DIREITO", { bold: true, underline: true }),
          linha(),

          p("II.1 — Da ilegitimidade da inclusão de TUSD e TUST na base de cálculo do ICMS", {
            bold: true,
          }),
          linha(),

          p(
            "O Colendo Superior Tribunal de Justiça, em julgamento de recurso especial sob o rito dos recursos " +
              "repetitivos (Tema 986), decidiu, por unanimidade, que a TUSD e a TUST, quando lançadas " +
              "na fatura de energia elétrica como encargo a ser suportado pelo consumidor final, integram " +
              "a base de cálculo do ICMS — reconhecendo, assim, implicitamente, que houve cobrança sobre " +
              "base equivocada durante os períodos anteriores à modulação dos efeitos daquele julgado."
          ),
          linha(),

          p(
            "Com efeito, a Súmula 166 do STJ consolidava o entendimento de que o ICMS não incide sobre " +
              "o simples deslocamento de mercadoria. Inúmeros contribuintes obtiveram liminares impedindo " +
              "a inclusão de TUSD/TUST na base de cálculo, o que gerou créditos a serem restituídos. " +
              "O STF, ao validar a Lei 14.385/2022 (ADI 7324), reconheceu o dever das distribuidoras de " +
              "devolver os valores pagos a maior."
          ),
          linha(),

          p("II.2 — Da ilegitimidade da cobrança sobre demanda não utilizada", { bold: true }),
          linha(),

          p(
            "A Súmula 391 do STJ é expressa: \"O ICMS incide sobre o valor da tarifa de energia elétrica " +
              "correspondente à demanda de potência efetivamente utilizada.\" Portanto, a parcela de demanda " +
              "contratada e não consumida não pode compor a base de cálculo do imposto, sob pena de tributação " +
              "sobre fato gerador inexistente."
          ),
          linha(),

          p("II.3 — Do prazo prescricional", { bold: true }),
          linha(),

          p(
            "O Supremo Tribunal Federal, em agosto de 2025, fixou o prazo prescricional de 10 (dez) anos " +
              "para a repetição do indébito, contado nos termos do artigo 205 do Código Civil. " +
              "O(A) Autor(a) encontra-se dentro desse prazo, razão pela qual o crédito é integralmente exigível."
          ),
          linha(),

          p("II.4 — Da correção monetária pela taxa SELIC", { bold: true }),
          linha(),

          p(
            "Pacificada a jurisprudência do STJ e do STF, a atualização dos valores a serem restituídos " +
              "deve se dar pela taxa SELIC, por analogia ao disposto no art. 39, §4º da Lei 9.250/95 e " +
              "consoante entendimento consolidado na Súmula 523 do STJ."
          ),
          linha(),

          p("II.5 — Da tutela de urgência antecipada", { bold: true }),
          linha(),

          p(
            "Presentes os requisitos do art. 300 do CPC — fumus boni iuris evidenciado pela vasta " +
              "jurisprudência do STJ e STF sobre o tema, e periculum in mora consistente na continuidade " +
              "da cobrança indevida —, requer-se a concessão de tutela de urgência para suspender " +
              "imediatamente a inclusão de TUSD, TUST e demanda não utilizada na base de cálculo do ICMS " +
              "das próximas faturas."
          ),
          linha(),
          linha(),

          // ══════════════════════════════════════════════════════════════════
          // III — DOS PEDIDOS
          // ══════════════════════════════════════════════════════════════════
          p("III — DOS PEDIDOS", { bold: true, underline: true }),
          linha(),

          p(
            "Ante o exposto, requer-se a Vossa Excelência:"
          ),
          linha(),

          p(
            "a) A concessão de TUTELA DE URGÊNCIA ANTECIPADA para determinar que o Estado do Rio de Janeiro, " +
              "por meio da Light S.A., se abstenha de incluir TUSD, TUST e demanda não utilizada na base " +
              "de cálculo do ICMS nas faturas futuras, sob pena de multa diária de R$ 500,00;",
            { indent: true }
          ),
          linha(),

          p(
            "b) No mérito, a PROCEDÊNCIA TOTAL DO PEDIDO para: " +
              "(i) declarar a ilegalidade da inclusão de TUSD, TUST e demanda não utilizada " +
              "na base de cálculo do ICMS; " +
              "(ii) condenar o Réu à RESTITUIÇÃO do indébito tributário apurado no montante de " +
              `${valorIndevido}, corrigido pela taxa SELIC até o efetivo pagamento, perfazendo ` +
              `hoje o total de ${valorCorrigido}, nos termos do demonstrativo em anexo;`,
            { indent: true }
          ),
          linha(),

          p(
            "c) A condenação do Réu ao pagamento das custas processuais e dos honorários advocatícios, " +
              "nos termos do art. 85 do CPC;",
            { indent: true }
          ),
          linha(),

          p(
            "d) A juntada dos documentos em anexo: (i) procuração; (ii) faturas de energia elétrica; " +
              "(iii) demonstrativo de cálculo do indébito.",
            { indent: true }
          ),
          linha(),

          p("Dá-se à causa o valor de " + valorCorrigido + "."),
          linha(),

          p("Termos em que pede deferimento."),
          linha(),
          linha(),

          p(`Rio de Janeiro, ${new Date().toLocaleDateString("pt-BR", { day: "2-digit", month: "long", year: "numeric" })}.`),
          linha(),
          linha(),
          linha(),

          p("_".repeat(55), { center: true }),
          p(`${advogado.nome}`, { bold: true, center: true }),
          p(`OAB/RJ nº ${advogado.oab}`, { center: true }),
          p(advogado.email, { center: true }),
        ],
      },
    ],
  });

  return Packer.toBuffer(doc);
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function qualificacaoConsumidor(classe: string): string {
  const map: Record<string, string> = {
    residencial: "consumidor(a) residencial",
    residencial_baixa_renda: "consumidor(a) residencial de baixa renda",
    comercial: "pessoa jurídica de direito privado, consumidora comercial de energia elétrica",
    industrial: "pessoa jurídica de direito privado, consumidora industrial de energia elétrica",
    rural: "produtor(a) rural, consumidor(a) de energia elétrica",
    poder_publico: "pessoa jurídica de direito público, consumidora de energia elétrica",
  };
  return map[classe] ?? "consumidor(a) de energia elétrica";
}
