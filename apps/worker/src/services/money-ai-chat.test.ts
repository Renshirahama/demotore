import { describe, expect, it, vi } from 'vitest';
import {
  buildMoneyAiInstructions,
  generateMoneyAiReply,
  shouldUseMoneyAiChat,
} from './money-ai-chat.js';

function friend(metadata: Record<string, unknown> = {}) {
  return {
    id: 'friend-1',
    line_user_id: 'U1',
    display_name: 'テスト太郎',
    picture_url: null,
    status_message: null,
    is_following: 1,
    user_id: null,
    ig_igsid: null,
    score: 0,
    last_ref_code: null,
    last_ref_at: null,
    line_account_id: 'acc-1',
    metadata: JSON.stringify(metadata),
    created_at: '2026-07-24T00:00:00.000+09:00',
    updated_at: '2026-07-24T00:00:00.000+09:00',
  } as never;
}

describe('money-ai-chat', () => {
  it('uses AI for explicit AI consultation prefix', () => {
    expect(
      shouldUseMoneyAiChat({
        friend: friend(),
        incomingText: 'AI相談: 社内に生成AIを入れるなら何から始めればいい？',
      }),
    ).toBe(true);
  });

  it('uses AI for diagnosed users asking company-service-related text', () => {
    expect(
      shouldUseMoneyAiChat({
        friend: friend({ money_diagnosis_type: 'A' }),
        incomingText: 'AI研修を相談したいです',
      }),
    ).toBe(true);
  });

  it('does not use AI for unrelated chat', () => {
    expect(
      shouldUseMoneyAiChat({
        friend: friend({ money_diagnosis_type: 'A' }),
        incomingText: '今日の天気は？',
      }),
    ).toBe(false);
  });

  it('includes diagnosis context in instructions', () => {
    const instructions = buildMoneyAiInstructions({
      friend: friend({
        money_diagnosis_type: 'C',
        money_diagnosis_label: '社内定着まで整える「AI研修・内製化支援タイプ」',
        money_stage: 'education_day_0',
      }),
      incomingText: 'AI人材が社内にいません',
    });

    expect(instructions).toContain('株式会社ZETTAi公式LINE');
    expect(instructions).toContain('AI研修・内製化支援タイプ');
    expect(instructions).toContain('education_day_0');
  });

  it('calls the Responses API and extracts output_text', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ output_text: 'まずは対象業務と相談目的を整理しましょう。' }),
    });
    vi.stubGlobal('fetch', fetchMock);

    const reply = await generateMoneyAiReply(
      { apiKey: 'sk-test', model: 'test-model' },
      {
        friend: friend({ money_diagnosis_type: 'A' }),
        incomingText: 'AI導入は何から始めればいい？',
      },
    );

    expect(reply).toBe('まずは対象業務と相談目的を整理しましょう。');
    expect(fetchMock).toHaveBeenCalledWith(
      'https://api.openai.com/v1/responses',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({ Authorization: 'Bearer sk-test' }),
      }),
    );

    vi.unstubAllGlobals();
  });
});
