"""把網頁打包成單一 HTML 檔（資料、圖片、CSS、JS 全部內嵌），方便直接分享預覽。
用法：python3 tools/build_preview.py 輸出路徑.html
輸出不含 <html>/<head>/<body> 外殼，供 Claude Artifact 發佈使用。
"""
import base64, json, re, sys
from pathlib import Path

root = Path(__file__).resolve().parent.parent
html = (root / "index.html").read_text(encoding="utf-8")
body = re.search(r"<body>(.*)</body>", html, re.S).group(1)
css = (root / "style.css").read_text(encoding="utf-8")
js = (root / "js/app.js").read_text(encoding="utf-8")

index = json.loads((root / "data/index.json").read_text(encoding="utf-8"))
data = {"data/index.json": index}
assets = {}
for d in index["debates"]:
    deb = json.loads((root / d["file"]).read_text(encoding="utf-8"))
    data[d["file"]] = deb
    for c in deb["candidates"]:
        for key in ("avatar", "logo"):
            if c.get(key):
                svg = (root / c[key]).read_bytes()
                assets[c[key]] = "data:image/svg+xml;base64," + base64.b64encode(svg).decode()

payload = json.dumps(data, ensure_ascii=False).replace("</", "<\\/")
asset_js = json.dumps(assets).replace("</", "<\\/")
out = f"""<title>真政治</title>
<meta name="claude:viewport-fit-sides" content="cover">
<style>
{css}
</style>
{body}
<script>window.__DATA__ = {payload}; window.__ASSETS__ = {asset_js};</script>
<script>
{js}
</script>
"""
Path(sys.argv[1]).write_text(out, encoding="utf-8")
print("wrote", sys.argv[1], len(out.encode()) // 1024, "KB")
