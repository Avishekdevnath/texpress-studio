"""
TeXPress Studio - Brand Assets Generation Pipeline
Processes the official brand logo files into production-grade multi-resolution Windows ICO,
square PNG icons, transparent horizontal brand lockups (Light & Dark mode), and welcome heroes.
"""

import os
from PIL import Image
import numpy as np

MAIN_LOGO_PATH = r"C:\Users\HP\Downloads\TeXPress_main_logo.png"
APP_LOGO_PATH = r"C:\Users\HP\Downloads\TeXPress_main_app_logo.png"

TARGET_DIRS = [
    os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "assets")),
    os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "ui", "assets")),
    os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "dist", "TeXPress-win32-x64", "resources", "app", "assets")),
    os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "dist", "TeXPress-win32-x64", "resources", "app", "ui", "assets"))
]

for d in TARGET_DIRS:
    os.makedirs(d, exist_ok=True)

print("Target directories verified.")

# ==============================================================================
# 1. PROCESS APP ICON (Pure 3D TP Emblem) -> icon.ico & square PNGs
# ==============================================================================
print("\n--- Processing App Icon ---")
img_app = Image.open(APP_LOGO_PATH).convert("RGBA")
arr_app = np.array(img_app)
alpha_app = arr_app[:, :, 3]
mask_app = (alpha_app > 10).astype(np.uint8) * 255
bbox_app = Image.fromarray(mask_app).getbbox()
print("App Icon visible content bbox:", bbox_app)

pad_app = 16
crop_box_app = (
    max(0, bbox_app[0] - pad_app),
    max(0, bbox_app[1] - pad_app),
    min(img_app.width, bbox_app[2] + pad_app),
    min(img_app.height, bbox_app[3] + pad_app)
)
cropped_app = img_app.crop(crop_box_app)

# Create perfectly square canvas centered with breathing room
dim = max(cropped_app.width, cropped_app.height)
# Add 5% breathing room around icon
canvas_dim = int(dim * 1.08)
square_app = Image.new("RGBA", (canvas_dim, canvas_dim), (0, 0, 0, 0))
off_x = (canvas_dim - cropped_app.width) // 2
off_y = (canvas_dim - cropped_app.height) // 2
square_app.paste(cropped_app, (off_x, off_y), cropped_app)

# Resize to standard icon sizes using Lanczos
icon_512 = square_app.resize((512, 512), Image.Resampling.LANCZOS)
icon_256 = square_app.resize((256, 256), Image.Resampling.LANCZOS)
icon_128 = square_app.resize((128, 128), Image.Resampling.LANCZOS)
icon_64  = square_app.resize((64, 64),   Image.Resampling.LANCZOS)
icon_48  = square_app.resize((48, 48),   Image.Resampling.LANCZOS)
icon_32  = square_app.resize((32, 32),   Image.Resampling.LANCZOS)
icon_24  = square_app.resize((24, 24),   Image.Resampling.LANCZOS)
icon_16  = square_app.resize((16, 16),   Image.Resampling.LANCZOS)

ico_sizes = [(256, 256), (128, 128), (64, 64), (48, 48), (32, 32), (24, 24), (16, 16)]

for d in TARGET_DIRS:
    # Save multi-resolution Windows ICO
    ico_dest = os.path.join(d, "icon.ico")
    square_app.save(ico_dest, format="ICO", sizes=ico_sizes)
    
    # Save individual PNG icons
    icon_512.save(os.path.join(d, "icon.png"), format="PNG")
    icon_256.save(os.path.join(d, "icon_256.png"), format="PNG")
    icon_128.save(os.path.join(d, "icon_128.png"), format="PNG")
    icon_64.save(os.path.join(d, "icon_64.png"), format="PNG")
    icon_32.save(os.path.join(d, "icon_32.png"), format="PNG")
    icon_16.save(os.path.join(d, "icon_16.png"), format="PNG")

print("App icon assets generated successfully in all target directories.")

# ==============================================================================
# 2. PROCESS MAIN LOGO (Horizontal Lockup) -> Light and Dark Variants
# ==============================================================================
print("\n--- Processing Main Brand Lockup ---")
img_main = Image.open(MAIN_LOGO_PATH).convert("RGBA")
arr_main = np.array(img_main)
alpha_main = arr_main[:, :, 3]
mask_main = (alpha_main > 10).astype(np.uint8) * 255
bbox_main = Image.fromarray(mask_main).getbbox()
print("Main Logo visible content bbox:", bbox_main)

pad_main = 16
crop_box_main = (
    max(0, bbox_main[0] - pad_main),
    max(0, bbox_main[1] - pad_main),
    min(img_main.width, bbox_main[2] + pad_main),
    min(img_main.height, bbox_main[3] + pad_main)
)
cropped_main_light = img_main.crop(crop_box_main)

# Create Dark Mode variant where "TeX" and "STUDIO" typography is crisp white
arr_crop = np.array(cropped_main_light).copy()
r, g, b, a = arr_crop[:, :, 0], arr_crop[:, :, 1], arr_crop[:, :, 2], arr_crop[:, :, 3]

# Identify dark grey/black letters (TeX and STUDIO)
dark_text_mask = (r < 80) & (g < 80) & (b < 95) & (a > 30)

# Replace dark letters with off-white (#f8fafc) while keeping antialiased edge blending
arr_crop[dark_text_mask, 0] = 248
arr_crop[dark_text_mask, 1] = 250
arr_crop[dark_text_mask, 2] = 252

cropped_main_dark = Image.fromarray(arr_crop, mode="RGBA")

# Generate standard display sizes
for d in TARGET_DIRS:
    # Full res master logos
    cropped_main_light.save(os.path.join(d, "logo_horizontal.png"), format="PNG")
    cropped_main_dark.save(os.path.join(d, "logo_horizontal_dark.png"), format="PNG")
    
    # Hero sized logos for Welcome Screen (height ~140px)
    hero_h = 140
    hero_w = int(cropped_main_light.width * (hero_h / cropped_main_light.height))
    hero_light = cropped_main_light.resize((hero_w, hero_h), Image.Resampling.LANCZOS)
    hero_dark = cropped_main_dark.resize((hero_w, hero_h), Image.Resampling.LANCZOS)
    
    hero_light.save(os.path.join(d, "logo_hero.png"), format="PNG")
    hero_dark.save(os.path.join(d, "logo_hero_dark.png"), format="PNG")

print("Main brand lockup assets (Light & Dark) generated successfully in all target directories.")
print("\nALL ASSETS GENERATED CLEANLY!")
