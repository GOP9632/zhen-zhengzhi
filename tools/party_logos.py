"""產生政黨標誌的像素版 SVG（21x21），風格與候選人像素頭像一致。

兩黨用同樣的格數、同樣的處理方式，只依各自標誌的基本幾何繪製：
- 中國國民黨：青天白日（藍底、白日、十二道光芒）
- 民主進步黨：綠底、白色十字、中央綠色台灣
執行：python3 tools/party_logos.py
"""
import math
from pathlib import Path

N = 21
C = (N - 1) / 2


def kmt():
    blue, white = "#1a3a9c", "#ffffff"
    grid = [[None] * N for _ in range(N)]
    for y in range(N):
        for x in range(N):
            dx, dy = x - C, y - C
            r = math.hypot(dx, dy)
            if r > 10.4:
                continue
            col = blue
            ang = (math.degrees(math.atan2(dy, dx)) + 90) % 30  # 12 道光芒，每 30 度一道
            off = min(ang, 30 - ang)  # 與光芒中心線的角距
            if r <= 3.4:
                col = white  # 白日
            elif r <= 4.4:
                col = blue  # 白日外的藍圈
            elif r <= 9.0 and off <= 13 * (9.0 - r) / 4.6 + 2:
                col = white  # 光芒（越外越尖）
            grid[y][x] = col
    return grid, "中國國民黨黨徽（像素示意）"


ISLAND = [  # 7x7，台灣島的簡化像素形狀
    "....G..",
    "...GGG.",
    "..GGGG.",
    "..GGG..",
    ".GGGG..",
    ".GGG...",
    "..G....",
]


def dpp():
    green, white = "#1b8a3a", "#ffffff"
    grid = [[green] * N for _ in range(N)]
    for y in range(N):
        for x in range(N):
            if 7 <= x <= 13 or 7 <= y <= 13:
                grid[y][x] = white  # 白色十字
    for iy, row in enumerate(ISLAND):
        for ix, ch in enumerate(row):
            if ch == "G":
                grid[7 + iy][7 + ix] = green
    return grid, "民主進步黨黨徽（像素示意）"


def render(grid, label):
    rects = []
    for y, row in enumerate(grid):
        x = 0
        while x < N:
            col = row[x]
            if col is None:
                x += 1
                continue
            w = 1
            while x + w < N and row[x + w] == col:
                w += 1
            rects.append(f'<rect x="{x}" y="{y}" width="{w}" height="1" fill="{col}"/>')
            x += w
    return (
        f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {N} {N}" shape-rendering="crispEdges" '
        f'role="img" aria-label="{label}"><title>{label}</title>' + "".join(rects) + "</svg>\n"
    )


if __name__ == "__main__":
    out = Path(__file__).resolve().parent.parent / "img"
    for name, fn in (("kmt", kmt), ("dpp", dpp)):
        (out / f"party-{name}.svg").write_text(render(*fn()), encoding="utf-8")
        print("wrote", out / f"party-{name}.svg")
