// 檢查資料檔格式：node tools/validate.mjs
// 每次新增或修改辯論、查核後執行，確保格式正確、每筆查核都有來源。
import { readFileSync } from "node:fs";

const VERDICTS = ["correct", "partly", "incorrect", "unverifiable"];
const errors = [];
const err = (file, msg) => errors.push(`${file}: ${msg}`);

const index = JSON.parse(readFileSync("data/index.json", "utf8"));
for (const entry of index.debates) {
  const f = entry.file;
  let d;
  try {
    d = JSON.parse(readFileSync(f, "utf8"));
  } catch (e) {
    err(f, `無法讀取或 JSON 格式錯誤：${e.message}`);
    continue;
  }
  if (d.id !== entry.id) err(f, `id「${d.id}」與 index.json 的「${entry.id}」不一致`);
  const cands = new Set((d.candidates ?? []).map((c) => c.id));
  const sections = new Set((d.sections ?? []).map((s) => s.id));
  const utts = new Map();
  for (const u of d.utterances ?? []) {
    if (utts.has(u.id)) err(f, `發言 id 重複：${u.id}`);
    utts.set(u.id, u);
    if (!cands.has(u.speaker) && u.speaker !== "press") err(f, `發言 ${u.id} 的 speaker「${u.speaker}」不在 candidates（媒體提問請用 "press"）`);
    if (!sections.has(u.section)) err(f, `發言 ${u.id} 的 section「${u.section}」不在 sections`);
    if (!u.text) err(f, `發言 ${u.id} 沒有 text`);
  }
  const claimIds = new Set();
  for (const c of d.claims ?? []) {
    if (claimIds.has(c.id)) err(f, `查核 id 重複：${c.id}`);
    claimIds.add(c.id);
    const u = utts.get(c.utteranceId);
    if (!cands.has(c.speaker)) err(f, `查核 ${c.id} 的 speaker 必須是候選人`);
    if (!u) err(f, `查核 ${c.id} 對應的發言「${c.utteranceId}」不存在`);
    else {
      if (u.speaker !== c.speaker) err(f, `查核 ${c.id} 的 speaker 與發言不一致`);
      if (!u.text.includes(c.quote)) err(f, `查核 ${c.id} 的 quote 不在發言原文中：「${c.quote}」`);
    }
    if (!VERDICTS.includes(c.verdict)) err(f, `查核 ${c.id} 的 verdict「${c.verdict}」不合法（可用：${VERDICTS.join("、")}）`);
    for (const k of ["summary", "analysis"]) if (!c[k]) err(f, `查核 ${c.id} 缺少 ${k}`);
    if (!c.sources?.length) err(f, `查核 ${c.id} 沒有任何來源（每筆查核至少要一個公開來源）`);
    for (const s of c.sources ?? []) {
      if (!/^https?:\/\//.test(s.url ?? "")) err(f, `查核 ${c.id} 的來源網址不合法：${s.url}`);
    }
    if (c.cost && !c.cost.estimate) err(f, `查核 ${c.id} 的 cost 缺少 estimate（不涉及費用請設為 null）`);
    if (c.checkedAt && !/^\d{4}-\d{2}-\d{2}$/.test(c.checkedAt)) err(f, `查核 ${c.id} 的 checkedAt 格式應為 YYYY-MM-DD`);
    if (d.isSample !== true && c.sample) err(f, `非範例的辯論中不應有範例查核：${c.id}`);
  }
  // 公正性提醒：列出每位候選人的查核數，差距過大時提示
  const counts = [...cands].map((id) => [id, (d.claims ?? []).filter((c) => c.speaker === id).length]);
  console.log(`${f}：` + counts.map(([id, n]) => `${id} ${n} 筆`).join("、"));
  const ns = counts.map(([, n]) => n);
  if (Math.max(...ns) - Math.min(...ns) > 2) {
    console.warn(`  提醒：各候選人的查核筆數差距較大，請確認選題標準一致。`);
  }
}

if (errors.length) {
  console.error(`\n發現 ${errors.length} 個問題：`);
  for (const e of errors) console.error(`- ${e}`);
  process.exit(1);
}
console.log("資料格式檢查通過。");
