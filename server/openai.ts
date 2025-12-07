import OpenAI from "openai";
import { ARTIFACT_TYPE_LABELS, type ArtifactType } from "@shared/schema";

// the newest OpenAI model is "gpt-5" which was released August 7, 2025. do not change this unless explicitly requested by the user
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const systemPrompts: Record<ArtifactType, string> = {
  business_rules: `Você é um especialista em análise de reuniões corporativas. Sua tarefa é extrair e documentar REGRAS DE NEGÓCIO a partir da transcrição fornecida.

Regras de Negócio são diretrizes, políticas, condições ou restrições que definem como os processos da empresa devem funcionar.

Formate sua resposta em Markdown com:
1. Um título claro
2. Uma breve introdução contextualizando as regras
3. Uma lista numerada das regras identificadas, cada uma com:
   - Descrição clara da regra
   - Contexto de aplicação (quando se aplica)
   - Exceções, se houver

Seja objetivo e profissional. Extraia apenas informações presentes na transcrição.`,

  action_points: `Você é um especialista em análise de reuniões corporativas. Sua tarefa é extrair e documentar PONTOS DE AÇÃO a partir da transcrição fornecida.

Pontos de Ação são tarefas específicas que precisam ser executadas, geralmente com responsável e prazo.

Formate sua resposta em Markdown com:
1. Um título claro
2. Uma tabela ou lista com:
   - Descrição da ação
   - Responsável (se mencionado)
   - Prazo (se mencionado)
   - Prioridade (Alta/Média/Baixa, se possível inferir)

Seja objetivo e profissional. Extraia apenas informações presentes na transcrição.`,

  referrals: `Você é um especialista em análise de reuniões corporativas. Sua tarefa é extrair e documentar ENCAMINHAMENTOS a partir da transcrição fornecida.

Encaminhamentos são direcionamentos para outras pessoas, departamentos ou processos que precisam ser seguidos após a reunião.

Formate sua resposta em Markdown com:
1. Um título claro
2. Uma lista dos encaminhamentos, cada um com:
   - Descrição do encaminhamento
   - Destinatário (pessoa, equipe ou departamento)
   - Objetivo/Motivo do encaminhamento
   - Próximos passos

Seja objetivo e profissional. Extraia apenas informações presentes na transcrição.`,

  critical_points: `Você é um especialista em análise de reuniões corporativas. Sua tarefa é extrair e documentar PONTOS CRÍTICOS a partir da transcrição fornecida.

Pontos Críticos são questões que requerem atenção especial, riscos identificados, bloqueios ou decisões importantes que precisam ser tomadas.

Formate sua resposta em Markdown com:
1. Um título claro
2. Uma lista dos pontos críticos, cada um com:
   - Descrição do ponto crítico
   - Impacto potencial
   - Urgência (Alta/Média/Baixa)
   - Ação recomendada

Seja objetivo e profissional. Extraia apenas informações presentes na transcrição.`,
};

export async function generateArtifactContent(
  type: ArtifactType,
  transcription: string
): Promise<string> {
  const systemPrompt = systemPrompts[type];
  const typeName = ARTIFACT_TYPE_LABELS[type];

  try {
    const response = await openai.chat.completions.create({
      model: "gpt-5",
      messages: [
        { role: "system", content: systemPrompt },
        {
          role: "user",
          content: `Analise a seguinte transcrição de reunião e extraia os ${typeName}:\n\n${transcription}`,
        },
      ],
      max_completion_tokens: 4096,
    });

    return response.choices[0].message.content || `Não foi possível extrair ${typeName} da transcrição fornecida.`;
  } catch (error: any) {
    console.error(`Error generating artifact (${type}):`, error);
    throw new Error(`Falha ao gerar ${typeName}: ${error.message}`);
  }
}
