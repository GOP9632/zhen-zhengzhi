"""產生兩位候選人的 24x24 像素頭像（SVG）。

兩人共用同一個臉部與西裝模板、同一組配色，只差在髮型與是否戴眼鏡，
避免美化或醜化任何一方；配色刻意不用政黨色（藍、綠）。
執行：python3 tools/pixel_avatars.py
"""
from pathlib import Path

PALETTE = {
    "K": "#2b2622",  # 輪廓
    "S": "#e6c2a0",  # 皮膚
    "s": "#cfa684",  # 皮膚陰影
    "H": "#2a2420",  # 頭髮
    "h": "#4b423a",  # 頭髮反光
    "B": "#2a2420",  # 眉毛
    "E": "#1d1a18",  # 眼睛
    "M": "#a5675b",  # 嘴
    "G": "#6e655d",  # 眼鏡框（細金屬框）
    "C": "#55575e",  # 西裝
    "c": "#3f4147",  # 西裝陰影／領片
    "T": "#f3f1ec",  # 襯衫
    "R": "#7c4a3a",  # 領帶（中性的棕紅色，兩人相同）
}

BASE = [
    "........................",
    "........................",
    "........................",
    "........KKKKKKKK........",
    ".......KSSSSSSSSK.......",
    ".......KSSSSSSSSK.......",
    ".......KSSSSSSSSK.......",
    ".......KSBBSSBBSK.......",
    ".......KSSSSSSSSK.......",
    ".......KSESSSSESK.......",
    ".......KSSSssSSSK.......",
    ".......KSSSSSSSSK.......",
    ".......KSSSMMSSSK.......",
    "........KSSSSSSK........",
    ".........KKSSKK.........",
    "..........KSSK..........",
    ".....KCCCTTRRTTCCCK.....",
    "....KCCCCTTRRTTCCCCK....",
    "...KCCCCCcTRRTcCCCCCK...",
    "...KCCCCCCcRRcCCCCCCK...",
    "..KCCCCCCCcRRcCCCCCCCK..",
    "..KCCCCCCCCccCCCCCCCCK..",
    "..KCCCCCCCCccCCCCCCCCK..",
    "..KCCCCCCCCccCCCCCCCCK..",
]

# 每人只覆寫需要的列（列號: 內容），其餘沿用模板
PEOPLE = {
    "chiang": {  # 短髮、旁分
        2: ".........HHHHHH.........",
        3: ".......HHHHHHHHHH.......",
        4: "......HHHHHHHhHHHH......",
        5: "......HHSSSSSHHHHH......",
        6: "......HKSSSSSSSSKH......",
        7: "......HKSBBSSBBSKH......",
    },
    "shen": {  # 短髮、瀏海、眼鏡
        2: "........HHHHHHHH........",
        3: ".......HHHHHHhHHH.......",
        4: "......HHHHHHHHHHHH......",
        5: "......HHHHHHHHHHHH......",
        6: "......HKSHSSSSHSKH......",
        8: ".......KGGGSSGGGK.......",
        9: ".......KGESGGSEGK.......",
    },
}

LABELS = {"chiang": "蔣萬安像素頭像", "shen": "沈伯洋像素頭像"}


def render(rows, label):
    assert len(rows) == 24 and all(len(r) == 24 for r in rows), "格子必須是 24x24"
    rects = []
    for y, row in enumerate(rows):
        x = 0
        while x < 24:
            ch = row[x]
            if ch == ".":
                x += 1
                continue
            w = 1
            while x + w < 24 and row[x + w] == ch:
                w += 1
            rects.append(f'<rect x="{x}" y="{y}" width="{w}" height="1" fill="{PALETTE[ch]}"/>')
            x += w
    return (
        '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" '
        f'shape-rendering="crispEdges" role="img" aria-label="{label}">'
        f"<title>{label}</title>" + "".join(rects) + "</svg>\n"
    )


if __name__ == "__main__":
    out = Path(__file__).resolve().parent.parent / "img"
    out.mkdir(exist_ok=True)
    for pid, over in PEOPLE.items():
        rows = [over.get(i, r) for i, r in enumerate(BASE)]
        (out / f"{pid}.svg").write_text(render(rows, LABELS[pid]), encoding="utf-8")
        print("wrote", out / f"{pid}.svg")
