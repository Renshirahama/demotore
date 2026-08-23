import { describe, expect, it } from 'vitest';
import { mergeFriendMetadata, parseFriendMetadata } from './friend-metadata.js';

describe('friend metadata helpers', () => {
  it('parses valid object metadata', () => {
    expect(parseFriendMetadata('{"plan":"gold","score":10}')).toEqual({
      plan: 'gold',
      score: 10,
    });
  });

  it('treats invalid JSON as an empty object', () => {
    expect(parseFriendMetadata('{not json')).toEqual({});
  });

  it('treats non-object JSON as an empty object', () => {
    expect(parseFriendMetadata('["gold"]')).toEqual({});
    expect(parseFriendMetadata('null')).toEqual({});
  });

  it('merges patches on top of parsed metadata', () => {
    expect(mergeFriendMetadata('{"plan":"free","keep":true}', { plan: 'gold' })).toEqual({
      plan: 'gold',
      keep: true,
    });
  });

  it('merges patches even when stored metadata is corrupt', () => {
    expect(mergeFriendMetadata('{not json', { plan: 'gold' })).toEqual({ plan: 'gold' });
  });
});
