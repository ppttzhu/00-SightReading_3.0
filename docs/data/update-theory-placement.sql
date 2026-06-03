-- ============================================================
-- 更新旧格式 theory 题目为新格式 IntervalContent
-- ============================================================

-- manual_C_1778863602450_C4,G4|纯五度 (P5)
UPDATE public.quizzes
SET content = '{"noteA":"C4","noteB":"G4","theory":"纯五度 (P5)","placement":"treble","raw":"C4,G4|纯五度 (P5)"}'::jsonb
WHERE id = 'manual_C_1778863602450_C4,G4|纯五度 (P5)' AND module = 'theory';

-- manual_C_1778863612073_C#2,D2|小二度 (m2)
UPDATE public.quizzes
SET content = '{"noteA":"C#2","noteB":"D2","theory":"小二度 (m2)","placement":"bass","raw":"C#2,D2|小二度 (m2)"}'::jsonb
WHERE id = 'manual_C_1778863612073_C#2,D2|小二度 (m2)' AND module = 'theory';

-- manual_C_1779198394646_C4,C4|纯一度 (P1)
UPDATE public.quizzes
SET content = '{"noteA":"C4","noteB":"C4","theory":"纯一度 (P1)","placement":"treble","raw":"C4,C4|纯一度 (P1)"}'::jsonb
WHERE id = 'manual_C_1779198394646_C4,C4|纯一度 (P1)' AND module = 'theory';

-- manual_C_1779198412970_G4,G4|纯一度 (P1)
UPDATE public.quizzes
SET content = '{"noteA":"G4","noteB":"G4","theory":"纯一度 (P1)","placement":"treble","raw":"G4,G4|纯一度 (P1)"}'::jsonb
WHERE id = 'manual_C_1779198412970_G4,G4|纯一度 (P1)' AND module = 'theory';

-- manual_C_1779198440540_F3,F3|纯一度 (P1)
UPDATE public.quizzes
SET content = '{"noteA":"F3","noteB":"F3","theory":"纯一度 (P1)","placement":"bass","raw":"F3,F3|纯一度 (P1)"}'::jsonb
WHERE id = 'manual_C_1779198440540_F3,F3|纯一度 (P1)' AND module = 'theory';

-- manual_C_1779198465150_C4,E4|大三度 (M3)
UPDATE public.quizzes
SET content = '{"noteA":"C4","noteB":"E4","theory":"大三度 (M3)","placement":"treble","raw":"C4,E4|大三度 (M3)"}'::jsonb
WHERE id = 'manual_C_1779198465150_C4,E4|大三度 (M3)' AND module = 'theory';

-- manual_C_1779198515455_F3,A3|大三度 (M3)
UPDATE public.quizzes
SET content = '{"noteA":"F3","noteB":"A3","theory":"大三度 (M3)","placement":"bass","raw":"F3,A3|大三度 (M3)"}'::jsonb
WHERE id = 'manual_C_1779198515455_F3,A3|大三度 (M3)' AND module = 'theory';

-- manual_C_1779198525332_G4,B4|大三度 (M3)
UPDATE public.quizzes
SET content = '{"noteA":"G4","noteB":"B4","theory":"大三度 (M3)","placement":"treble","raw":"G4,B4|大三度 (M3)"}'::jsonb
WHERE id = 'manual_C_1779198525332_G4,B4|大三度 (M3)' AND module = 'theory';


-- ============================================================
-- 插入新格式 theory 题目 (如果不存在)
-- ============================================================

INSERT INTO public.quizzes (id, module, content, difficulty, del_status)
VALUES ('manual_C_1778863602450_C4,G4|纯五度 (P5)', 'theory', '{"noteA":"C4","noteB":"G4","theory":"纯五度 (P5)","placement":"treble","raw":"C4,G4|纯五度 (P5)"}'::jsonb, 1, false)
ON CONFLICT (id) DO UPDATE SET content = EXCLUDED.content, difficulty = EXCLUDED.difficulty;

INSERT INTO public.quizzes (id, module, content, difficulty, del_status)
VALUES ('manual_C_1778863612073_C#2,D2|小二度 (m2)', 'theory', '{"noteA":"C#2","noteB":"D2","theory":"小二度 (m2)","placement":"bass","raw":"C#2,D2|小二度 (m2)"}'::jsonb, 1, false)
ON CONFLICT (id) DO UPDATE SET content = EXCLUDED.content, difficulty = EXCLUDED.difficulty;

INSERT INTO public.quizzes (id, module, content, difficulty, del_status)
VALUES ('manual_C_1779198394646_C4,C4|纯一度 (P1)', 'theory', '{"noteA":"C4","noteB":"C4","theory":"纯一度 (P1)","placement":"treble","raw":"C4,C4|纯一度 (P1)"}'::jsonb, 1, false)
ON CONFLICT (id) DO UPDATE SET content = EXCLUDED.content, difficulty = EXCLUDED.difficulty;

INSERT INTO public.quizzes (id, module, content, difficulty, del_status)
VALUES ('manual_C_1779198412970_G4,G4|纯一度 (P1)', 'theory', '{"noteA":"G4","noteB":"G4","theory":"纯一度 (P1)","placement":"treble","raw":"G4,G4|纯一度 (P1)"}'::jsonb, 1, false)
ON CONFLICT (id) DO UPDATE SET content = EXCLUDED.content, difficulty = EXCLUDED.difficulty;

INSERT INTO public.quizzes (id, module, content, difficulty, del_status)
VALUES ('manual_C_1779198440540_F3,F3|纯一度 (P1)', 'theory', '{"noteA":"F3","noteB":"F3","theory":"纯一度 (P1)","placement":"bass","raw":"F3,F3|纯一度 (P1)"}'::jsonb, 1, false)
ON CONFLICT (id) DO UPDATE SET content = EXCLUDED.content, difficulty = EXCLUDED.difficulty;

INSERT INTO public.quizzes (id, module, content, difficulty, del_status)
VALUES ('manual_C_1779198465150_C4,E4|大三度 (M3)', 'theory', '{"noteA":"C4","noteB":"E4","theory":"大三度 (M3)","placement":"treble","raw":"C4,E4|大三度 (M3)"}'::jsonb, 1, false)
ON CONFLICT (id) DO UPDATE SET content = EXCLUDED.content, difficulty = EXCLUDED.difficulty;

INSERT INTO public.quizzes (id, module, content, difficulty, del_status)
VALUES ('manual_C_1779198515455_F3,A3|大三度 (M3)', 'theory', '{"noteA":"F3","noteB":"A3","theory":"大三度 (M3)","placement":"bass","raw":"F3,A3|大三度 (M3)"}'::jsonb, 1, false)
ON CONFLICT (id) DO UPDATE SET content = EXCLUDED.content, difficulty = EXCLUDED.difficulty;

INSERT INTO public.quizzes (id, module, content, difficulty, del_status)
VALUES ('manual_C_1779198525332_G4,B4|大三度 (M3)', 'theory', '{"noteA":"G4","noteB":"B4","theory":"大三度 (M3)","placement":"treble","raw":"G4,B4|大三度 (M3)"}'::jsonb, 1, false)
ON CONFLICT (id) DO UPDATE SET content = EXCLUDED.content, difficulty = EXCLUDED.difficulty;

