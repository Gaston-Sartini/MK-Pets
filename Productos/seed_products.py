"""
Seed products from the MK-Pets Word document into Supabase.
- Extracts images in document order via python-docx
- Uploads to Supabase Storage (bucket: products)
- Inserts Product + ProductVariant rows via REST API
"""

import secrets
import unicodedata
import re
import json
import requests
from datetime import datetime
from docx import Document
from lxml import etree

# ── Config ────────────────────────────────────────────────────────────────────
SUPABASE_URL = "https://ctttonxivmozsqegzotb.supabase.co"
ANON_KEY     = ("eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9"
                ".eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImN0dHRvbnhpdm1venNxZWd6b3RiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg3OTM4NTEsImV4cCI6MjA5NDM2OTg1MX0"
                ".3dgpb5jeKqOq2mivk5vVgkQDqcSeoy-9_0UdrT1Z9Rk")
BUCKET = "products"
DOCX_PATH = r"D:\MK-Pets\Productos\Listado de productos por separado (con imagenes).docx"

# ── Category IDs (already in DB) ─────────────────────────────────────────────
CAT_GATOS   = "cc9989de2083ac93a5504e7b"
CAT_PERROS  = "c3653e1d2434399ba7e1f33a"
CAT_SNACKS  = "cd1878a8e3d8ae00aaa16c7e"
CAT_HUMEDOS = "c3621ae0daac0ac43d115430"
CAT_HIGIENE = "c5335e434c3280959a7e9d2e"

HEADERS = {
    "apikey":        ANON_KEY,
    "Authorization": f"Bearer {ANON_KEY}",
    "Content-Type":  "application/json",
    "Prefer":        "return=minimal",
}

# ── Helpers ───────────────────────────────────────────────────────────────────
def gen_id() -> str:
    return "c" + secrets.token_hex(12)[:23]

def slugify(text: str) -> str:
    text = unicodedata.normalize("NFD", text)
    text = text.encode("ascii", "ignore").decode("ascii")
    text = text.lower()
    text = re.sub(r"[^a-z0-9]+", "-", text)
    return text.strip("-")

def img_ext(content_type: str) -> str:
    ext = content_type.split("/")[-1].lower()
    return "jpg" if ext in ("jpeg", "jpg") else ext

MIME = {"jpg": "image/jpeg", "jpeg": "image/jpeg", "png": "image/png",
        "webp": "image/webp", "gif": "image/gif"}

def upload_image(blob: bytes, ext: str, label: str) -> str | None:
    yyyymm = datetime.now().strftime("%Y-%m")
    path   = f"{yyyymm}/{slugify(label)}-{secrets.token_hex(6)}.{ext}"
    url    = f"{SUPABASE_URL}/storage/v1/object/{BUCKET}/{path}"
    resp   = requests.post(url, data=blob, headers={
        "Authorization": f"Bearer {ANON_KEY}",
        "Content-Type":  MIME.get(ext, f"image/{ext}"),
        "x-upsert":      "false",
    })
    if resp.status_code not in (200, 201):
        print(f"    ✗ upload failed [{resp.status_code}]: {resp.text[:120]}")
        return None
    pub = f"{SUPABASE_URL}/storage/v1/object/public/{BUCKET}/{path}"
    print(f"    ✓ {path}")
    return pub

def insert_product(name, category_id, base_price, img_indices, variants, img_urls):
    images = [img_urls[i] for i in img_indices if img_urls[i] is not None]
    pid = gen_id()
    payload = {
        "id":         pid,
        "name":       name,
        "slug":       slugify(name),
        "images":     images,
        "basePrice":  base_price,
        "stock":      10,
        "isActive":   True,
        "isFeatured": False,
        "badge":      None,
        "categoryId": category_id,
    }
    resp = requests.post(f"{SUPABASE_URL}/rest/v1/Product", headers=HEADERS, json=payload)
    if resp.status_code not in (200, 201):
        print(f"  ✗ product '{name}': [{resp.status_code}] {resp.text[:200]}")
        return None
    print(f"  ✓ Product: {name}")

    for v in variants:
        vid = gen_id()
        vp = {"id": vid, "productId": pid, "label": v["label"],
              "price": v["price"], "stock": 10}
        vr = requests.post(f"{SUPABASE_URL}/rest/v1/ProductVariant",
                           headers=HEADERS, json=vp)
        if vr.status_code not in (200, 201):
            print(f"    ✗ variant '{v['label']}': [{vr.status_code}] {vr.text[:120]}")
        else:
            print(f"    ✓ variant: {v['label']} → ${v['price']}")
    return pid

# ── Step 1: Extract images in document order ──────────────────────────────────
print("=" * 60)
print("Step 1 — Extracting images from docx in document order")
print("=" * 60)

doc = Document(DOCX_PATH)

NS_A  = "http://schemas.openxmlformats.org/drawingml/2006/main"
NS_R  = "http://schemas.openxmlformats.org/officeDocument/2006/relationships"
NS_WP = "http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing"
BLIP_TAG = f"{{{NS_A}}}blip"
EMBED_ATTR = f"{{{NS_R}}}embed"

images_in_order = []
seen_rids = set()

for para in doc.paragraphs:
    for run in para.runs:
        for drawing in run.element.iter(f"{{{NS_WP}}}inline", f"{{{NS_WP}}}anchor"):
            for blip in drawing.iter(BLIP_TAG):
                rid = blip.get(EMBED_ATTR)
                if rid and rid not in seen_rids:
                    seen_rids.add(rid)
                    part = doc.part.rels[rid].target_part
                    ext  = img_ext(part.content_type)
                    images_in_order.append((part.blob, ext))

print(f"Found {len(images_in_order)} images\n")

# ── Step 2: Upload all images ─────────────────────────────────────────────────
print("=" * 60)
print("Step 2 — Uploading images to Supabase Storage")
print("=" * 60)

# Labels for filenames (same order as images appear in the doc)
IMG_LABELS = [
    "eukanuba-adulto-mediano-2kg",                  # 0
    "old-prince-cordero-adulto-perro",              # 1
    "sabrositos-perro",                             # 2
    "purina-pro-plan-sensitive-skin-7-5kg",         # 3
    "humedo-perro-100g-carne",                      # 4
    "humedo-perro-100g-pollo",                      # 5
    "pedigree-dentastix-pequeñas-7u",              # 6
    "pedigree-dentastix-medianas-7u",              # 7
    "pedigree-biscrok-500g",                        # 8
    "pedigree-biscrok-100g",                        # 9
    "purina-excellent-adultos-gato",                # 10
    "purina-excellent-urinary-gato",                # 11
    "old-prince-premium-gato-1kg",                  # 12
    "old-prince-cordero-esterilizados-gato",        # 13
    "piedritas-gatos-3-6kg",                        # 14
    "piedritas-minino-12-5kg",                      # 15
    "arena-glutinante-neutra",                      # 16
    "arena-glutinante-premium-10kg",                # 17
    "piedra-bentonita-carbon-activo-6kg",           # 18
    "catit-creamy-snacks-gato",                     # 19
    "whiskas-humedo-85g",                           # 20
    "cat-chow-humedo-85g",                          # 21
]

img_urls: list[str | None] = []
for i, (blob, ext) in enumerate(images_in_order):
    label = IMG_LABELS[i] if i < len(IMG_LABELS) else f"product-{i}"
    print(f"  [{i}] {label}.{ext}")
    url = upload_image(blob, ext, label)
    img_urls.append(url)

# Pad if fewer images than expected
while len(img_urls) < len(IMG_LABELS):
    img_urls.append(None)

print()

# ── Step 3: Insert products ───────────────────────────────────────────────────
print("=" * 60)
print("Step 3 — Inserting products and variants")
print("=" * 60)

products = [
    # ── PERROS ────────────────────────────────────────────────────────────
    {
        "name":     "Eukanuba Adulto Mediano 2 KG",
        "cat":      CAT_PERROS,
        "price":    10000,
        "imgs":     [0],
        "variants": [],
    },
    {
        "name":     "Old Prince Cordero Adulto Mediano y Largo",
        "cat":      CAT_PERROS,
        "price":    6300,
        "imgs":     [1],
        "variants": [
            {"label": "1 KG",  "price": 6300},
            {"label": "2 KG",  "price": 12000},
        ],
    },
    {
        "name":     "Sabrositos",
        "cat":      CAT_PERROS,
        "price":    26500,
        "imgs":     [2],
        "variants": [
            {"label": "15 KG", "price": 26500},
            {"label": "20 KG", "price": 33500},
        ],
    },
    {
        "name":     "Purina PRO PLAN Sensitive Skin 7,5 KG",
        "cat":      CAT_PERROS,
        "price":    80000,
        "imgs":     [3],
        "variants": [],
    },
    {
        "name":     "Alimento Húmedo Perro 100g",
        "cat":      CAT_HUMEDOS,
        "price":    2000,
        "imgs":     [4, 5],
        "variants": [
            {"label": "Carne", "price": 2000},
            {"label": "Pollo", "price": 2000},
        ],
    },
    {
        "name":     "Pedigree Dentastix Razas Pequeñas (7 unidades)",
        "cat":      CAT_SNACKS,
        "price":    3800,
        "imgs":     [6],
        "variants": [],
    },
    {
        "name":     "Pedigree Dentastix Razas Medianas (7 unidades)",
        "cat":      CAT_SNACKS,
        "price":    4500,
        "imgs":     [7],
        "variants": [],
    },
    {
        "name":     "Pedigree Biscrok 500g",
        "cat":      CAT_SNACKS,
        "price":    6500,
        "imgs":     [8],
        "variants": [],
    },
    {
        "name":     "Pedigree Biscrok 100g",
        "cat":      CAT_SNACKS,
        "price":    2500,
        "imgs":     [9],
        "variants": [],
    },
    # ── GATOS ─────────────────────────────────────────────────────────────
    {
        "name":     "Purina Excellent Adultos",
        "cat":      CAT_GATOS,
        "price":    8300,
        "imgs":     [10],
        "variants": [
            {"label": "1 KG",  "price": 8300},
            {"label": "2 KG",  "price": 16000},
        ],
    },
    {
        "name":     "Purina Excellent Urinary",
        "cat":      CAT_GATOS,
        "price":    11500,
        "imgs":     [11],
        "variants": [
            {"label": "1 KG",   "price": 11500},
            {"label": "7,5 KG", "price": 68000},
        ],
    },
    {
        "name":     "Old Prince Premium Gatos 1 KG",
        "cat":      CAT_GATOS,
        "price":    7300,
        "imgs":     [12],
        "variants": [],
    },
    {
        "name":     "Old Prince Cordero Gatos Esterilizados",
        "cat":      CAT_GATOS,
        "price":    33000,
        "imgs":     [13],
        "variants": [
            {"label": "3 KG",   "price": 33000},
            {"label": "7,5 KG", "price": 70000},
        ],
    },
    {
        "name":     "Piedritas para Gatos 3,6 KG",
        "cat":      CAT_HIGIENE,
        "price":    5000,
        "imgs":     [14],
        "variants": [],
    },
    {
        "name":     "Piedritas Minino 12,5 KG",
        "cat":      CAT_HIGIENE,
        "price":    10000,
        "imgs":     [15],
        "variants": [],
    },
    {
        "name":     "Arena Glutinante Neutra",
        "cat":      CAT_HIGIENE,
        "price":    7500,
        "imgs":     [16],
        "variants": [
            {"label": "5,3 KG", "price": 7500},
            {"label": "15 KG",  "price": 15000},
        ],
    },
    {
        "name":     "Arena Glutinante Premium 10 KG",
        "cat":      CAT_HIGIENE,
        "price":    15000,
        "imgs":     [17],
        "variants": [],
    },
    {
        "name":     "Piedra Bentonita Aglomerante Carbon Activo 6 KG",
        "cat":      CAT_HIGIENE,
        "price":    16000,
        "imgs":     [18],
        "variants": [],
    },
    {
        "name":     "Catit Creamy Snacks para Gatos",
        "cat":      CAT_SNACKS,
        "price":    4800,
        "imgs":     [19],
        "variants": [
            {"label": "Salmón (4 tubos)", "price": 4800},
            {"label": "Atún (4 tubos)",   "price": 4800},
            {"label": "Pollo (4 tubos)",  "price": 4800},
        ],
    },
    {
        "name":     "Whiskas Húmedo 85g",
        "cat":      CAT_HUMEDOS,
        "price":    1800,
        "imgs":     [20],
        "variants": [],
    },
    {
        "name":     "Cat Chow Húmedo 85g",
        "cat":      CAT_HUMEDOS,
        "price":    2500,
        "imgs":     [21],
        "variants": [],
    },
]

inserted = 0
for p in products:
    pid = insert_product(
        name=p["name"],
        category_id=p["cat"],
        base_price=p["price"],
        img_indices=p["imgs"],
        variants=p["variants"],
        img_urls=img_urls,
    )
    if pid:
        inserted += 1

print()
print("=" * 60)
print(f"Done — {inserted}/{len(products)} products inserted")
print("=" * 60)
