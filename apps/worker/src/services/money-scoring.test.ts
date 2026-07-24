import { describe, expect, it } from 'vitest';
import {
  addMoneyScoreOnce,
  moneyScoreEventForDiagnosisType,
  moneyScoreEventForMenuText,
} from './money-scoring.js';

function makeDb() {
  const scores: Array<{ friend_id: string; score_change: number; reason: string | null }> = [];
  const friends = new Map<string, { score: number }>([['friend-1', { score: 0 }]]);
  const friendTags: Array<{ friend_id: string; tag_id: string }> = [];

  return {
    state: { scores, friends, friendTags },
    db: {
      prepare(sql: string) {
        return {
          bind(...args: unknown[]) {
            return {
              async first<T>() {
                if (sql.includes('FROM friend_scores') && sql.includes('reason LIKE')) {
                  const [friendId, pattern] = args as [string, string];
                  const prefix = pattern.replace('%', '');
                  const found = scores.find((s) => s.friend_id === friendId && (s.reason ?? '').startsWith(prefix));
                  return (found ? { 1: 1 } : null) as T | null;
                }
                if (sql.includes('SELECT score FROM friends')) {
                  const [friendId] = args as [string];
                  return ({ score: friends.get(friendId)?.score ?? 0 }) as T;
                }
                return null as T | null;
              },
              async run() {
                if (sql.includes('INSERT INTO friend_scores')) {
                  const [, friendId,, scoreChange, reason] = args as [string, string, string | null, number, string | null, string];
                  scores.push({ friend_id: friendId, score_change: scoreChange, reason });
                }
                if (sql.includes('UPDATE friends SET score = score +')) {
                  const [scoreChange,, friendId] = args as [number, string, string];
                  const row = friends.get(friendId) ?? { score: 0 };
                  row.score += scoreChange;
                  friends.set(friendId, row);
                }
                if (sql.includes('INSERT OR IGNORE INTO friend_tags')) {
                  const [friendId, tagId] = args as [string, string, string];
                  if (!friendTags.some((t) => t.friend_id === friendId && t.tag_id === tagId)) {
                    friendTags.push({ friend_id: friendId, tag_id: tagId });
                  }
                }
                return { success: true };
              },
            };
          },
        };
      },
    } as unknown as D1Database,
  };
}

describe('money-scoring', () => {
  it('maps diagnosis types to score events', () => {
    expect(moneyScoreEventForDiagnosisType('A')).toBe('diagnosis_type_a');
    expect(moneyScoreEventForDiagnosisType('B')).toBe('diagnosis_type_b');
    expect(moneyScoreEventForDiagnosisType('C')).toBe('diagnosis_type_c');
  });

  it('maps rich menu message text to score events', () => {
    expect(moneyScoreEventForMenuText('開発相談をする')).toBe('menu_counseling_apply');
    expect(moneyScoreEventForMenuText('関係ない')).toBeNull();
  });

  it('adds score only once per event and applies hot tag at threshold', async () => {
    const { db, state } = makeDb();

    const first = await addMoneyScoreOnce(db, 'friend-1', 'menu_counseling_apply');
    const second = await addMoneyScoreOnce(db, 'friend-1', 'menu_counseling_apply');
    await addMoneyScoreOnce(db, 'friend-1', 'diagnosis_type_c');

    expect(first).toEqual({ applied: true, scoreChange: 30 });
    expect(second).toEqual({ applied: false, scoreChange: 0 });
    expect(state.friends.get('friend-1')?.score).toBe(50);
    expect(state.friendTags).toContainEqual({ friend_id: 'friend-1', tag_id: 'tag-money-counseling-intent' });
    expect(state.friendTags).toContainEqual({ friend_id: 'friend-1', tag_id: 'tag-money-lead-warm' });
    expect(state.friendTags).toContainEqual({ friend_id: 'friend-1', tag_id: 'tag-money-lead-hot' });
  });
});
