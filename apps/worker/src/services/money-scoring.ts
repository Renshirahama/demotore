import { addScore, addTagToFriend, getFriendScore } from '@line-crm/db';

export const MONEY_SCORE_TAGS = {
  warm: 'tag-money-lead-warm',
  hot: 'tag-money-lead-hot',
  aiConsulted: 'tag-money-ai-consulted',
  counselingIntent: 'tag-money-counseling-intent',
} as const;

const SCORE_REASON_PREFIX = 'money:';

export type MoneyScoreEvent =
  | 'diagnosis_type_a'
  | 'diagnosis_type_b'
  | 'diagnosis_type_c'
  | 'menu_course_info'
  | 'menu_today_lesson'
  | 'menu_work'
  | 'menu_counseling_info'
  | 'menu_counseling_apply'
  | 'menu_counseling_faq'
  | 'ai_chat_used';

const SCORE_EVENTS: Record<MoneyScoreEvent, { score: number; label: string }> = {
  diagnosis_type_a: { score: 10, label: '診断 A: AI活用検討タイプ' },
  diagnosis_type_b: { score: 15, label: '診断 B: AI開発・実装相談タイプ' },
  diagnosis_type_c: { score: 20, label: '診断 C: AI研修・内製化支援タイプ' },
  menu_course_info: { score: 3, label: 'サービス情報メニュー反応' },
  menu_today_lesson: { score: 4, label: '導入事例メニュー反応' },
  menu_work: { score: 5, label: '資料請求メニュー反応' },
  menu_counseling_info: { score: 12, label: '相談内容メニュー反応' },
  menu_counseling_apply: { score: 30, label: '問い合わせ意向' },
  menu_counseling_faq: { score: 10, label: 'FAQ閲覧' },
  ai_chat_used: { score: 8, label: 'AI相談利用' },
};

const MENU_SCORE_BY_TEXT: Record<string, MoneyScoreEvent> = {
  講座について知りたい: 'menu_course_info',
  サービスについて知りたい: 'menu_course_info',
  サービスを見る: 'menu_course_info',
  今日の講義: 'menu_today_lesson',
  導入事例を見たい: 'menu_today_lesson',
  導入事例: 'menu_today_lesson',
  ワークをする: 'menu_work',
  資料請求したい: 'menu_work',
  資料請求: 'menu_work',
  個別相談について知りたい: 'menu_counseling_info',
  相談内容を知りたい: 'menu_counseling_info',
  相談内容を見る: 'menu_counseling_info',
  無料相談に申し込みたい: 'menu_counseling_apply',
  開発相談をしたい: 'menu_counseling_apply',
  開発相談をする: 'menu_counseling_apply',
  問い合わせしたい: 'menu_counseling_apply',
  個別相談のFAQ: 'menu_counseling_faq',
  よくある質問を見る: 'menu_counseling_faq',
  'FAQを見る': 'menu_counseling_faq',
};

async function hasMoneyScore(db: D1Database, friendId: string, event: MoneyScoreEvent): Promise<boolean> {
  const row = await db
    .prepare(
      `SELECT 1
         FROM friend_scores
        WHERE friend_id = ?
          AND reason LIKE ?
        LIMIT 1`,
    )
    .bind(friendId, `${SCORE_REASON_PREFIX}${event}%`)
    .first();
  return Boolean(row);
}

async function applyLeadTemperatureTags(db: D1Database, friendId: string): Promise<void> {
  const score = await getFriendScore(db, friendId);
  if (score >= 25) {
    await addTagToFriend(db, friendId, MONEY_SCORE_TAGS.warm);
  }
  if (score >= 45) {
    await addTagToFriend(db, friendId, MONEY_SCORE_TAGS.hot);
  }
}

export async function addMoneyScoreOnce(
  db: D1Database,
  friendId: string,
  event: MoneyScoreEvent,
): Promise<{ applied: boolean; scoreChange: number }> {
  const config = SCORE_EVENTS[event];
  if (!config) return { applied: false, scoreChange: 0 };
  if (await hasMoneyScore(db, friendId, event)) {
    return { applied: false, scoreChange: 0 };
  }

  await addScore(db, {
    friendId,
    scoreChange: config.score,
    reason: `${SCORE_REASON_PREFIX}${event} | ${config.label}`,
  });

  if (event === 'ai_chat_used') {
    await addTagToFriend(db, friendId, MONEY_SCORE_TAGS.aiConsulted);
  }
  if (event === 'menu_counseling_apply') {
    await addTagToFriend(db, friendId, MONEY_SCORE_TAGS.counselingIntent);
  }
  await applyLeadTemperatureTags(db, friendId);

  return { applied: true, scoreChange: config.score };
}

export function moneyScoreEventForDiagnosisType(type: 'A' | 'B' | 'C'): MoneyScoreEvent {
  if (type === 'A') return 'diagnosis_type_a';
  if (type === 'B') return 'diagnosis_type_b';
  return 'diagnosis_type_c';
}

export function moneyScoreEventForMenuText(text: string): MoneyScoreEvent | null {
  return MENU_SCORE_BY_TEXT[text.trim()] ?? null;
}
