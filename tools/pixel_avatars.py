"""產生兩位候選人的 32x32 像素頭像（SVG）。

兩人共用同一套畫法（臉、耳、五官、西裝、外框的規則與細緻度都相同），
只用各自公開形象中最容易辨識的特徵區分：
- 蔣萬安：臉型較長、側分往後梳的短髮（頭頂有份量）、不戴眼鏡
- 沈伯洋：臉型較圓、往前梳的瀏海、黑色粗框方形眼鏡
領帶用各自政黨色，兩人處理方式相同。不美化也不醜化任何一方。
執行：python3 tools/pixel_avatars.py
"""
from pathlib import Path

N = 32
PAL = {
    "K": "#2a2421",  # 外框
    "S": "#f0caa5",  # 皮膚
    "s": "#d9a983",  # 皮膚陰影
    "H": "#231d1a",  # 頭髮
    "h": "#4a3f38",  # 頭髮反光
    "E": "#1d1816",  # 眼睛
    "B": "#231d1a",  # 眉毛
    "M": "#b0645a",  # 嘴
    "G": "#151210",  # 眼鏡框
    "C": "#3d4048",  # 西裝
    "c": "#2c2e34",  # 西裝陰影
    "T": "#f4f2ee",  # 襯衫
}

PEOPLE = {
    "chiang": {
        "label": "蔣萬安像素頭像",
        "tie": "#1a3a9c",
        "face": (15.5, 15.5, 7.0, 9.2),  # cx, cy, rx, ry：較長的臉
    },
    "shen": {
        "label": "沈伯洋像素頭像",
        "tie": "#1b8a3a",
        "face": (15.5, 16.0, 7.6, 8.6),  # 較圓的臉
    },
}


def inside(x, y, cx, cy, rx, ry):
    return ((x + 0.5 - cx - 0.5) / rx) ** 2 + ((y + 0.5 - cy - 0.5) / ry) ** 2 <= 1


def base(person):
    cx, cy, rx, ry = person["face"]
    g = [[None] * N for _ in range(N)]

    # 西裝與肩膀（梯形），兩人相同
    for y in range(25, N):
        half = 6 + (y - 25) * 1.6
        for x in range(N):
            if abs(x + 0.5 - (cx + 0.5)) <= min(half, 15):
                g[y][x] = "C"
    # 襯衫 V 領與領帶
    for y in range(25, N):
        w = max(0, 3 - (y - 25) * 0.5)
        for x in range(N):
            d = abs(x + 0.5 - (cx + 0.5))
            if d <= w + 0.5:
                g[y][x] = "T"
            if y >= 26 and d <= 1.0 + 0.5:
                g[y][x] = "R"
    for y in range(27, N):  # 領片陰影
        for x in range(N):
            d = abs(x + 0.5 - (cx + 0.5))
            if 2.5 < d <= 3.5:
                g[y][x] = "c"
    # 脖子
    for y in range(int(cy + ry) - 1, 26):
        for x in range(13, 19):
            g[y][x] = "s" if y <= int(cy + ry) + 1 else "S"
    # 耳朵
    for y in range(int(cy) - 1, int(cy) + 3):
        g[y][int(cx - rx) - 1] = "S"
        g[y][int(cx + rx) + 1] = "S"
    # 臉
    for y in range(N):
        for x in range(N):
            if inside(x, y, cx, cy, rx, ry):
                g[y][x] = "S"
                if x + 0.5 > cx + rx - 1.6:  # 右側臉頰陰影
                    g[y][x] = "s"
    # 五官（兩人同位置規則）
    ey = int(cy) + 0
    for dx in (-4, 2):
        g[ey][int(cx) + dx] = "E"
        g[ey][int(cx) + dx + 1] = "E"
        g[ey - 2][int(cx) + dx - (1 if dx < 0 else 0)] = "B"
        g[ey - 2][int(cx) + dx + 1 - (1 if dx < 0 else 0)] = "B"
        g[ey - 2][int(cx) + dx + 2 - (1 if dx < 0 else 0)] = "B"
    g[ey + 2][int(cx)] = "s"  # 鼻子
    g[ey + 3][int(cx)] = "s"
    my = ey + 5
    for x in range(int(cx) - 1, int(cx) + 3):
        g[my][x] = "M"
    g[my - 1][int(cx) - 2] = "M"  # 微笑嘴角
    g[my - 1][int(cx) + 3] = "M"
    return g


def chiang_hair(g, person):
    cx, cy, rx, ry = person["face"]
    top = 3
    for y in range(top, int(cy) - 1):
        for x in range(N):
            # 頭頂較高、往後梳的輪廓
            if inside(x, y, cx, cy - 1.6, rx + 1.1, ry + 1.2):
                # 髮際線：左側（觀者）額頭露出較多，呈側分
                hairline = cy - ry * 0.48 + (x - cx) * -0.18
                if y < hairline or x + 0.5 < cx - rx + 1.2 or x + 0.5 > cx + rx - 0.6:
                    g[y][x] = "H"
    # 側分線與往右後梳的反光
    for y in range(top + 1, top + 5):
        g[y][int(cx) + 3 - (y - top - 1) // 2] = "h"
    for x in range(int(cx) - 4, int(cx) + 1):
        g[top + 2][x] = "h"
    # 鬢角
    for y in range(int(cy) - 3, int(cy) + 1):
        g[y][int(cx - rx) + 0] = "H"
        g[y][int(cx + rx) - 0] = "H"


def shen_hair(g, person):
    cx, cy, rx, ry = person["face"]
    top = 5
    for y in range(top, int(cy) - 1):
        for x in range(N):
            if inside(x, y, cx, cy - 1.2, rx + 1.3, ry + 1.1):
                hairline = cy - ry * 0.42
                if y < hairline or x + 0.5 < cx - rx + 1.0 or x + 0.5 > cx + rx - 0.8:
                    g[y][x] = "H"
    # 往前梳的瀏海：參差的髮尾
    fy = int(cy - ry * 0.42)
    for i, x in enumerate(range(int(cx - rx) + 2, int(cx + rx) - 1)):
        if i % 3 != 2:
            g[fy][x] = "H"
        if i % 3 == 0:
            g[fy + 1][x] = "H"
    for x in range(int(cx) - 3, int(cx) + 3):
        g[top + 2][x] = "h"
    # 黑色粗框方形眼鏡
    ey = int(cy)
    for dx in (-4, 2):  # 與眼睛位置對齊，鏡片內留兩列皮膚與眼睛
        x0 = int(cx) + dx - 1
        for x in range(x0, x0 + 4):
            g[ey - 2][x] = "G"
            g[ey + 1][x] = "G"
        for y in (ey - 1, ey):
            g[y][x0] = "G"
            g[y][x0 + 3] = "G"
    for x in range(int(cx) - 1, int(cx) + 1):  # 鼻樑
        g[ey - 1][x] = "G"
    g[ey - 1][int(cx - rx) + 1] = "G"  # 鏡腳
    g[ey - 1][int(cx + rx)] = "G"


def outline(g):
    out = [row[:] for row in g]
    for y in range(N):
        for x in range(N):
            if g[y][x] is not None:
                continue
            for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                nx, ny = x + dx, y + dy
                if 0 <= nx < N and 0 <= ny < N and g[ny][nx] is not None:
                    out[y][x] = "K"
                    break
    return out


def render(g, person):
    pal = dict(PAL, R=person["tie"])
    rects = []
    for y, row in enumerate(g):
        x = 0
        while x < N:
            ch = row[x]
            if ch is None:
                x += 1
                continue
            w = 1
            while x + w < N and row[x + w] == ch:
                w += 1
            rects.append(f'<rect x="{x}" y="{y}" width="{w}" height="1" fill="{pal[ch]}"/>')
            x += w
    label = person["label"]
    return (
        f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {N} {N}" shape-rendering="crispEdges" '
        f'role="img" aria-label="{label}"><title>{label}</title>' + "".join(rects) + "</svg>\n"
    )


if __name__ == "__main__":
    out = Path(__file__).resolve().parent.parent / "img"
    out.mkdir(exist_ok=True)
    for pid, hair in (("chiang", chiang_hair), ("shen", shen_hair)):
        p = PEOPLE[pid]
        g = base(p)
        hair(g, p)
        (out / f"{pid}.svg").write_text(render(outline(g), p), encoding="utf-8")
        print("wrote", out / f"{pid}.svg")
