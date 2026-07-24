import type { Friend } from '@line-crm/db';

export type MoneyAiConfig = {
  apiKey?: string;
  model?: string;
};

export type MoneyAiContext = {
  friend: Friend;
  incomingText: string;
};

type ResponsesApiOutputText = {
  type?: string;
  text?: string;
};

type ResponsesApiOutput = {
  type?: string;
  content?: ResponsesApiOutputText[];
};

type ResponsesApiResult = {
  output_text?: string;
  output?: ResponsesApiOutput[];
};

const MONEY_AI_MODEL_DEFAULT = 'gpt-5.6-luna';

const MONEY_TERMS = [
  'AI',
  '生成AI',
  'DX',
  '開発',
  'システム',
  'アプリ',
  'プロダクト',
  'PoC',
  '実装',
  '研修',
  '内製化',
  '自動化',
  '業務改善',
  '効率化',
  '資料',
  '問い合わせ',
  '相談',
];

function parseMetadata(friend: Friend): Record<string, unknown> {
  const raw = (friend as unknown as { metadata?: string | null }).metadata;
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed as Record<string, unknown> : {};
  } catch {
    return {};
  }
}

export function shouldUseMoneyAiChat(context: MoneyAiContext): boolean {
  const text = context.incomingText.trim();
  if (!text) return false;

  if (/^(AI相談|相談|質問)[:：\s]/.test(text)) return true;
  if (/[?？]/.test(text) && MONEY_TERMS.some((term) => text.includes(term))) return true;
  if (MONEY_TERMS.some((term) => text.includes(term))) {
    const metadata = parseMetadata(context.friend);
    return Boolean(
      metadata.money_diagnosis_type ||
      metadata.money_status ||
      metadata.money_stage,
    );
  }

  return false;
}

export function buildMoneyAiInstructions(context: MoneyAiContext): string {
  const metadata = parseMetadata(context.friend);
  const diagnosisLabel = String(metadata.money_diagnosis_label ?? '未診断');
  const diagnosisType = String(metadata.money_diagnosis_type ?? '未診断');
  const stage = String(metadata.money_stage ?? 'unknown');

  return [
    'あなたは株式会社ZETTAi公式LINEの一次相談担当AIです。',
    '目的は、ユーザーのAI導入・DX支援・Web/iOS/AIプロダクト開発・AI研修に関する相談を整理し、担当者への相談につなげることです。',
    '必ず日本語で、LINEで読みやすい短い段落で返答してください。',
    '料金・納期・成果保証・契約条件を断定しないでください。必要な場合は担当者確認を案内してください。',
    '機密情報、個人情報、社内資料の全文貼り付けは避けるよう促してください。',
    '回答は最大450文字程度にしてください。',
    '最後に、必要なら「開発相談をしたい」または「AI研修について知りたい」と送ると案内できます、という自然な一文を添えてください。',
    `ユーザー診断タイプ: ${diagnosisType}`,
    `ユーザー診断ラベル: ${diagnosisLabel}`,
    `現在ステージ: ${stage}`,
  ].join('\n');
}

function extractOutputText(result: ResponsesApiResult): string {
  if (typeof result.output_text === 'string') return result.output_text;

  const parts: string[] = [];
  for (const item of result.output ?? []) {
    for (const content of item.content ?? []) {
      if (content.type === 'output_text' && typeof content.text === 'string') {
        parts.push(content.text);
      }
    }
  }
  return parts.join('\n').trim();
}

export async function generateMoneyAiReply(
  config: MoneyAiConfig,
  context: MoneyAiContext,
): Promise<string | null> {
  if (!config.apiKey) return null;
  if (!shouldUseMoneyAiChat(context)) return null;

  const response = await fetch('https://api.openai.com/v1/responses', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${config.apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: config.model || MONEY_AI_MODEL_DEFAULT,
      instructions: buildMoneyAiInstructions(context),
      input: context.incomingText,
      max_output_tokens: 700,
    }),
  });

  if (!response.ok) {
    const detail = await response.text().catch(() => '');
    throw new Error(`OpenAI Responses API error: ${response.status} ${detail}`);
  }

  const result = await response.json() as ResponsesApiResult;
  const text = extractOutputText(result).trim();
  if (!text) return null;

  return text.length > 1200 ? `${text.slice(0, 1197)}...` : text;
}
