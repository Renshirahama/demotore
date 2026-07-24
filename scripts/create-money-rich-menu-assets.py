import sys
from pathlib import Path

sys.path.insert(0, "/private/tmp/line-harness-pydeps")

from PIL import Image, ImageDraw, ImageFont

OUT_DIR = Path.cwd() / "assets" / "rich-menus"
OUT_DIR.mkdir(parents=True, exist_ok=True)

WIDTH = 2500
HEIGHT = 1686
HALF_H = 843
HALF_W = 1250

FONT_REGULAR = "/System/Library/Fonts/Hiragino Sans GB.ttc"
FONT_BOLD = "/System/Library/Fonts/Hiragino Sans GB.ttc"


def font(size: int) -> ImageFont.FreeTypeFont:
    return ImageFont.truetype(FONT_BOLD, size=size)


def text_center(draw: ImageDraw.ImageDraw, box, text: str, size: int, fill: str, y_offset: int = 0):
    x, y, w, h = box
    f = font(size)
    bbox = draw.textbbox((0, 0), text, font=f)
    tw = bbox[2] - bbox[0]
    th = bbox[3] - bbox[1]
    tx = x + (w - tw) / 2
    ty = y + (h - th) / 2 + y_offset
    draw.text((tx, ty), text, font=f, fill=fill)


def draw_button(draw: ImageDraw.ImageDraw, rect, title, subtitle, fill, outline, color, sub_color, title_size=120):
    x, y, w, h = rect
    pad = 42
    box = (x + pad, y + pad, x + w - pad, y + h - pad)
    draw.rounded_rectangle(box, radius=42, fill=fill, outline=outline, width=10)
    text_center(draw, (x, y, w, h), title, title_size, color, y_offset=-64)
    text_center(draw, (x, y, w, h), subtitle, 54, sub_color, y_offset=72)


def make_menu(filename, header, cells):
    img = Image.new("RGB", (WIDTH, HEIGHT), "#f8fafc")
    draw = ImageDraw.Draw(img)

    draw.rectangle((0, 0, WIDTH, HEIGHT), fill="#f8fafc")
    draw.line((0, HALF_H, WIDTH, HALF_H), fill="#d1d5db", width=6)
    draw.line((HALF_W, 0, HALF_W, HALF_H), fill="#d1d5db", width=6)

    for cell in cells:
        draw_button(draw, **cell)

    img.save(OUT_DIR / filename, format="PNG", optimize=True)
    print(OUT_DIR / filename)


make_menu(
    "money-before.png",
    "診断前",
    [
        {
            "rect": (0, 0, WIDTH, HALF_H),
            "title": "初回診断",
            "subtitle": "3問でタイプ判定",
            "fill": "#dcfce7",
            "outline": "#22c55e",
            "color": "#14532d",
            "sub_color": "#166534",
            "title_size": 128,
        },
        {
            "rect": (0, HALF_H, WIDTH, HALF_H),
            "title": "講座について",
            "subtitle": "内容と進め方",
            "fill": "#ffffff",
            "outline": "#94a3b8",
            "color": "#0f172a",
            "sub_color": "#475569",
            "title_size": 120,
        },
    ],
)

make_menu(
    "money-learning.png",
    "受講中",
    [
        {
            "rect": (0, 0, HALF_W, HALF_H),
            "title": "講義",
            "subtitle": "今日の内容",
            "fill": "#dbeafe",
            "outline": "#3b82f6",
            "color": "#1e3a8a",
            "sub_color": "#1d4ed8",
            "title_size": 150,
        },
        {
            "rect": (HALF_W, 0, HALF_W, HALF_H),
            "title": "ワーク",
            "subtitle": "収支を整理",
            "fill": "#fef3c7",
            "outline": "#f59e0b",
            "color": "#78350f",
            "sub_color": "#92400e",
            "title_size": 150,
        },
        {
            "rect": (0, HALF_H, WIDTH, HALF_H),
            "title": "個別相談",
            "subtitle": "無料カウンセリング案内",
            "fill": "#ffffff",
            "outline": "#22c55e",
            "color": "#14532d",
            "sub_color": "#166534",
            "title_size": 132,
        },
    ],
)

make_menu(
    "money-counseling.png",
    "相談案内",
    [
        {
            "rect": (0, 0, WIDTH, HALF_H),
            "title": "無料相談",
            "subtitle": "申し込みへ進む",
            "fill": "#fee2e2",
            "outline": "#ef4444",
            "color": "#7f1d1d",
            "sub_color": "#991b1b",
            "title_size": 132,
        },
        {
            "rect": (0, HALF_H, WIDTH, HALF_H),
            "title": "FAQ",
            "subtitle": "よくある不安を確認",
            "fill": "#ffffff",
            "outline": "#94a3b8",
            "color": "#0f172a",
            "sub_color": "#475569",
            "title_size": 150,
        },
    ],
)
