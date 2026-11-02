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

// 來源種類：判定只看原始資料，新聞與查核報告只當入口
const SOURCE_KINDS = {
  primary: "原始資料",
  official: "官方說法",
  factcheck: "查核報告（入口）",
  news: "新聞（入口）",
};

function sourceList(sources) {
  if (!sources?.length) return el("p", { class: "muted", text: "尚無來源。" });
  const order = Object.keys(SOURCE_KINDS);
  const sorted = [...sources].sort((a, b) => order.indexOf(a.kind ?? "news") - order.indexOf(b.kind ?? "news"));
  return el(
    "ul",
    { class: "source-list" },
    sorted.map((s) => {
      const href = safeUrl(s.url);
      const kind = SOURCE_KINDS[s.kind] ? s.kind : "news";
      return el("li", {}, [
        el("span", { class: `src-kind src-${kind}`, text: SOURCE_KINDS[kind] }),
        " ",
        href ? el("a", { href, target: "_blank", rel: "noopener noreferrer", text: s.title }) : s.title,
        s.publisher ? el("span", { class: "muted", text: ` · ${s.publisher}` }) : null,
      ]);
    })
  );
}

async function loadJSON(path) {
  // 單一檔案預覽版會把資料直接內嵌在 window.__DATA__
  if (window.__DATA__?.[path]) return window.__DATA__[path];
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
  $("#about-btn").addEventListener("click", () => $("#about-dialog").showModal());
  $("#swap-btn").addEventListener("click", () => {
    state.order.reverse();
    renderVersus();
    renderTranscript();
  });
  try {
    const index = await loadJSON("data/index.json");
    const select = $("#debate-select");
    for (const d of index.debates) {
      select.append(el("option", { value: d.file, text: `${d.date} ${d.title}` }));
    }
    if (index.debates.length > 1) $(".debate-picker").hidden = false;
    select.addEventListener("change", () => loadDebate(select.value));

    const fromHash = index.debates.find((d) => `#${d.id}` === location.hash);
    const first = fromHash ?? index.debates[0];
    if (first) {
      select.value = first.file;
      await loadDebate(first.file);
    }
  } catch (err) {
    $("#debate-title").textContent = "資料載入失敗";
    $("#debate-date").textContent = `${err.message}。若是直接用瀏覽器打開檔案，請改用本機伺服器（見 README）。`;
  }
}

async function loadDebate(file) {
  const debate = await loadJSON(file);
  state.debate = debate;
  state.order = debate.candidates.map((c) => c.id);
  // 每位候選人的政黨色，供 CSS 使用（兩人處理方式相同）
  for (const c of debate.candidates) {
    document.documentElement.style.setProperty(`--party-${c.id}`, c.color ?? "var(--muted)");
  }
  renderHeader();
  renderTranscript();
}

function candidate(id) {
  return state.debate.candidates.find((c) => c.id === id);
}

function asset(path) {
  return window.__ASSETS__?.[path] ?? path;
}

// 像素頭像：兩人同尺寸、同模板（見 tools/pixel_avatars.py）
function avatar(c, size) {
  if (!c.avatar) return null;
  return el("img", { class: "avatar", src: asset(c.avatar), width: size, height: size, alt: "", "aria-hidden": "true", style: `--party: var(--party-${c.id})` });
}

function partyBadge(c) {
  return el("span", { class: "party", style: `--party: var(--party-${c.id})` }, [
    c.logo ? el("img", { src: asset(c.logo), width: 16, height: 16, alt: "", "aria-hidden": "true" }) : null,
    c.partyShort ?? c.party,
  ]);
}

function renderHeader() {
  const d = state.debate;
  $("#debate-title").textContent = d.title;
  $("#debate-date").textContent = d.date.replaceAll("-", ".");
  $("#debate-format").textContent = d.format ?? "";
  $("#transcript-note").textContent = d.isSample ? d.sampleNote ?? "" : d.transcriptNote ?? "";
  $("#debate-sources").replaceChildren(el("h3", { text: "公開來源" }), sourceList(d.debateSources));
  renderVersus();
  renderFilters();
}

function renderVersus() {
  const cards = state.order.map((id) => {
    const c = candidate(id);
    return el("div", { class: "vs-card", style: `--party: var(--party-${c.id})` }, [
      avatar(c, 72),
      el("div", { class: "vs-name" }, [el("strong", { text: c.name }), partyBadge(c)]),
    ]);
  });
  $("#versus").replaceChildren(cards[0], el("span", { class: "vs", text: "VS", "aria-hidden": "true" }), cards[1]);
}

function renderFilters() {
  const opts = [["all", "全部"], ...Object.entries(VERDICTS), ["unchecked", UNCHECKED]];
  $("#filter-chips").replaceChildren(
    ...opts.map(([v, label]) =>
      el(
        "button",
        {
          type: "button",
          class: `chip chip-${v}`,
          "aria-pressed": String(state.filter === v),
          onclick: () => {
            state.filter = v;
            renderFilters();
            renderTranscript();
          },
        },
        [v !== "all" ? el("span", { class: `swatch hl-${v}`, "aria-hidden": "true" }) : null, label]
      )
    )
  );
}

function renderSummary() {
  const cols = [...Object.values(VERDICTS), UNCHECKED];
  const table = el("table", { class: "summary-table" });
  table.append(el("thead", {}, el("tr", {}, [el("th", { text: "" }), el("th", { text: "總句數" }), ...cols.map((v) => el("th", { text: v }))])));
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
    el("div", { class: "table-scroll" }, table),
    el("p", { class: "muted", text: "統計只反映已查核的句子，不代表候選人整體誠信。" })
  );
}

function renderUtterance(u) {
  const d = state.debate;
  const claims = d.claims.filter((c) => c.utteranceId === u.id);
  const isCandidate = Boolean(candidate(u.speaker));
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
    // 句子與查核引文有重疊，整句都算已查核
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
          class: `sentence${claim ? ` hl hl-${v}` : ""}${dimmed ? " dimmed" : ""}`,
          "aria-label": `${s.text}（${VERDICTS[claim?.verdict] ?? UNCHECKED}）`,
          onclick: () => openSentence(u, s.text, claim),
          onkeydown: (e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              openSentence(u, s.text, claim);
            }
          },
        },
        s.text
      )
    );
  });
  return p;
}

// 對話形式：依實際發言順序排列，候選人左右各一側（可對調），主持人與媒體提問置中
function renderTranscript() {
  const d = state.debate;
  state.sentences = [];
  const root = $("#transcript");
  root.replaceChildren();

  for (const section of d.sections) {
    const sec = el("section", { class: "chat-section" }, [el("h2", { class: "chat-divider" }, el("span", { text: section.title }))]);
    for (const u of d.utterances.filter((x) => x.section === section.id)) {
      const c = candidate(u.speaker);
      if (!c) {
        sec.append(
          el("div", { class: "msg msg-host" }, [
            el("details", { class: "host-bubble", open: u.speaker === "press" }, [el("summary", { text: u.label ?? "主持人" }), renderUtterance(u)]),
          ])
        );
        continue;
      }
      const side = state.order.indexOf(c.id) === 0 ? "left" : "right";
      sec.append(
        el("article", { class: `msg msg-${side}`, style: `--party: var(--party-${c.id})` }, [
          avatar(c, 40),
          el("div", { class: "bubble" }, [
            el("p", { class: "bubble-meta" }, [el("strong", { text: c.name }), el("span", { text: u.label ?? "" })]),
            renderUtterance(u),
          ]),
        ])
      );
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
  const where = el("p", { class: "sheet-where" }, [
    avatar(speaker, 28),
    el("strong", { text: speaker.name }),
    partyBadge(speaker),
    el("span", { class: "muted", text: `${section?.title ?? ""}${u.label ? ` · ${u.label}` : ""}` }),
  ]);
  const body = $("#claim-body");

  if (!c) {
    const issue = new URL(SUGGEST_URL);
    issue.searchParams.set("title", `查核建議：${speaker.name}「${sentence.slice(0, 40)}」`);
    issue.searchParams.set("body", `辯論：${d.title}\n段落：${section?.title ?? ""} ${u.label ?? ""}\n句子：「${sentence}」\n\n建議查核的重點與可參考的公開來源：\n`);
    fill(
      body,
      where,
      el("h2", { id: "claim-title", class: "claim-quote", text: `「${sentence}」` }),
      el("div", { class: "claim-verdict" }, [verdictBadge(null), el("span", { text: "這句話還沒有查核。" })]),
      el("p", { text: "有數字、講政績、或是指控對手的句子，我們都會去查。這句還沒輪到，或是它比較像意見、願景，沒辦法用資料判斷對錯。" }),
      el("p", { class: "muted", text: "覺得這句應該查？按下面的按鈕告訴我們，最好附上你知道的原始資料（政府統計、公文、會議紀錄等）。" }),
      el("p", {}, [el("a", { class: "btn", href: issue.href, target: "_blank", rel: "noopener noreferrer", text: "建議查核這句話" })])
    );
    $("#claim-dialog").showModal();
    return;
  }

  fill(
    body,
    c.sample ? el("p", { class: "sample-tag block-tag", text: "範例查核：示範版面用，不是真實查核結論" }) : null,
    where,
    el("h2", { id: "claim-title", class: `claim-quote hl hl-${c.verdict}`, text: `「${sentence}」` }),
    el("div", { class: "claim-verdict" }, [verdictBadge(c.verdict), c.topic ? el("span", { class: "muted", text: c.topic }) : null]),
    el("p", { class: "claim-summary", text: c.summary }),
    el("details", { class: "claim-detail" }, [
      el("summary", { text: "看詳細：數字怎麼算、資料從哪來" }),
      ...String(c.analysis ?? "")
        .split(/\n\n+/)
        .map((t) => el("p", { text: t })),
      c.cost
        ? el("div", {}, [
            el("h3", { text: "執行所需費用" }),
            el("p", {}, [el("strong", { text: c.cost.estimate })]),
            c.cost.basis ? el("p", { class: "muted", text: `估算依據：${c.cost.basis}` }) : null,
          ])
        : null,
      c.challenges?.length ? el("h3", { text: "要注意的地方" }) : null,
      c.challenges?.length ? el("ul", {}, c.challenges.map((t) => el("li", { text: t }))) : null,
    ]),

    el("h3", { text: "資料來源" }),
    el("p", { class: "muted small", text: "判定只看「原始資料」（政府統計、法規、會議紀錄、審計報告、當事人原始發言等）。新聞和查核報告只用來找線索。" }),
    sourceList(c.sources),
    el("p", { class: "muted", text: c.checkedAt ? `查核日期：${c.checkedAt}` : "查核日期：尚未正式查核" })
  );
  $("#claim-dialog").showModal();
}

// 點對話框外圍可關閉
document.addEventListener("click", (e) => {
  if (e.target instanceof HTMLDialogElement) e.target.close();
});

init();
