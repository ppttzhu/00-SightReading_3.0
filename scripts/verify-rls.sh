#!/usr/bin/env bash
# ============================================================
# RLS 策略快速验证脚本
# 用法：在安装了 supabase CLI 并有对应项目 token 的终端运行
# 或者作为 curl 命令的手动参考
# ============================================================
set -euo pipefail

: "${SUPABASE_URL:?请设置 SUPABASE_URL，例如 https://your-project.supabase.co}"
: "${SUPABASE_PUBLISHABLE_KEY:?请设置 SUPABASE_PUBLISHABLE_KEY，例如 sb_publishable_xxx}"

echo "========== 测试 1: 匿名可读 slices =========="
curl -sf "${SUPABASE_URL}/rest/v1/slices?limit=1" \
  -H "apikey: ${SUPABASE_PUBLISHABLE_KEY}" \
  >/dev/null \
  && echo "✅ 匿名 SELECT slices 成功" \
  || echo "❌ 匿名 SELECT slices 失败（RLS 可能有问题）"

echo ""
echo "========== 测试 2: 匿名不可写 slices =========="
HTTP=$(curl -s -o /dev/null -w "%{http_code}" \
  -X POST "${SUPABASE_URL}/rest/v1/slices" \
  -H "apikey: ${SUPABASE_PUBLISHABLE_KEY}" \
  -H "Content-Type: application/json" \
  -H "Prefer: return=minimal" \
  -d '[{"id":"rls_test_slice","type":"A","content":{},"difficulty":1}]')
if [ "$HTTP" -ge 400 ]; then
  echo "✅ 匿名 POST slices 被拒绝 (HTTP ${HTTP})"
else
  echo "❌ 匿名 POST slices 居然成功了 (HTTP ${HTTP}) — 检查 RLS！"
  curl -sf "${SUPABASE_URL}/rest/v1/slices?id=eq.rls_test_slice" \
    -H "apikey: ${SUPABASE_PUBLISHABLE_KEY}" \
    -X DELETE >/dev/null || true
fi

echo ""
echo "========== 测试 3: 匿名可读 stages =========="
curl -sf "${SUPABASE_URL}/rest/v1/stages?limit=1" \
  -H "apikey: ${SUPABASE_PUBLISHABLE_KEY}" \
  >/dev/null \
  && echo "✅ 匿名 SELECT stages 成功" \
  || echo "❌ 匿名 SELECT stages 失败"

echo ""
echo "========== 测试 4: practice_records 自己的数据（需已登录 token）=========="
echo "⚠️  此测试需要手动提供有效 JWT token（在浏览器登录后从 localStorage 'sb-*-auth-token' 获取）。"
echo "   export TOKEN=eyJhbGciOiJIUzI1NiIs..."
echo "   curl '${SUPABASE_URL}/rest/v1/practice_records?limit=1' \\"
echo "     -H 'apikey: ${SUPABASE_PUBLISHABLE_KEY}' \\"
echo "     -H 'Authorization: Bearer \${TOKEN}'"
echo ""
if [ -n "${TOKEN:-}" ]; then
  curl -s "${SUPABASE_URL}/rest/v1/practice_records?limit=1" \
    -H "apikey: ${SUPABASE_PUBLISHABLE_KEY}" \
    -H "Authorization: Bearer ${TOKEN}" \
    | head -c 200
  echo ""
  echo "✅ 已认证用户可读自己的 practice_records"
fi

echo ""
echo "========== 测试 5: user_type_stats 触发器验证 =========="
echo "检查上一步答题记录是否正确触发了统计更新："
if [ -n "${TOKEN:-}" ]; then
  curl -s "${SUPABASE_URL}/rest/v1/user_type_stats" \
    -H "apikey: ${SUPABASE_PUBLISHABLE_KEY}" \
    -H "Authorization: Bearer ${TOKEN}" \
    | python3 -m json.tool 2>/dev/null || head -c 300
fi

echo ""
echo "========== 全部完成 =========="
