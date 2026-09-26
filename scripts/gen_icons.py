#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
为 h-panel 批量生成 10 个简单导航图标
- 输出到 public/image/icons/
- 圆角矩形 + 单色背景 + 白色简约符号
- 256x256 PNG（导航页实际显示约 32-64px）
- 程序化生成，无版权问题，任意缩放清晰

重新生成：python scripts/gen_icons.py
"""
import sys, io
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')

from PIL import Image, ImageDraw
import os
import math

OUTPUT_DIR = os.path.join(os.path.dirname(__file__), '..', 'public', 'image', 'icons')
OUTPUT_DIR = os.path.abspath(OUTPUT_DIR)
os.makedirs(OUTPUT_DIR, exist_ok=True)

SIZE = 256
RADIUS = 56  # iOS 风格圆角 (~22%)

# ----------------------------------------------------------------------
# 配色 + 主题 + 适用项目（用户可按需修改 assign）
ICONS = [
    {
        "id": "01_ai_chip",
        "name": "AI 芯片",
        "color_top": "#8b5cf6", "color_bot": "#6366f1",
        "assign": "AI-gateway, gmp, deep research, webui(AI chat)",
    },
    {
        "id": "02_search",
        "name": "搜索",
        "color_top": "#14b8a6", "color_bot": "#0d9488",
        "assign": "searxng, newsnow",
    },
    {
        "id": "03_video",
        "name": "视频",
        "color_top": "#f43f5e", "color_bot": "#e11d48",
        "assign": "moontv",
    },
    {
        "id": "04_terminal",
        "name": "终端",
        "color_top": "#10b981", "color_bot": "#047857",
        "assign": "linux社区, dcdeploy",
    },
    {
        "id": "05_cloud",
        "name": "云存储",
        "color_top": "#0ea5e9", "color_bot": "#0284c7",
        "assign": "CloudPaste",
    },
    {
        "id": "06_server",
        "name": "服务器",
        "color_top": "#3b82f6", "color_bot": "#1d4ed8",
        "assign": "1-panel, Hermes",
    },
    {
        "id": "07_robot",
        "name": "机器人",
        "color_top": "#f59e0b", "color_bot": "#d97706",
        "assign": "qq机械人",
    },
    {
        "id": "08_memo",
        "name": "便签",
        "color_top": "#eab308", "color_bot": "#ca8a04",
        "assign": "memos",
    },
    {
        "id": "09_globe",
        "name": "网络",
        "color_top": "#a855f7", "color_bot": "#7e22ce",
        "assign": "三维导航, 万维网, 网站导航",
    },
    {
        "id": "10_star",
        "name": "收藏",
        "color_top": "#ec4899", "color_bot": "#be185d",
        "assign": "GitHub 项目 (周末攻略/ETF/serenity)",
    },
]

# ----------------------------------------------------------------------
def hex_to_rgb(h):
    h = h.lstrip('#')
    return tuple(int(h[i:i+2], 16) for i in (0, 2, 4))

def lerp_color(c1, c2, t):
    return tuple(int(c1[i] + (c2[i] - c1[i]) * t) for i in range(3))

def rounded_mask(size, radius):
    mask = Image.new('L', (size, size), 0)
    d = ImageDraw.Draw(mask)
    d.rounded_rectangle([0, 0, size - 1, size - 1], radius=radius, fill=255)
    return mask

def gradient_bg(size, color_top, color_bot):
    base = Image.new('RGB', (size, size), color_top)
    top_rgb = hex_to_rgb(color_top)
    bot_rgb = hex_to_rgb(color_bot)
    for y in range(size):
        t = y / (size - 1)
        c = lerp_color(top_rgb, bot_rgb, t)
        for x in range(size):
            base.putpixel((x, y), c)
    return base

# ----------------------------------------------------------------------
# 符号绘制函数（在 256x256 画布上，中心 128x128 区域是符号安全区）

def symbol_ai_chip(draw):
    cx, cy = SIZE // 2, SIZE // 2
    chip_size, pin_len, pin_w, half = 90, 14, 7, 45
    # CPU 主体
    draw.rounded_rectangle([cx - half, cy - half, cx + half, cy + half],
                           radius=14, fill='white')
    # 内圈（背景色，露出两层结构）
    inner = 50
    draw.rounded_rectangle([cx - inner, cy - inner, cx + inner, cy + inner],
                           radius=10, fill='#6366f1')
    # 内圈中心点缀
    draw.ellipse([cx - 12, cy - 12, cx + 12, cy + 12], fill='white')
    # 4 边引脚
    for dy in [-30, 0, 30]:
        draw.rectangle([cx - pin_w // 2, cy - half - pin_len,
                        cx + pin_w // 2, cy - half], fill='white')
        draw.rectangle([cx - pin_w // 2, cy + half,
                        cx + pin_w // 2, cy + half + pin_len], fill='white')
    for dx in [-30, 0, 30]:
        draw.rectangle([cx - half - pin_len, cy - pin_w // 2,
                        cx - half, cy + pin_w // 2], fill='white')
        draw.rectangle([cx + half, cy - pin_w // 2,
                        cx + half + pin_len, cy + pin_w // 2], fill='white')

def symbol_search(draw):
    cx, cy = SIZE // 2, SIZE // 2
    r = 38
    draw.ellipse([cx - r - 8, cy - r - 8, cx + r + 8, cy + r + 8],
                 outline='white', width=14)
    draw.line([cx + r - 4, cy + r - 4, cx + r + 38, cy + r + 38],
              fill='white', width=16)
    draw.ellipse([cx + r + 30, cy + r + 30, cx + r + 50, cy + r + 50],
                 fill='white')

def symbol_video(draw):
    cx, cy = SIZE // 2, SIZE // 2
    s = 50
    draw.polygon([
        (cx - s * 0.6, cy - s), (cx - s * 0.6, cy + s), (cx + s * 0.85, cy),
    ], fill='white')

def symbol_terminal(draw):
    cx, cy = SIZE // 2, SIZE // 2
    w, h = 140, 100
    x0, y0 = cx - w // 2, cy - h // 2
    draw.rounded_rectangle([x0, y0, x0 + w, y0 + h], radius=10,
                           outline='white', width=10)
    for dx in [15, 30, 45]:
        draw.ellipse([x0 + dx - 5, y0 + 12 - 5, x0 + dx + 5, y0 + 12 + 5],
                     fill='white')
    draw.line([x0 + 20, y0 + 55, x0 + 38, y0 + 73], fill='white', width=8)
    draw.line([x0 + 38, y0 + 73, x0 + 20, y0 + 91], fill='white', width=8)
    draw.rectangle([x0 + 50, y0 + 75, x0 + 90, y0 + 85], fill='white')

def symbol_cloud(draw):
    cx, cy = SIZE // 2, SIZE // 2
    draw.ellipse([cx - 60, cy - 10, cx - 10, cy + 40], fill='white')
    draw.ellipse([cx - 30, cy - 35, cx + 20, cy + 25], fill='white')
    draw.ellipse([cx, cy - 20, cx + 60, cy + 40], fill='white')
    draw.rectangle([cx - 45, cy + 15, cx + 40, cy + 45], fill='white')
    draw.line([cx, cy + 70, cx, cy + 30], fill='white', width=10)
    draw.polygon([(cx - 16, cy + 42), (cx, cy + 22), (cx + 16, cy + 42)],
                 fill='white')

def symbol_server(draw):
    cx, cy = SIZE // 2, SIZE // 2
    box_w, box_h, gap = 120, 28, 8
    total_h = box_h * 3 + gap * 2
    y_start = cy - total_h // 2
    for i in range(3):
        y = y_start + i * (box_h + gap)
        draw.rounded_rectangle([cx - box_w // 2, y, cx + box_w // 2, y + box_h],
                               radius=6, outline='white', width=6)
        draw.ellipse([cx - box_w // 2 + 14, y + box_h // 2 - 5,
                      cx - box_w // 2 + 24, y + box_h // 2 + 5], fill='white')
        draw.line([cx + 10, y + box_h // 2, cx + box_w // 2 - 14,
                   y + box_h // 2], fill='white', width=5)

def symbol_robot(draw):
    cx, cy = SIZE // 2, SIZE // 2
    head_w, head_h = 110, 100
    draw.rounded_rectangle([cx - head_w // 2, cy - head_h // 2,
                            cx + head_w // 2, cy + head_h // 2],
                           radius=18, outline='white', width=8)
    draw.ellipse([cx - 28, cy - 18, cx - 8, cy + 2], fill='white')
    draw.ellipse([cx + 8, cy - 18, cx + 28, cy + 2], fill='white')
    draw.line([cx - 18, cy + 22, cx + 18, cy + 22], fill='white', width=6)
    draw.line([cx, cy - head_h // 2, cx, cy - head_h // 2 - 22],
              fill='white', width=6)
    draw.ellipse([cx - 8, cy - head_h // 2 - 30, cx + 8,
                  cy - head_h // 2 - 14], fill='white')
    draw.rectangle([cx - head_w // 2 - 10, cy - 12,
                    cx - head_w // 2 + 2, cy + 12], fill='white')
    draw.rectangle([cx + head_w // 2 - 2, cy - 12,
                    cx + head_w // 2 + 10, cy + 12], fill='white')

def symbol_memo(draw):
    cx, cy = SIZE // 2, SIZE // 2
    w, h = 110, 130
    x0, y0 = cx - w // 2, cy - h // 2
    draw.polygon([
        (x0, y0), (x0 + w - 20, y0),
        (x0 + w, y0 + 20), (x0 + w, y0 + h), (x0, y0 + h),
    ], fill='white')
    draw.polygon([
        (x0 + w - 20, y0), (x0 + w - 20, y0 + 20), (x0 + w, y0 + 20),
    ], fill='#eab308')
    for i in range(4):
        y = y0 + 45 + i * 18
        line_w = 70 if i < 3 else 30
        draw.rounded_rectangle([x0 + 15, y, x0 + 15 + line_w, y + 6],
                               radius=3, fill='#eab308')
    draw.line([x0 + 18, y0 + h - 22, x0 + 32, y0 + h - 8],
              fill='white', width=8)
    draw.line([x0 + 32, y0 + h - 8, x0 + 65, y0 + h - 38],
              fill='white', width=8)

def symbol_globe(draw):
    cx, cy = SIZE // 2, SIZE // 2
    r = 55
    draw.ellipse([cx - r, cy - r, cx + r, cy + r], outline='white', width=8)
    draw.ellipse([cx - r // 2, cy - r, cx + r // 2, cy + r],
                 outline='white', width=6)
    draw.line([cx - r, cy, cx + r, cy], fill='white', width=6)
    draw.arc([cx - r, cy - r // 2, cx + r, cy + r // 2],
             start=200, end=340, fill='white', width=6)
    draw.arc([cx - r, cy - r // 2, cx + r, cy + r // 2],
             start=20, end=160, fill='white', width=6)

def symbol_star(draw):
    cx, cy = SIZE // 2, SIZE // 2
    r_outer, r_inner = 58, 24
    points = []
    for i in range(10):
        angle = math.pi / 2 + i * math.pi / 5
        r = r_outer if i % 2 == 0 else r_inner
        x = cx + r * math.cos(angle)
        y = cy - r * math.sin(angle)
        points.append((x, y))
    draw.polygon(points, fill='white')


SYMBOL_FUNCS = {
    "01_ai_chip": symbol_ai_chip,
    "02_search": symbol_search,
    "03_video": symbol_video,
    "04_terminal": symbol_terminal,
    "05_cloud": symbol_cloud,
    "06_server": symbol_server,
    "07_robot": symbol_robot,
    "08_memo": symbol_memo,
    "09_globe": symbol_globe,
    "10_star": symbol_star,
}

# ----------------------------------------------------------------------
def generate_one(cfg):
    bg = gradient_bg(SIZE, cfg["color_top"], cfg["color_bot"])
    mask = rounded_mask(SIZE, RADIUS)
    bg_rgba = bg.convert('RGBA')
    bg_rgba.putalpha(mask)
    symbol_layer = Image.new('RGBA', (SIZE, SIZE), (0, 0, 0, 0))
    symbol_draw = ImageDraw.Draw(symbol_layer)
    SYMBOL_FUNCS[cfg["id"]](symbol_draw)
    final = Image.alpha_composite(bg_rgba, symbol_layer)
    out_path = os.path.join(OUTPUT_DIR, f"{cfg['id']}.png")
    final.save(out_path, 'PNG', optimize=True)
    return out_path


def main():
    print("=" * 60)
    print(f"h-panel 图标生成 → {OUTPUT_DIR}")
    print("=" * 60)
    for cfg in ICONS:
        path = generate_one(cfg)
        size_kb = os.path.getsize(path) / 1024
        print(f"  ✓ {cfg['id']}.png ({size_kb:.1f} KB)  [{cfg['name']}] → {cfg['assign']}")
    # 预览
    preview = Image.new('RGB', (SIZE * 5 + 60, SIZE * 2 + 30), '#f9fafb')
    for i, cfg in enumerate(ICONS):
        icon = Image.open(os.path.join(OUTPUT_DIR, f"{cfg['id']}.png")).convert('RGBA')
        col, row = i % 5, i // 5
        x, y = 10 + col * (SIZE + 12), 10 + row * (SIZE + 10)
        preview.paste(icon, (x, y), icon)
    preview_path = os.path.join(OUTPUT_DIR, '_preview.png')
    preview.save(preview_path, 'PNG', optimize=True)
    print(f"\n预览图: {preview_path}")


if __name__ == '__main__':
    main()