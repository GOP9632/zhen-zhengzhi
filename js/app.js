// 真政治：辯論逐字稿與查核
// 資料來源：data/index.json 列出所有辯論，每場辯論一個 JSON 檔（格式見 README）。
// 逐字稿的每一句都可以點開：已查核的句子顯示查核內容，其餘顯示「尚未查核」。

const VERDICTS = {
  correct: "正確",
  partly: "部分正確",
  incorrect: "錯誤",
  unverifiable: "無法查證",
};
const UNCHECKED = "尚未查核";

// 讀者建議查核的管道（GitHub Issues）。換成公開 repo 或表單時改這裡。
const SUGGEST_URL = "https://github.com/GOP9632/zhen-zhengzhi/issues/new";

const state = {
  debate: null,
  order: [], // 候選人顯示順序（id 陣列）
  filter: "all",
  sentences: [], // 所有候選人句子（用於統計）
};

const $ = (sel) => document.querySelector(sel);

function el(tag, attrs = {}, children = []) {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v === undefined || v === null || v === false) continue;
    if (k === "class") node.className = v;
    else if (k === "text") node.textContent = v;
    else if (k.startsWith("on")) node.addEventListener(k.slice(2), v);
    else node.setAttribute(k, v === true ? "" : v);
  }
  for (const c of [].concat(children)) {
    if (c === null || c === undefined) continue;
    node.append(c instanceof Node ? c : document.createTextNode(String(c)));
  }
  return node;
}

function verdictBadge(v) {
  return el("span", { class: `verdict verdict-${v ?? "unchecked"}`, text: VERDICTS[v] ?? UNCHECKED });
}

function safeUrl(url) {
  try {
    const u = new URL(url);
    return u.protocol === "https:" || u.protocol === "http:" ? u.href : null;
  } catch {
    return null;
  }
}

function sourceList(sources) {
  if (!sources?.length) return el("p", { class: "muted", text: "尚無來源。" });
  return el(
    "ul",
    { class: "source-list" },
    sources.map((s) => {
      const href = safeUrl(s.url);
      return el("li", {}, [
        href ? el("a", { href, target: "_blank", rel: "noopener noreferrer", text: s.title }) : s.title,
        s.publisher ? el("span", { class: "muted", text: ` · ${s.publisher}` }) : null,
      ]);
    })
  );
}

async function loadJSON(path) {
  const res = await fetch(path, { cache: "no-cache" });
  if (!res.ok) throw new Error(`無法載入 ${path}（${res.status}）`);
  return res.json();
}

// 把一段發言切成句子，保留每句在原文中的起訖位置
function splitSentences(text) {
  const out = [];
  const re = /[^。！？!?\n]+(?:[。！？!?]+[」』）)]*)?|\n+/g;
  let m;
  while ((m = re.exec(text))) {
    if (m[0].startsWith("\n")) {
      out.push({ br: true });
      continue;
    }
    const raw = m[0];
    const lead = raw.length - raw.trimStart().length;
    const t = raw.trim();
    if (!t) continue;
    out.push({ text: t, start: m.index + lead, end: m.index + lead + t.length });
  }
  return out;
}

async function init() {
  try {
    const index = await loadJSON("data/index.json");
    const select = $("#debate-select");
    for (const d of index.debates) {
      select.append(el("option", { value: d.file, text: `${d.date} ${d.title}` }));
    }
    if (index.debates.length > 1) $(".debate-picker").hidden = false;
    select.addEventListener("change", () => loadDebate(select.value));

    $("#swap-btn").addEventListener("click", () => {
      state.order.reverse();
      renderTranscript();
    });
    $("#verdict-filter").addEventListener("change", (e) => {
      state.filter = e.target.value;
      renderTranscript();
    });

    const fromHash = index.debates.find((d) => `#${d.id}` === location.hash);
    const first = fromHash ?? index.debates[0];
    if (first) {
      select.value = first.file;
      await loadDebate(first.file);
    }
  } catch (err) {
    $("#debate-title").textContent = "資料載入失敗";
    $("#debate-meta").textContent = `${err.message}。若是直接用瀏覽器打開檔案，請改用本機伺服器（見 README）。`;
  }
}

async function loadDebate(file) {
  const debate = await loadJSON(file);
  state.debate = debate;
  state.order = debate.candidates.map((c) => c.id);
  renderHeader();
  renderTranscript();
}

function candidate(id) {
  return state.debate.candidates.find((c) => c.id === id);
}

function renderHeader() {
  const d = state.debate;
  $("#debate-title").textContent = d.title;
  $("#debate-meta").textContent = `${d.date} · ${d.candidates.map((c) => `${c.name}（${c.party}）`).join("、")}`;
  $("#debate-format").textContent = d.format ?? "";

  const banner = $("#sample-banner");
  if (d.isSample) {
    banner.className = "sample-banner";
    banner.replaceChildren(el("strong", { text: "範例資料　" }), d.sampleNote ?? "");
  } else {
    banner.className = "note-banner";
    banner.replaceChildren(el("strong", { text: "逐字稿來源　" }), d.transcriptNote ?? "");
  }
  banner.hidden = !(d.isSample ? d.sampleNote : d.transcriptNote);

  $("#debate-sources").replaceChildren(el("h3", { text: "辯論公開來源" }), sourceList(d.debateSources));
}

function renderSummary() {
  const d = state.debate;
  const cols = [...Object.values(VERDICTS), UNCHECKED];
  const table = el("table", { class: "summary-table" });
  table.append(el("thead", {}, el("tr", {}, [el("th", { text: "候選人" }), el("th", { text: "總句數" }), ...cols.map((v) => el("th", { text: v }))])));
  const body = el("tbody");
  for (const id of state.order) {
    const mine = state.sentences.filter((s) => s.speaker === id);
    const count = (v) => mine.filter((s) => (s.claim?.verdict ?? null) === v).length;
    body.append(
      el("tr", {}, [
        el("th", { scope: "row", text: candidate(id).name }),
        el("td", { text: mine.length }),
        ...Object.keys(VERDICTS).map((v) => el("td", { text: count(v) })),
        el("td", { text: count(null) }),
      ])
    );
  }
  table.append(body);
  $("#summary").replaceChildren(
    el("h3", { text: "查核進度" }),
    el("div", { class: "table-scroll" }, table),
    el("p", { class: "muted", text: "每一句都可以點開。已查核的句子依同一套標準挑選（含具體數字或可用公開資料驗證的事實陳述），其餘陸續補上。統計不代表候選人整體誠信。" })
  );
}

function renderUtterance(u) {
  const d = state.debate;
  const claims = d.claims.filter((c) => c.utteranceId === u.id);
  const isCandidate = u.speaker !== "press";
  const p = el("p", { class: "utterance-text" });
  splitSentences(u.text).forEach((s, i) => {
    if (s.br) {
      p.append(el("br"), el("br"));
      return;
    }
    if (!isCandidate) {
      p.append(s.text);
      return;
    }
    // 句子與查核引文有重疊，就算這句已查核
    const claim = claims.find((c) => {
      const at = u.text.indexOf(c.quote);
      return at >= 0 && at < s.end && at + c.quote.length > s.start;
    });
    const v = claim?.verdict ?? "unchecked";
    state.sentences.push({ speaker: u.speaker, claim });
    const dimmed = state.filter !== "all" && state.filter !== v;
    p.append(
      el(
        "span",
        {
          role: "button",
          tabindex: "0",
          id: `${u.id}-s${i}`,
          class: `sentence ${claim ? `checked mark-${v}` : ""}${dimmed ? " dimmed" : ""}`,
          "aria-label": `${s.text}（${VERDICTS[claim?.verdict] ?? UNCHECKED}）`,
          onclick: () => openSentence(u, s.text, claim),
          onkeydown: (e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              openSentence(u, s.text, claim);
            }
          },
        },
        [s.text, claim ? el("span", { class: "mark-tag", text: VERDICTS[v] }) : null]
      )
    );
  });
  return p;
}

function renderTranscript() {
  const d = state.debate;
  state.sentences = [];
  const root = $("#transcript");
  root.replaceChildren(
    el(
      "div",
      { class: "transcript-heads", "aria-hidden": "true" },
      state.order.map((id) => el("div", { class: "col-head", text: candidate(id).name }))
    )
  );

  for (const section of d.sections) {
    const sec = el("section", { class: "transcript-section" }, [el("h3", { text: section.title })]);
    for (const u of d.utterances.filter((x) => x.section === section.id)) {
      if (u.speaker === "press") {
        sec.append(
          el("div", { class: "utterance press" }, [el("p", { class: "utt-label", text: u.label }), renderUtterance(u)])
        );
        continue;
      }
      const row = el("div", { class: "transcript-row" });
      for (const id of state.order) {
        if (id !== u.speaker) {
          row.append(el("div", { class: "utterance-empty", "aria-hidden": "true" }));
          continue;
        }
        row.append(
          el("article", { class: "utterance" }, [
            el("p", { class: "utt-label" }, [el("strong", { class: "utt-speaker", text: candidate(id).name }), ` ${u.label ?? ""}`]),
            u.sample ? el("span", { class: "sample-tag", text: "範例，非實際發言" }) : null,
            renderUtterance(u),
          ])
        );
      }
      sec.append(row);
    }
    root.append(sec);
  }
  renderSummary();
}

// replaceChildren 會把 null 印成文字，先濾掉
function fill(node, ...children) {
  node.replaceChildren(...children.filter((c) => c !== null && c !== undefined));
}

function openSentence(u, sentence, c) {
  const d = state.debate;
  const speaker = candidate(u.speaker);
  const section = d.sections.find((s) => s.id === u.section);
  const where = `${speaker.name} · ${section?.title ?? ""}${u.label ? `（${u.label}）` : ""}`;
  const body = $("#claim-body");

  if (!c) {
    const issue = new URL(SUGGEST_URL);
    issue.searchParams.set("title", `查核建議：${speaker.name}「${sentence.slice(0, 40)}」`);
    issue.searchParams.set("body", `辯論：${d.title}\n段落：${section?.title ?? ""} ${u.label ?? ""}\n句子：「${sentence}」\n\n建議查核的重點與可參考的公開來源：\n`);
    body.replaceChildren(
      el("p", { class: "muted", text: where }),
      el("h2", { id: "claim-title", class: "claim-quote", text: `「${sentence}」` }),
      el("div", { class: "claim-verdict" }, [verdictBadge(null), el("span", { text: "這句話還沒有查核。" })]),
      el("p", { text: "我們會優先查核含具體數字或可用公開資料驗證的事實陳述。意見、價值判斷或對未來的承諾，會整理執行費用與實際會遇到的問題，而不判定對錯。" }),
      el("p", {}, [el("a", { class: "btn", href: issue.href, target: "_blank", rel: "noopener noreferrer", text: "建議查核這句話" })])
    );
    $("#claim-dialog").showModal();
    return;
  }

  fill(
    body,
    c.sample ? el("p", { class: "sample-tag block-tag", text: "範例查核：示範版面用，不是真實查核結論" }) : null,
    el("p", { class: "muted", text: `${where}${c.topic ? ` · ${c.topic}` : ""}` }),
    el("h2", { id: "claim-title", class: "claim-quote", text: `「${c.quote}」` }),
    el("p", { class: "muted context" }, `完整句子：${sentence}`),
    el("div", { class: "claim-verdict" }, [verdictBadge(c.verdict), el("span", { text: c.summary })]),

    el("h3", { text: "數據查核" }),
    el("p", { text: c.analysis }),

    el("h3", { text: "執行所需費用" }),
    c.cost
      ? el("div", {}, [
          el("p", {}, [el("strong", { text: c.cost.estimate })]),
          c.cost.basis ? el("p", { class: "muted", text: `估算依據：${c.cost.basis}` }) : null,
        ])
      : el("p", { class: "muted", text: "此句是對既有事實的陳述，不涉及新的執行費用。" }),

    el("h3", { text: "實際會遇到的問題" }),
    c.challenges?.length ? el("ul", {}, c.challenges.map((t) => el("li", { text: t }))) : el("p", { class: "muted", text: "尚未整理。" }),

    el("h3", { text: "公開來源" }),
    sourceList(c.sources),
    el("p", { class: "muted", text: c.checkedAt ? `查核日期：${c.checkedAt}` : "查核日期：尚未正式查核" })
  );
  $("#claim-dialog").showModal();
}

// 點對話框外圍可關閉
document.addEventListener("click", (e) => {
  const dlg = $("#claim-dialog");
  if (e.target === dlg) dlg.close();
});

init();
