-- ZETTAi official LINE seed for LINE Harness.
-- Safe to rerun: fixed IDs are upserted and scenario steps are rebuilt.

UPDATE line_accounts
SET login_channel_id = '2010827320',
    liff_id = '2010827320-GP2p6pPv',
    updated_at = strftime('%Y-%m-%dT%H:%M:%f', 'now', '+9 hours')
WHERE channel_id = '2010827092';

INSERT INTO tags (id, name, color, created_at) VALUES
  ('tag-money-status-new', 'ZETTAi:未診断', '#94A3B8', strftime('%Y-%m-%dT%H:%M:%f', 'now', '+9 hours')),
  ('tag-money-diagnosis-completed', 'ZETTAi:相談タイプ診断済み', '#10B981', strftime('%Y-%m-%dT%H:%M:%f', 'now', '+9 hours')),
  ('tag-money-type-a', '診断:A AI活用検討タイプ', '#38BDF8', strftime('%Y-%m-%dT%H:%M:%f', 'now', '+9 hours')),
  ('tag-money-type-b', '診断:B AI開発・実装相談タイプ', '#F59E0B', strftime('%Y-%m-%dT%H:%M:%f', 'now', '+9 hours')),
  ('tag-money-type-c', '診断:C AI研修・内製化支援タイプ', '#EF4444', strftime('%Y-%m-%dT%H:%M:%f', 'now', '+9 hours')),
  ('tag-money-status-education', 'ZETTAi:案内配信中', '#6366F1', strftime('%Y-%m-%dT%H:%M:%f', 'now', '+9 hours')),
  ('tag-money-status-counseling-offer', 'ZETTAi:相談案内中', '#EC4899', strftime('%Y-%m-%dT%H:%M:%f', 'now', '+9 hours')),
  ('tag-money-status-completed', 'ZETTAi:7日配信完了', '#22C55E', strftime('%Y-%m-%dT%H:%M:%f', 'now', '+9 hours')),
  ('tag-money-day1', 'ZETTAi:Day1到達', '#A78BFA', strftime('%Y-%m-%dT%H:%M:%f', 'now', '+9 hours')),
  ('tag-money-day5', 'ZETTAi:Day5相談案内到達', '#FB7185', strftime('%Y-%m-%dT%H:%M:%f', 'now', '+9 hours')),
  ('tag-money-day7', 'ZETTAi:Day7最終案内到達', '#16A34A', strftime('%Y-%m-%dT%H:%M:%f', 'now', '+9 hours')),
  ('tag-money-lead-warm', 'ZETTAi:相談確度 Warm', '#F97316', strftime('%Y-%m-%dT%H:%M:%f', 'now', '+9 hours')),
  ('tag-money-lead-hot', 'ZETTAi:相談確度 Hot', '#DC2626', strftime('%Y-%m-%dT%H:%M:%f', 'now', '+9 hours')),
  ('tag-money-ai-consulted', 'ZETTAi:AI相談済み', '#14B8A6', strftime('%Y-%m-%dT%H:%M:%f', 'now', '+9 hours')),
  ('tag-money-counseling-intent', 'ZETTAi:問い合わせ意向', '#BE123C', strftime('%Y-%m-%dT%H:%M:%f', 'now', '+9 hours'))
ON CONFLICT(id) DO UPDATE SET
  name = excluded.name,
  color = excluded.color;

INSERT INTO scenarios
  (id, name, description, trigger_type, trigger_tag_id, is_active, delivery_mode, line_account_id, created_at, updated_at)
VALUES
  ('scenario-money-intake-v1', 'ZETTAi公式LINE Day0: 友だち追加・相談タイプ診断案内', '友だち追加直後に相談タイプ診断フォームへ誘導する初回シナリオ', 'friend_add', NULL, 1, 'relative', (SELECT id FROM line_accounts WHERE channel_id = '2010827092'), strftime('%Y-%m-%dT%H:%M:%f', 'now', '+9 hours'), strftime('%Y-%m-%dT%H:%M:%f', 'now', '+9 hours')),
  ('scenario-money-education-7day-v1', 'ZETTAi公式LINE 旧共通7日シナリオ', '旧共通シナリオ。新規診断回答はA/B/C別シナリオへ振り分ける', 'manual', NULL, 0, 'absolute_time', (SELECT id FROM line_accounts WHERE channel_id = '2010827092'), strftime('%Y-%m-%dT%H:%M:%f', 'now', '+9 hours'), strftime('%Y-%m-%dT%H:%M:%f', 'now', '+9 hours')),
  ('scenario-money-education-7day-type-a-v1', 'ZETTAi公式LINE 7日間案内 A: AI活用検討', 'AI活用を検討中の方向け。課題整理と相談導線を重視する7日間配信', 'manual', NULL, 1, 'absolute_time', (SELECT id FROM line_accounts WHERE channel_id = '2010827092'), strftime('%Y-%m-%dT%H:%M:%f', 'now', '+9 hours'), strftime('%Y-%m-%dT%H:%M:%f', 'now', '+9 hours')),
  ('scenario-money-education-7day-type-b-v1', 'ZETTAi公式LINE 7日間案内 B: AI開発・実装相談', 'AIプロダクト・Web/iOS・業務システム開発の相談向け7日間配信', 'manual', NULL, 1, 'absolute_time', (SELECT id FROM line_accounts WHERE channel_id = '2010827092'), strftime('%Y-%m-%dT%H:%M:%f', 'now', '+9 hours'), strftime('%Y-%m-%dT%H:%M:%f', 'now', '+9 hours')),
  ('scenario-money-education-7day-type-c-v1', 'ZETTAi公式LINE 7日間案内 C: AI研修・内製化支援', 'AI研修・社内定着・内製化支援の相談向け7日間配信', 'manual', NULL, 1, 'absolute_time', (SELECT id FROM line_accounts WHERE channel_id = '2010827092'), strftime('%Y-%m-%dT%H:%M:%f', 'now', '+9 hours'), strftime('%Y-%m-%dT%H:%M:%f', 'now', '+9 hours'))
ON CONFLICT(id) DO UPDATE SET
  name = excluded.name,
  description = excluded.description,
  trigger_type = excluded.trigger_type,
  trigger_tag_id = excluded.trigger_tag_id,
  is_active = excluded.is_active,
  delivery_mode = excluded.delivery_mode,
  line_account_id = excluded.line_account_id,
  updated_at = strftime('%Y-%m-%dT%H:%M:%f', 'now', '+9 hours');

INSERT INTO forms
  (id, name, description, fields, on_submit_tag_id, on_submit_scenario_id,
   on_submit_message_type, on_submit_message_content, save_to_metadata, is_active,
   og_title, og_description, created_at, updated_at)
VALUES
  (
    'money-diagnosis-v1',
    'ZETTAi 相談タイプ診断',
    '3つの質問で、AI導入・開発・研修のどの相談が近いかを整理します。',
    '[{"name":"purpose","label":"Q1. LINE登録の目的","type":"radio","required":true,"options":["AI導入を相談したい","システム/アプリ開発を相談したい","AI研修について知りたい","会社/サービス資料がほしい","その他"]},{"name":"experience","label":"Q2. 現在の検討状況","type":"radio","required":true,"options":["情報収集中","課題はあるが未整理","具体的に検討中/予算あり"]},{"name":"pain","label":"Q3. 一番の悩み","type":"radio","required":true,"options":["何から始めるべきかわからない","社内にAI人材/開発人材がいない","既存業務にどう入れるか不安"]}]',
    'tag-money-diagnosis-completed',
    NULL,
    NULL,
    NULL,
    1,
    1,
    'ZETTAi 相談タイプ診断',
    '3問でAI導入・開発・研修の相談タイプを診断します。',
    strftime('%Y-%m-%dT%H:%M:%f', 'now', '+9 hours'),
    strftime('%Y-%m-%dT%H:%M:%f', 'now', '+9 hours')
  )
ON CONFLICT(id) DO UPDATE SET
  name = excluded.name,
  description = excluded.description,
  fields = excluded.fields,
  on_submit_tag_id = excluded.on_submit_tag_id,
  on_submit_scenario_id = excluded.on_submit_scenario_id,
  on_submit_message_type = excluded.on_submit_message_type,
  on_submit_message_content = excluded.on_submit_message_content,
  save_to_metadata = excluded.save_to_metadata,
  is_active = excluded.is_active,
  og_title = excluded.og_title,
  og_description = excluded.og_description,
  updated_at = strftime('%Y-%m-%dT%H:%M:%f', 'now', '+9 hours');

DELETE FROM scenario_steps
WHERE scenario_id IN (
  'scenario-money-intake-v1',
  'scenario-money-education-7day-v1',
  'scenario-money-education-7day-type-a-v1',
  'scenario-money-education-7day-type-b-v1',
  'scenario-money-education-7day-type-c-v1'
);

INSERT INTO scenario_steps
  (id, scenario_id, step_order, delay_minutes, message_type, message_content,
   offset_days, offset_minutes, delivery_time, on_reach_tag_id, created_at)
VALUES
  ('step-money-intake-day0', 'scenario-money-intake-v1', 1, 0, 'text', 'ZETTAi公式LINEへの友だち追加ありがとうございます。\n\nAI導入、システム開発、AI研修などのご相談内容に合わせて案内します。\n\nまずは3問の相談タイプ診断からお進みください。\nhttps://liff.line.me/2010827320-GP2p6pPv?page=form&id=money-diagnosis-v1', NULL, NULL, NULL, 'tag-money-status-new', strftime('%Y-%m-%dT%H:%M:%f', 'now', '+9 hours')),
  ('step-money-a-day1', 'scenario-money-education-7day-type-a-v1', 1, 0, 'text', '【Day1】AI導入は「何を使うか」より「どの業務を変えるか」から始めるのが重要です。\n\nまずは、問い合わせ対応、資料作成、営業支援、社内ナレッジ検索など、時間がかかっている業務を1つ洗い出してみてください。', 1, NULL, '10:00', 'tag-money-day1', strftime('%Y-%m-%dT%H:%M:%f', 'now', '+9 hours')),
  ('step-money-a-day2', 'scenario-money-education-7day-type-a-v1', 2, 0, 'text', '【Day2】AI活用の相談では、現状業務・課題・理想の状態が分かると話が早く進みます。\n\n完璧な要件書は不要です。「今ここに困っている」だけでも、導入可能性の整理はできます。', 2, NULL, '10:00', NULL, strftime('%Y-%m-%dT%H:%M:%f', 'now', '+9 hours')),
  ('step-money-a-day3', 'scenario-money-education-7day-type-a-v1', 3, 0, 'text', '【Day3】相談前ワーク\n\n1. AIで減らしたい作業\n2. 月にどれくらい時間がかかっているか\n3. 関わる部署\n4. 失敗したら困ること\n\nこの4つをメモしておくと、初回相談で具体的に話せます。', 3, NULL, '10:00', NULL, strftime('%Y-%m-%dT%H:%M:%f', 'now', '+9 hours')),
  ('step-money-a-day4', 'scenario-money-education-7day-type-a-v1', 4, 0, 'text', '【Day4】失敗しにくいAI導入の進め方\n\n1. 小さく試す\n2. 現場の業務に合わせる\n3. 運用ルールまで決める\n\nZETTAiでは、導入前の整理からPoC、実装、運用まで相談できます。', 4, NULL, '10:00', NULL, strftime('%Y-%m-%dT%H:%M:%f', 'now', '+9 hours')),
  ('step-money-a-day5', 'scenario-money-education-7day-type-a-v1', 5, 0, 'text', '【Day5】AI導入相談のご案内\n\n「何から始めるべきかわからない」段階でも相談可能です。\n\nAIで効率化できる業務、導入の優先順位、必要な開発範囲を整理したい方は「問い合わせしたい」と送ってください。', 5, NULL, '10:00', 'tag-money-day5', strftime('%Y-%m-%dT%H:%M:%f', 'now', '+9 hours')),
  ('step-money-a-day6', 'scenario-money-education-7day-type-a-v1', 6, 0, 'text', '【Day6】よくある質問\n\nQ. まだ要件が固まっていなくても相談できますか？\nA. できます。課題整理から対応可能です。\n\nQ. AIツール選定だけでも大丈夫ですか？\nA. 可能です。実装前の整理もご相談ください。', 6, NULL, '10:00', NULL, strftime('%Y-%m-%dT%H:%M:%f', 'now', '+9 hours')),
  ('step-money-a-day7', 'scenario-money-education-7day-type-a-v1', 7, 0, 'text', '【Day7】最終案内\n\nAI導入は、最初の課題設定で成果が大きく変わります。\n\n相談したい内容が少しでもあれば、このLINEで「問い合わせしたい」と送ってください。担当者への確認に進めます。', 7, NULL, '10:00', 'tag-money-day7', strftime('%Y-%m-%dT%H:%M:%f', 'now', '+9 hours')),
  ('step-money-b-day1', 'scenario-money-education-7day-type-b-v1', 1, 0, 'text', '【Day1】開発・実装相談では、最初に「誰のどんな課題を解決するか」を明確にします。\n\nWeb、iOS、AIプロダクト、業務システムなど、形にしたいアイデアがある場合は、目的と利用者を整理しましょう。', 1, NULL, '10:00', 'tag-money-day1', strftime('%Y-%m-%dT%H:%M:%f', 'now', '+9 hours')),
  ('step-money-b-day2', 'scenario-money-education-7day-type-b-v1', 2, 0, 'text', '【Day2】PoCで確認すべきこと\n\n・本当に使われるか\n・技術的に実現できるか\n・運用コストが合うか\n・本開発へ進む判断基準は何か\n\n小さく検証してから実装へ進むと失敗を減らせます。', 2, NULL, '10:00', NULL, strftime('%Y-%m-%dT%H:%M:%f', 'now', '+9 hours')),
  ('step-money-b-day3', 'scenario-money-education-7day-type-b-v1', 3, 0, 'text', '【Day3】開発相談前ワーク\n\n1. 作りたいもの\n2. 想定ユーザー\n3. 必須機能\n4. 希望時期\n5. 既存システムやデータの有無\n\nこの5つがあると、初回ヒアリングが具体的になります。', 3, NULL, '10:00', NULL, strftime('%Y-%m-%dT%H:%M:%f', 'now', '+9 hours')),
  ('step-money-b-day4', 'scenario-money-education-7day-type-b-v1', 4, 0, 'text', '【Day4】AI開発で重要な3点\n\n1. データの扱い\n2. 出力品質の確認方法\n3. リリース後の改善運用\n\n作って終わりではなく、運用しながら改善できる設計が重要です。', 4, NULL, '10:00', NULL, strftime('%Y-%m-%dT%H:%M:%f', 'now', '+9 hours')),
  ('step-money-b-day5', 'scenario-money-education-7day-type-b-v1', 5, 0, 'text', '【Day5】開発相談のご案内\n\nAIプロダクト、Webサービス、iOSアプリ、業務システムの企画・開発・運用について相談できます。\n\n具体化したい場合は「開発相談をする」と送ってください。', 5, NULL, '10:00', 'tag-money-day5', strftime('%Y-%m-%dT%H:%M:%f', 'now', '+9 hours')),
  ('step-money-b-day6', 'scenario-money-education-7day-type-b-v1', 6, 0, 'text', '【Day6】よくある質問\n\nQ. アイデア段階でも相談できますか？\nA. 可能です。要件整理から対応できます。\n\nQ. PoCだけ、本開発だけでも可能ですか？\nA. フェーズ単位の相談もできます。', 6, NULL, '10:00', NULL, strftime('%Y-%m-%dT%H:%M:%f', 'now', '+9 hours')),
  ('step-money-b-day7', 'scenario-money-education-7day-type-b-v1', 7, 0, 'text', '【Day7】最終案内\n\n開発は、最初の要件整理と優先順位決めでスピードが変わります。\n\n相談を進めたい場合は「開発相談をする」と送ってください。担当者確認へつなぎます。', 7, NULL, '10:00', 'tag-money-day7', strftime('%Y-%m-%dT%H:%M:%f', 'now', '+9 hours')),
  ('step-money-c-day1', 'scenario-money-education-7day-type-c-v1', 1, 0, 'text', '【Day1】AI研修は、ツールの使い方だけでなく「業務で使い続ける状態」を作ることが重要です。\n\nまずは、どの部署・どの職種にAI活用を広げたいかを整理しましょう。', 1, NULL, '10:00', 'tag-money-day1', strftime('%Y-%m-%dT%H:%M:%f', 'now', '+9 hours')),
  ('step-money-c-day2', 'scenario-money-education-7day-type-c-v1', 2, 0, 'text', '【Day2】研修で成果を出すには、参加者の業務に近い題材を使うことが大切です。\n\n一般的なAI講座より、社内の実務に合わせたワークにすると定着しやすくなります。', 2, NULL, '10:00', NULL, strftime('%Y-%m-%dT%H:%M:%f', 'now', '+9 hours')),
  ('step-money-c-day3', 'scenario-money-education-7day-type-c-v1', 3, 0, 'text', '【Day3】研修相談前ワーク\n\n1. 対象部署\n2. 参加人数\n3. 現在のAI利用状況\n4. 研修後にできるようにしたいこと\n\nこの4つを整理すると、研修設計が具体化します。', 3, NULL, '10:00', NULL, strftime('%Y-%m-%dT%H:%M:%f', 'now', '+9 hours')),
  ('step-money-c-day4', 'scenario-money-education-7day-type-c-v1', 4, 0, 'text', '【Day4】AIを社内定着させる3点\n\n1. 利用ルールを決める\n2. 実務テンプレートを作る\n3. 継続して質問できる場を用意する\n\n研修と運用支援をセットで考えると定着しやすくなります。', 4, NULL, '10:00', NULL, strftime('%Y-%m-%dT%H:%M:%f', 'now', '+9 hours')),
  ('step-money-c-day5', 'scenario-money-education-7day-type-c-v1', 5, 0, 'text', '【Day5】AI研修・内製化支援のご案内\n\n社員向けAI研修、業務活用ワーク、社内定着支援について相談できます。\n\n研修設計を相談したい場合は「AI研修について知りたい」と送ってください。', 5, NULL, '10:00', 'tag-money-day5', strftime('%Y-%m-%dT%H:%M:%f', 'now', '+9 hours')),
  ('step-money-c-day6', 'scenario-money-education-7day-type-c-v1', 6, 0, 'text', '【Day6】よくある質問\n\nQ. 初心者向け研修も可能ですか？\nA. 可能です。業務レベルに合わせて設計できます。\n\nQ. 研修後の運用も相談できますか？\nA. 可能です。ルール作りや定着支援も扱えます。', 6, NULL, '10:00', NULL, strftime('%Y-%m-%dT%H:%M:%f', 'now', '+9 hours')),
  ('step-money-c-day7', 'scenario-money-education-7day-type-c-v1', 7, 0, 'text', '【Day7】最終案内\n\nAI研修は、始める前に対象者・業務・ゴールを整理すると成果が出やすくなります。\n\n相談を進めたい場合は「AI研修について知りたい」と送ってください。', 7, NULL, '10:00', 'tag-money-day7', strftime('%Y-%m-%dT%H:%M:%f', 'now', '+9 hours'));

INSERT INTO rich_menu_groups
  (id, account_id, name, chat_bar_text, size, default_page_id, is_default_for_all, status, created_at, updated_at)
VALUES
  ('rich-money-before-diagnosis', (SELECT id FROM line_accounts WHERE channel_id = '2010827092'), 'ZETTAi 診断前メニュー', 'メニュー', 'large', 'rich-money-before-page', 1, 'draft', strftime('%Y-%m-%dT%H:%M:%f', 'now', '+9 hours'), strftime('%Y-%m-%dT%H:%M:%f', 'now', '+9 hours')),
  ('rich-money-learning', (SELECT id FROM line_accounts WHERE channel_id = '2010827092'), 'ZETTAi 案内中メニュー', 'メニュー', 'large', 'rich-money-learning-page', 0, 'draft', strftime('%Y-%m-%dT%H:%M:%f', 'now', '+9 hours'), strftime('%Y-%m-%dT%H:%M:%f', 'now', '+9 hours')),
  ('rich-money-counseling', (SELECT id FROM line_accounts WHERE channel_id = '2010827092'), 'ZETTAi 問い合わせメニュー', 'メニュー', 'large', 'rich-money-counseling-page', 0, 'draft', strftime('%Y-%m-%dT%H:%M:%f', 'now', '+9 hours'), strftime('%Y-%m-%dT%H:%M:%f', 'now', '+9 hours'))
ON CONFLICT(id) DO UPDATE SET
  name = excluded.name,
  chat_bar_text = excluded.chat_bar_text,
  size = excluded.size,
  default_page_id = excluded.default_page_id,
  is_default_for_all = excluded.is_default_for_all,
  updated_at = strftime('%Y-%m-%dT%H:%M:%f', 'now', '+9 hours');

INSERT INTO rich_menu_pages
  (id, group_id, order_index, name, alias_id, created_at, updated_at)
VALUES
  ('rich-money-before-page', 'rich-money-before-diagnosis', 0, '診断前', 'lhx-money-before-0', strftime('%Y-%m-%dT%H:%M:%f', 'now', '+9 hours'), strftime('%Y-%m-%dT%H:%M:%f', 'now', '+9 hours')),
  ('rich-money-learning-page', 'rich-money-learning', 0, '案内中', 'lhx-money-learning-0', strftime('%Y-%m-%dT%H:%M:%f', 'now', '+9 hours'), strftime('%Y-%m-%dT%H:%M:%f', 'now', '+9 hours')),
  ('rich-money-counseling-page', 'rich-money-counseling', 0, '問い合わせ', 'lhx-money-counseling-0', strftime('%Y-%m-%dT%H:%M:%f', 'now', '+9 hours'), strftime('%Y-%m-%dT%H:%M:%f', 'now', '+9 hours'))
ON CONFLICT(id) DO UPDATE SET
  name = excluded.name,
  alias_id = excluded.alias_id,
  updated_at = strftime('%Y-%m-%dT%H:%M:%f', 'now', '+9 hours');

DELETE FROM rich_menu_areas
WHERE page_id IN ('rich-money-before-page', 'rich-money-learning-page', 'rich-money-counseling-page');

INSERT INTO rich_menu_areas
  (id, page_id, bounds_x, bounds_y, bounds_width, bounds_height, action_type, action_data, created_at, updated_at)
VALUES
  ('area-money-before-diagnosis', 'rich-money-before-page', 0, 0, 2500, 843, 'uri', '{"type":"uri","label":"相談タイプ診断","uri":"https://liff.line.me/2010827320-GP2p6pPv?page=form&id=money-diagnosis-v1"}', strftime('%Y-%m-%dT%H:%M:%f', 'now', '+9 hours'), strftime('%Y-%m-%dT%H:%M:%f', 'now', '+9 hours')),
  ('area-money-before-info', 'rich-money-before-page', 0, 843, 2500, 843, 'message', '{"type":"message","label":"サービスを見る","text":"サービスを見る"}', strftime('%Y-%m-%dT%H:%M:%f', 'now', '+9 hours'), strftime('%Y-%m-%dT%H:%M:%f', 'now', '+9 hours')),
  ('area-money-learning-lesson', 'rich-money-learning-page', 0, 0, 1250, 843, 'message', '{"type":"message","label":"導入事例","text":"導入事例"}', strftime('%Y-%m-%dT%H:%M:%f', 'now', '+9 hours'), strftime('%Y-%m-%dT%H:%M:%f', 'now', '+9 hours')),
  ('area-money-learning-work', 'rich-money-learning-page', 1250, 0, 1250, 843, 'message', '{"type":"message","label":"資料請求","text":"資料請求"}', strftime('%Y-%m-%dT%H:%M:%f', 'now', '+9 hours'), strftime('%Y-%m-%dT%H:%M:%f', 'now', '+9 hours')),
  ('area-money-learning-counseling', 'rich-money-learning-page', 0, 843, 2500, 843, 'message', '{"type":"message","label":"相談内容を見る","text":"相談内容を見る"}', strftime('%Y-%m-%dT%H:%M:%f', 'now', '+9 hours'), strftime('%Y-%m-%dT%H:%M:%f', 'now', '+9 hours')),
  ('area-money-counseling-apply', 'rich-money-counseling-page', 0, 0, 2500, 843, 'message', '{"type":"message","label":"開発相談をする","text":"開発相談をする"}', strftime('%Y-%m-%dT%H:%M:%f', 'now', '+9 hours'), strftime('%Y-%m-%dT%H:%M:%f', 'now', '+9 hours')),
  ('area-money-counseling-faq', 'rich-money-counseling-page', 0, 843, 2500, 843, 'message', '{"type":"message","label":"FAQを見る","text":"FAQを見る"}', strftime('%Y-%m-%dT%H:%M:%f', 'now', '+9 hours'), strftime('%Y-%m-%dT%H:%M:%f', 'now', '+9 hours'));

INSERT INTO auto_replies
  (id, keyword, match_type, response_type, response_content, template_id, line_account_id, is_active, created_at)
VALUES
  ('autoreply-money-course-info', 'サービスを見る', 'exact', 'text', 'ZETTAiでは、AIコンサルティング・DX支援、Web/iOS/AIプロダクトの企画・開発・運用、AI研修について相談できます。\n\nまずは相談タイプ診断で、今の状況に近い案内を確認してください。\nhttps://liff.line.me/2010827320-GP2p6pPv?page=form&id=money-diagnosis-v1', NULL, (SELECT id FROM line_accounts WHERE channel_id = '2010827092'), 1, strftime('%Y-%m-%dT%H:%M:%f', 'now', '+9 hours')),
  ('autoreply-money-today-lesson', '導入事例', 'exact', 'text', '導入事例・実績については、担当者が相談内容に近い事例を確認して案内します。\n\nAI導入、開発、研修のどれに近いかを教えていただくとスムーズです。具体的に相談したい場合は「問い合わせしたい」と送ってください。', NULL, (SELECT id FROM line_accounts WHERE channel_id = '2010827092'), 1, strftime('%Y-%m-%dT%H:%M:%f', 'now', '+9 hours')),
  ('autoreply-money-work', '資料請求', 'exact', 'text', '資料請求ありがとうございます。\n\n必要な資料を確認するため、以下をこのLINEに送ってください。\n1. 会社名\n2. お名前\n3. 知りたい内容（AI導入 / 開発 / AI研修 / その他）\n\n担当者が確認して案内します。', NULL, (SELECT id FROM line_accounts WHERE channel_id = '2010827092'), 1, strftime('%Y-%m-%dT%H:%M:%f', 'now', '+9 hours')),
  ('autoreply-money-counseling-info', '相談内容を見る', 'exact', 'text', '相談できる内容です。\n\n・AI導入の課題整理\n・業務効率化や自動化の相談\n・Web/iOS/AIプロダクト開発\n・PoCやMVP開発\n・社員向けAI研修、内製化支援\n\n具体的に進めたい場合は「開発相談をする」と送ってください。', NULL, (SELECT id FROM line_accounts WHERE channel_id = '2010827092'), 1, strftime('%Y-%m-%dT%H:%M:%f', 'now', '+9 hours')),
  ('autoreply-money-counseling-apply', '開発相談をする', 'exact', 'text', '開発相談ありがとうございます。\n\n担当者確認のため、可能な範囲で以下を送ってください。\n1. 会社名\n2. 相談したい内容\n3. 希望時期\n4. 予算感があれば金額帯\n\n未定の項目は「未定」で大丈夫です。', NULL, (SELECT id FROM line_accounts WHERE channel_id = '2010827092'), 1, strftime('%Y-%m-%dT%H:%M:%f', 'now', '+9 hours')),
  ('autoreply-money-counseling-faq', 'FAQを見る', 'exact', 'text', 'よくある質問です。\n\nQ. 要件が固まっていなくても相談できますか？\nA. できます。課題整理から相談可能です。\n\nQ. AI研修だけでも依頼できますか？\nA. 可能です。対象者や業務に合わせて設計します。\n\nQ. 相談はどこから始めればいいですか？\nA. まずはこのLINEで相談内容を送ってください。', NULL, (SELECT id FROM line_accounts WHERE channel_id = '2010827092'), 1, strftime('%Y-%m-%dT%H:%M:%f', 'now', '+9 hours')),
  ('autoreply-zettai-training-info', 'AI研修について知りたい', 'exact', 'text', 'AI研修についてのご相談ありがとうございます。\n\n社員向けの基礎研修、業務活用ワーク、AIコーディング・開発寄りの研修、社内定着支援などを相談できます。\n\n対象者・人数・実施したい時期が分かれば、このLINEに送ってください。', NULL, (SELECT id FROM line_accounts WHERE channel_id = '2010827092'), 1, strftime('%Y-%m-%dT%H:%M:%f', 'now', '+9 hours')),
  ('autoreply-zettai-contact-info', '問い合わせしたい', 'exact', 'text', 'お問い合わせありがとうございます。\n\n担当者確認のため、以下を送ってください。\n1. 会社名\n2. お名前\n3. 相談内容\n4. 連絡先メールアドレス\n\n内容を確認して折り返し案内します。', NULL, (SELECT id FROM line_accounts WHERE channel_id = '2010827092'), 1, strftime('%Y-%m-%dT%H:%M:%f', 'now', '+9 hours'))
ON CONFLICT(id) DO UPDATE SET
  keyword = excluded.keyword,
  match_type = excluded.match_type,
  response_type = excluded.response_type,
  response_content = excluded.response_content,
  template_id = excluded.template_id,
  line_account_id = excluded.line_account_id,
  is_active = excluded.is_active;

UPDATE scenario_steps
SET message_content = replace(message_content, char(92) || 'n', char(10))
WHERE scenario_id IN (
  'scenario-money-intake-v1',
  'scenario-money-education-7day-v1',
  'scenario-money-education-7day-type-a-v1',
  'scenario-money-education-7day-type-b-v1',
  'scenario-money-education-7day-type-c-v1'
);

UPDATE auto_replies
SET response_content = replace(response_content, char(92) || 'n', char(10))
WHERE id LIKE 'autoreply-money-%'
   OR id LIKE 'autoreply-zettai-%';

UPDATE auto_replies
SET response_type = 'flex',
    response_content = '{"type":"bubble","size":"mega","header":{"type":"box","layout":"vertical","paddingAll":"18px","backgroundColor":"#0f172a","contents":[{"type":"text","text":"ZETTAi Services","size":"xs","color":"#93c5fd","weight":"bold"},{"type":"text","text":"サービスを見る","size":"xl","color":"#ffffff","weight":"bold","margin":"sm"}]},"body":{"type":"box","layout":"vertical","paddingAll":"20px","spacing":"md","contents":[{"type":"text","text":"AIコンサルティング・DX支援、Web/iOS/AIプロダクト開発、AI研修まで相談できます。","wrap":true,"size":"sm","color":"#111827"},{"type":"separator","margin":"md"},{"type":"box","layout":"vertical","spacing":"sm","contents":[{"type":"text","text":"相談できること","size":"xs","color":"#64748b","weight":"bold"},{"type":"text","text":"・AI導入の課題整理\n・業務効率化、自動化\n・Web/iOS/AI開発\n・社員向けAI研修","wrap":true,"size":"sm","color":"#334155"}]}]},"footer":{"type":"box","layout":"vertical","spacing":"sm","contents":[{"type":"button","style":"primary","color":"#2563eb","action":{"type":"message","label":"相談タイプ診断","text":"相談タイプ診断"}},{"type":"button","style":"secondary","action":{"type":"message","label":"問い合わせしたい","text":"問い合わせしたい"}}]}}'
WHERE id = 'autoreply-money-course-info';

UPDATE auto_replies
SET response_type = 'flex',
    response_content = '{"type":"bubble","size":"mega","header":{"type":"box","layout":"vertical","paddingAll":"18px","backgroundColor":"#1d4ed8","contents":[{"type":"text","text":"Use Cases","size":"xs","color":"#bfdbfe","weight":"bold"},{"type":"text","text":"導入事例","size":"xl","color":"#ffffff","weight":"bold","margin":"sm"}]},"body":{"type":"box","layout":"vertical","paddingAll":"20px","spacing":"md","contents":[{"type":"text","text":"相談内容に近い事例や実績は、担当者が確認して案内します。","wrap":true,"size":"sm","color":"#111827"},{"type":"box","layout":"vertical","spacing":"sm","paddingAll":"14px","backgroundColor":"#f8fafc","contents":[{"type":"text","text":"事前に送ると早い情報","size":"xs","color":"#64748b","weight":"bold"},{"type":"text","text":"会社名 / 業種 / AI導入・開発・研修のどれに近いか / 相談したい課題","wrap":true,"size":"sm","color":"#334155"}]}]},"footer":{"type":"box","layout":"vertical","spacing":"sm","contents":[{"type":"button","style":"primary","color":"#2563eb","action":{"type":"message","label":"問い合わせしたい","text":"問い合わせしたい"}},{"type":"button","style":"secondary","action":{"type":"message","label":"相談内容を見る","text":"相談内容を見る"}}]}}'
WHERE id = 'autoreply-money-today-lesson';

UPDATE auto_replies
SET response_type = 'flex',
    response_content = '{"type":"bubble","size":"mega","header":{"type":"box","layout":"vertical","paddingAll":"18px","backgroundColor":"#92400e","contents":[{"type":"text","text":"Document Request","size":"xs","color":"#fde68a","weight":"bold"},{"type":"text","text":"資料請求","size":"xl","color":"#ffffff","weight":"bold","margin":"sm"}]},"body":{"type":"box","layout":"vertical","paddingAll":"20px","spacing":"md","contents":[{"type":"text","text":"必要な資料を確認するため、以下をこのLINEに送ってください。","wrap":true,"size":"sm","color":"#111827"},{"type":"box","layout":"vertical","spacing":"sm","paddingAll":"14px","backgroundColor":"#fffbeb","contents":[{"type":"text","text":"送ってほしい内容","size":"xs","color":"#92400e","weight":"bold"},{"type":"text","text":"1. 会社名\n2. お名前\n3. 知りたい内容\n4. 連絡先メールアドレス","wrap":true,"size":"sm","color":"#334155"}]}]},"footer":{"type":"box","layout":"vertical","contents":[{"type":"button","style":"primary","color":"#d97706","action":{"type":"message","label":"問い合わせしたい","text":"問い合わせしたい"}}]}}'
WHERE id = 'autoreply-money-work';

UPDATE auto_replies
SET response_type = 'flex',
    response_content = '{"type":"bubble","size":"mega","header":{"type":"box","layout":"vertical","paddingAll":"18px","backgroundColor":"#047857","contents":[{"type":"text","text":"Consultation Menu","size":"xs","color":"#a7f3d0","weight":"bold"},{"type":"text","text":"相談内容を見る","size":"xl","color":"#ffffff","weight":"bold","margin":"sm"}]},"body":{"type":"box","layout":"vertical","paddingAll":"20px","spacing":"md","contents":[{"type":"text","text":"ZETTAiに相談できる主な内容です。","wrap":true,"size":"sm","color":"#111827"},{"type":"box","layout":"vertical","spacing":"sm","contents":[{"type":"text","text":"AI導入 / 業務改善 / 自動化 / Web・iOS開発 / AIプロダクト / PoC・MVP / AI研修・内製化支援","wrap":true,"size":"sm","color":"#334155"}]}]},"footer":{"type":"box","layout":"vertical","spacing":"sm","contents":[{"type":"button","style":"primary","color":"#059669","action":{"type":"message","label":"開発相談をする","text":"開発相談をする"}},{"type":"button","style":"secondary","action":{"type":"message","label":"AI研修について","text":"AI研修について知りたい"}}]}}'
WHERE id = 'autoreply-money-counseling-info';

UPDATE auto_replies
SET response_type = 'flex',
    response_content = '{"type":"bubble","size":"mega","header":{"type":"box","layout":"vertical","paddingAll":"18px","backgroundColor":"#991b1b","contents":[{"type":"text","text":"Development Consultation","size":"xs","color":"#fecaca","weight":"bold"},{"type":"text","text":"開発相談をする","size":"xl","color":"#ffffff","weight":"bold","margin":"sm"}]},"body":{"type":"box","layout":"vertical","paddingAll":"20px","spacing":"md","contents":[{"type":"text","text":"担当者確認のため、可能な範囲で以下を送ってください。未定の項目は「未定」で大丈夫です。","wrap":true,"size":"sm","color":"#111827"},{"type":"box","layout":"vertical","spacing":"sm","paddingAll":"14px","backgroundColor":"#fef2f2","contents":[{"type":"text","text":"送ってほしい内容","size":"xs","color":"#991b1b","weight":"bold"},{"type":"text","text":"1. 会社名\n2. 相談したい内容\n3. 希望時期\n4. 予算感があれば金額帯","wrap":true,"size":"sm","color":"#334155"}]}]},"footer":{"type":"box","layout":"vertical","contents":[{"type":"button","style":"primary","color":"#dc2626","action":{"type":"message","label":"問い合わせしたい","text":"問い合わせしたい"}}]}}'
WHERE id = 'autoreply-money-counseling-apply';

UPDATE auto_replies
SET response_type = 'flex',
    response_content = '{"type":"bubble","size":"mega","header":{"type":"box","layout":"vertical","paddingAll":"18px","backgroundColor":"#334155","contents":[{"type":"text","text":"FAQ","size":"xs","color":"#cbd5e1","weight":"bold"},{"type":"text","text":"FAQを見る","size":"xl","color":"#ffffff","weight":"bold","margin":"sm"}]},"body":{"type":"box","layout":"vertical","paddingAll":"20px","spacing":"md","contents":[{"type":"box","layout":"vertical","spacing":"xs","contents":[{"type":"text","text":"Q. 要件が固まっていなくても相談できますか？","wrap":true,"size":"sm","weight":"bold","color":"#111827"},{"type":"text","text":"A. できます。課題整理から相談可能です。","wrap":true,"size":"sm","color":"#475569"}]},{"type":"separator"},{"type":"box","layout":"vertical","spacing":"xs","contents":[{"type":"text","text":"Q. AI研修だけでも依頼できますか？","wrap":true,"size":"sm","weight":"bold","color":"#111827"},{"type":"text","text":"A. 可能です。対象者や業務に合わせて設計します。","wrap":true,"size":"sm","color":"#475569"}]}]},"footer":{"type":"box","layout":"vertical","contents":[{"type":"button","style":"primary","color":"#475569","action":{"type":"message","label":"相談内容を見る","text":"相談内容を見る"}}]}}'
WHERE id = 'autoreply-money-counseling-faq';
