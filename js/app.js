// 真政治：辯論逐字稿與查核
// 資料來源：data/index.json 列出所有辯論，每場辯論一個 JSON 檔（格式見 README）。

const VERDICTS = {
  correct: "正確",
  partly: "部分正確",
  incorrect: "錯誤",
  unverifiable: "無法查證",
};

const state = {
  debate: null,
  order: [], // 候選人顯示順序（id 陣列）
  filter: "all",
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
  return el("span", { class: `verdict verdict-${v}`, text: VERDICTS[v] ?? v });
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
        href
          ? el("a", { href, target: "_blank", rel: "noopener noreferrer", text: s.title })
          : s.title,
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
    $("#debate-meta").textContent =
      `${err.message}。若是直接用瀏覽器打開檔案，請改用本機伺服器（見 README）。`;
  }
}

async function loadDebate(file) {
  const debate = await loadJSON(file);
  state.debate = debate;
  state.order = debate.candidates.map((c) => c.id);
  renderHeader();
  renderTranscript();
}

function renderHeader() {
  const d = state.debate;
  $("#debate-title").textContent = d.title;
  $("#debate-meta").textContent = `${d.date} · ${d.candidates
    .map((c) => `${c.name}（${c.party}）`)
    .join("、")}`;
  $("#debate-format").textContent = d.format ?? "";

  const banner = $("#sample-banner");
  banner.hidden = !d.isSample;
  banner.replaceChildren(el("strong", { text: "範例資料　" }), d.sampleNote ?? "");

  const src = $("#debate-sources");
  src.replaceChildren(el("h3", { text: "辯論公開來源" }), sourceList(d.debateSources));
}

function renderSummary() {
  const d = state.debate;
  const table = el("table", { class: "summary-table" });
  const head = el("tr", {}, [el("th", { text: "候選人" }), ...Object.values(VERDICTS).map((v) => el("th", { text: v }))]);
  table.append(el("thead", {}, head));
  const body = el("tbody");
  for (const id of state.order) {
    const c = d.candidates.find((x) => x.id === id);
    const mine = d.claims.filter((x) => x.speaker === id);
    body.append(
      el("tr", {}, [
        el("th", { scope: "row", text: c.name }),
        ...Object.keys(VERDICTS).map((v) => el("td", { text: mine.filter((x) => x.verdict === v).length })),
      ])
    );
  }
  table.append(body);
  $("#summary").replaceChildren(
    el("h3", { text: "查核統計" }),
    table,
    el("p", { class: "muted", text: "統計只反映本站已查核的句子，不代表候選人整體誠信。" })
  );
}

// 把逐字稿中被查核的句子包成可點選的按鈕
function renderUtteranceText(u, claims) {
  const p = el("p", { class: "utterance-text" });
  const marks = claims
    .map((c) => ({ c, start: u.text.indexOf(c.quote) }))
    .filter((m) => m.start >= 0)
    .sort((a, b) => a.start - b.start);
  let pos = 0;
  for (const { c, start } of marks) {
    if (start < pos) continue; // 重疊的標記略過
    p.append(u.text.slice(pos, start));
    const dimmed = state.filter !== "all" && state.filter !== c.verdict;
    p.append(
      el(
        "button",
        {
          type: "button",
          class: `claim-mark mark-${c.verdict}${dimmed ? " dimmed" : ""}`,
          "aria-label": `${c.quote}（查核：${VERDICTS[c.verdict]}）`,
          onclick: () => openClaim(c),
        },
        [c.quote, el("span", { class: "mark-tag", text: VERDICTS[c.verdict] })]
      )
    );
    pos = start + c.quote.length;
  }
  p.append(u.text.slice(pos));
  return p;
}

function renderTranscript() {
  const d = state.debate;
  renderSummary();
  const root = $("#transcript");
  root.replaceChildren();

  const heads = el(
    "div",
    { class: "transcript-heads", "aria-hidden": "true" },
    state.order.map((id) => el("div", { class: "col-head", text: d.candidates.find((c) => c.id === id).name }))
  );
  root.append(heads);

  for (const section of d.sections) {
    const row = el("div", { class: "transcript-row" });
    for (const id of state.order) {
      const c = d.candidates.find((x) => x.id === id);
      const items = d.utterances.filter((u) => u.section === section.id && u.speaker === id);
      const col = el("article", { class: "utterance-col" }, [
        el("h4", { class: "col-speaker", text: c.name }),
      ]);
      if (!items.length) col.append(el("p", { class: "muted", text: "（本環節無發言紀錄）" }));
      for (const u of items) {
        const claims = d.claims.filter((x) => x.utteranceId === u.id);
        col.append(
          el("div", { class: "utterance" }, [
            u.sample ? el("span", { class: "sample-tag", text: "範例，非實際發言" }) : null,
            u.time ? el("span", { class: "muted time", text: u.time }) : null,
            renderUtteranceText(u, claims),
          ])
        );
      }
      row.append(col);
    }
    root.append(el("section", { class: "transcript-section" }, [el("h3", { text: section.title }), row]));
  }
}

function openClaim(c) {
  const d = state.debate;
  const speaker = d.candidates.find((x) => x.id === c.speaker);
  const body = $("#claim-body");
  body.replaceChildren(
    c.sample ? el("p", { class: "sample-tag block-tag", text: "範例查核：示範版面用，不是真實查核結論" }) : null,
    el("p", { class: "muted", text: `${speaker.name} · ${c.topic ?? ""}` }),
    el("h2", { id: "claim-title", class: "claim-quote", text: `「${c.quote}」` }),
    el("div", { class: "claim-verdict" }, [verdictBadge(c.verdict), el("span", { text: c.summary })]),

    el("h3", { text: "數據查核" }),
    el("p", { text: c.analysis }),

    el("h3", { text: "執行所需費用" }),
    el("p", {}, [el("strong", { text: c.cost?.estimate ?? "尚無估算" })]),
    c.cost?.basis ? el("p", { class: "muted", text: `估算依據：${c.cost.basis}` }) : null,

    el("h3", { text: "實際會遇到的問題" }),
    c.challenges?.length
      ? el("ul", {}, c.challenges.map((t) => el("li", { text: t })))
      : el("p", { class: "muted", text: "尚未整理。" }),

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
