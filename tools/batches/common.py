"""查核批次共用工具：把一批查核寫進辯論資料檔。"""
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
DATA = ROOT / "data/debates/2026-taipei-mayor-1.json"
CHECKED_AT = "2026-11-02"


KINDS = ("primary", "official", "factcheck", "news")


def S(title, publisher, url, kind="news"):
    """kind：primary 原始資料（政府統計、法規、會議紀錄、審計報告、當事人原始發言）、
    official 官方說法（機關聲明，沒有附可驗證的底層數據）、
    factcheck 查核報告（只當入口）、news 新聞（只當入口）。"""
    assert kind in KINDS, kind
    return {"title": title, "publisher": publisher, "url": url, "kind": kind}


def P(title, publisher, url):
    return S(title, publisher, url, "primary")


def O(title, publisher, url):
    return S(title, publisher, url, "official")


def F(title, url):
    return S(title, "台灣事實查核中心", url, "factcheck")


def patch_claims(patches, path=DATA, only=False):
    """依 id 更新既有查核的欄位（引文與發言對應不變）。"""
    d = json.loads(path.read_text(encoding="utf-8"))
    by_id = {c["id"]: c for c in d["claims"]}
    for cid, fields in patches.items():
        assert cid in by_id, f"找不到查核 {cid}"
        c = by_id[cid]
        c.update(fields)
        c["checkedAt"] = CHECKED_AT
        if c["verdict"] != "unverifiable":
            assert any(s.get("kind") == "primary" for s in c["sources"]), f"{cid} 判定為 {c['verdict']} 但沒有原始資料"
    path.write_text(json.dumps(d, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    missing = [] if only else [c["id"] for c in d["claims"] if c["id"] not in patches]
    print(f"更新 {len(patches)} 筆" + (f"；未更新：{missing}" if missing else ""))


def add_claims(claims, path=DATA):
    d = json.loads(path.read_text(encoding="utf-8"))
    utts = {u["id"]: u for u in d["utterances"]}
    by_id = {c["id"]: i for i, c in enumerate(d["claims"])}
    for c in claims:
        u = utts[c["utteranceId"]]
        assert c["quote"] in u["text"], f"{c['id']} 的引文不在原文中"
        assert u["speaker"] == c["speaker"], f"{c['id']} 的發言者不一致"
        c.setdefault("cost", None)
        c.setdefault("challenges", [])
        c.setdefault("checkedAt", CHECKED_AT)
        if c["verdict"] != "unverifiable":
            assert any(s.get("kind") == "primary" for s in c["sources"]), f"{c['id']} 判定為 {c['verdict']} 但沒有原始資料"
        if c["id"] in by_id:
            d["claims"][by_id[c["id"]]] = c
        else:
            d["claims"].append(c)
    # 同一句話只能有一筆查核
    seen = {}
    for c in d["claims"]:
        u = utts[c["utteranceId"]]
        at = u["text"].index(c["quote"])
        for other, (oat, olen) in seen.get(c["utteranceId"], {}).items():
            assert at >= oat + olen or at + len(c["quote"]) <= oat, f"{c['id']} 與 {other} 的引文重疊"
        seen.setdefault(c["utteranceId"], {})[c["id"]] = (at, len(c["quote"]))
    path.write_text(json.dumps(d, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"寫入 {len(claims)} 筆，總共 {len(d['claims'])} 筆查核")
