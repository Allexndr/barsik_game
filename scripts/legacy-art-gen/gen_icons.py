#!/usr/bin/env python3
"""Generate cute flat SVG icons for Barsik game."""
import os

OUT = "assets/icons"
os.makedirs(OUT, exist_ok=True)
os.makedirs(f"{OUT}/friends", exist_ok=True)
os.makedirs(f"{OUT}/obstacles", exist_ok=True)
os.makedirs(f"{OUT}/city", exist_ok=True)

def write(path, body):
    full = os.path.join(OUT, path)
    os.makedirs(os.path.dirname(full), exist_ok=True)
    with open(full, "w", encoding="utf-8") as f:
        f.write(f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" width="64" height="64">{body}</svg>')
    print("wrote", full)

def face(cx, cy, r, color):
    """Cute face with big eyes and small smile."""
    eye_y = cy - r * 0.15
    eye_dx = r * 0.35
    eye_r = r * 0.18
    return f'''
      <circle cx="{cx}" cy="{cy}" r="{r}" fill="{color}" stroke="#2d3436" stroke-width="2"/>
      <circle cx="{cx - eye_dx}" cy="{eye_y}" r="{eye_r}" fill="white"/>
      <circle cx="{cx + eye_dx}" cy="{eye_y}" r="{eye_r}" fill="white"/>
      <circle cx="{cx - eye_dx}" cy="{eye_y}" r="{eye_r*0.45}" fill="#2d3436"/>
      <circle cx="{cx + eye_dx}" cy="{eye_y}" r="{eye_r*0.45}" fill="#2d3436"/>
      <circle cx="{cx}" cy="{eye_y + eye_r*0.6}" r="{eye_r*0.2}" fill="#ff7675"/>
      <path d="M {cx-eye_r} {eye_y+eye_r*1.4} Q {cx} {eye_y+eye_r*1.9} {cx+eye_r} {eye_y+eye_r*1.4}" fill="none" stroke="#2d3436" stroke-width="2" stroke-linecap="round"/>
    '''

def cat(color="#dfe6e9"):
    body = f'''
      <ellipse cx="32" cy="42" rx="22" ry="18" fill="{color}" stroke="#2d3436" stroke-width="2"/>
      <polygon points="18,24 12,8 28,18" fill="{color}" stroke="#2d3436" stroke-width="2" stroke-linejoin="round"/>
      <polygon points="46,24 52,8 36,18" fill="{color}" stroke="#2d3436" stroke-width="2" stroke-linejoin="round"/>
    ''' + face(32, 32, 14, color)
    return body

def circle_creature(color, ears=None, extra=""):
    b = f'<circle cx="32" cy="34" r="24" fill="{color}" stroke="#2d3436" stroke-width="2"/>'
    if ears:
        b += ears
    b += extra
    b += face(32, 34, 17, color)
    return b

# Friends
friends = [
    ("masha", "#fab1a0", "Кошечка"),
    ("pushok", "#dfe6e9", "Зайчик"),
    ("snezhok", "#74b9ff", "Медвежонок"),
    ("lis", "#e17055", "Лисёнок"),
    ("raduga", "#a29bfe", "Единорог"),
    ("pingvin", "#2d3436", "Пингвин"),
    ("drakon", "#00b894", "Дракончик"),
    ("obezyana", "#fdcb6e", "Обезьянка"),
    ("panda", "#dfe6e9", "Панда"),
    ("lvenok", "#fdcb6e", "Львёнок"),
    ("tigrenok", "#fdcb6e", "Тигрёнок"),
    ("koala", "#b2bec3", "Коала"),
    ("zhiraf", "#fdcb6e", "Жираф"),
    ("zebra", "#dfe6e9", "Зебра"),
    ("slon", "#b2bec3", "Слон"),
    ("kot", "#fab1a0", "Котёнок"),
    ("shchenok", "#e17055", "Щенок"),
    ("homjak", "#fab1a0", "Хомяк"),
    ("mag", "#6c5ce7", "Маг"),
    ("feya", "#fd79a8", "Фея"),
]

for fid, color, label in friends:
    extra = ""
    ears = ""
    if fid in ("masha","kot"):
        ears = f'<circle cx="18" cy="18" r="7" fill="{color}" stroke="#2d3436" stroke-width="2"/><circle cx="46" cy="18" r="7" fill="{color}" stroke="#2d3436" stroke-width="2"/>'
    elif fid == "pushok":
        ears = f'<ellipse cx="16" cy="16" rx="6" ry="12" fill="{color}" stroke="#2d3436" stroke-width="2"/><ellipse cx="48" cy="16" rx="6" ry="12" fill="{color}" stroke="#2d3436" stroke-width="2"/>'
    elif fid == "raduga":
        ears = f'<polygon points="18,20 12,4 26,14" fill="{color}" stroke="#2d3436" stroke-width="2"/><polygon points="46,20 52,4 38,14" fill="{color}" stroke="#2d3436" stroke-width="2"/>'
        extra = '<path d="M 12 50 Q 32 60 52 50" fill="none" stroke="#6c5ce7" stroke-width="3" stroke-linecap="round"/>'
    elif fid == "pingvin":
        extra = '<ellipse cx="32" cy="42" rx="12" ry="16" fill="white" stroke="#2d3436" stroke-width="2"/>'
    elif fid == "mag":
        extra = '<polygon points="20,16 32,2 44,16" fill="#6c5ce7" stroke="#2d3436" stroke-width="2"/><path d="M 20 16 Q 32 24 44 16" fill="none" stroke="#2d3436" stroke-width="2"/>'
    elif fid == "feya":
        extra = '<path d="M 8 34 Q 20 18 32 30 Q 44 18 56 34 Q 44 50 32 38 Q 20 50 8 34 Z" fill="#fdcb6e" opacity="0.8" stroke="#2d3436" stroke-width="1.5"/>'
    elif fid == "drakon":
        extra = '<path d="M 52 30 L 60 22 L 56 34" fill="#00b894" stroke="#2d3436" stroke-width="2"/>'
    elif fid == "zhiraf":
        extra = '<path d="M 36 16 L 36 6 L 28 6" fill="none" stroke="#2d3436" stroke-width="2" stroke-linecap="round"/><circle cx="32" cy="6" r="6" fill="#fdcb6e" stroke="#2d3436" stroke-width="2"/>'
    elif fid == "slon":
        extra = '<path d="M 24 48 Q 32 58 40 48" fill="none" stroke="#2d3436" stroke-width="2"/>'
    elif fid == "tigrenok":
        extra = '<path d="M 20 26 L 28 26 M 36 26 L 44 26" stroke="#2d3436" stroke-width="2" stroke-linecap="round"/>'
    write(f"friends/{fid}.svg", circle_creature(color, ears, extra))

# Costumes
costumes = {
    "default": cat("#dfe6e9"),
    "superhero": cat("#74b9ff") + '<path d="M 12 20 L 32 12 L 52 20 L 44 28 L 32 24 L 20 28 Z" fill="#e17055" stroke="#2d3436" stroke-width="2"/>',
    "wizard": cat("#a29bfe") + '<polygon points="20,16 32,4 44,16" fill="#6c5ce7" stroke="#2d3436" stroke-width="2"/><circle cx="42" cy="14" r="3" fill="#fdcb6e"/>',
    "astronaut": cat("#b2bec3") + '<circle cx="32" cy="16" r="10" fill="#74b9ff" stroke="#2d3436" stroke-width="2" opacity="0.7"/>',
    "pirate": cat("#fab1a0") + '<path d="M 16 18 Q 32 24 48 18 L 48 22 Q 32 28 16 22 Z" fill="#2d3436"/><circle cx="36" cy="34" r="3" fill="#2d3436"/><path d="M 42 32 L 48 38" stroke="#2d3436" stroke-width="2"/>',
    "rainbow": cat("#fff") + '<path d="M 12 50 Q 32 62 52 50" fill="none" stroke="#e17055" stroke-width="3"/><path d="M 16 50 Q 32 58 48 50" fill="none" stroke="#fdcb6e" stroke-width="3"/>',
}
for cid, body in costumes.items():
    write(f"costumes/{cid}.svg", body)

# Obstacles
obstacles = [
    ("rock", '<circle cx="32" cy="38" r="20" fill="#636e72" stroke="#2d3436" stroke-width="2"/><circle cx="24" cy="30" r="5" fill="#b2bec3" opacity="0.5"/>'),
    ("log", '<rect x="8" y="30" width="48" height="18" rx="9" fill="#8d6e63" stroke="#2d3436" stroke-width="2"/><circle cx="16" cy="39" r="6" fill="#d7ccc8" stroke="#2d3436" stroke-width="1.5"/><circle cx="48" cy="39" r="6" fill="#d7ccc8" stroke="#2d3436" stroke-width="1.5"/>'),
    ("stump", '<ellipse cx="32" cy="42" rx="16" ry="12" fill="#8d6e63" stroke="#2d3436" stroke-width="2"/><ellipse cx="32" cy="32" rx="16" ry="8" fill="#a1887f" stroke="#2d3436" stroke-width="2"/>'),
    ("cactus", '<rect x="26" y="20" width="12" height="40" rx="6" fill="#00b894" stroke="#2d3436" stroke-width="2"/><rect x="14" y="30" width="10" height="18" rx="5" fill="#00b894" stroke="#2d3436" stroke-width="2"/><rect x="40" y="24" width="10" height="18" rx="5" fill="#00b894" stroke="#2d3436" stroke-width="2"/>'),
    ("ice_block", '<rect x="14" y="18" width="36" height="36" rx="6" fill="#74b9ff" stroke="#0984e3" stroke-width="2"/><line x1="18" y1="26" x2="42" y2="46" stroke="white" stroke-width="2" opacity="0.6"/><line x1="42" y1="22" x2="22" y2="48" stroke="white" stroke-width="2" opacity="0.6"/>'),
    ("snowman", '<circle cx="32" cy="46" r="12" fill="white" stroke="#2d3436" stroke-width="2"/><circle cx="32" cy="28" r="9" fill="white" stroke="#2d3436" stroke-width="2"/><circle cx="29" cy="26" r="1.5" fill="#2d3436"/><circle cx="35" cy="26" r="1.5" fill="#2d3436"/><path d="M 30 30 L 34 30" stroke="#e17055" stroke-width="2"/><path d="M 16 24 L 22 28" stroke="#2d3436" stroke-width="2"/><path d="M 48 24 L 42 28" stroke="#2d3436" stroke-width="2"/>'),
    ("crystal", '<polygon points="32,10 48,32 32,54 16,32" fill="#a29bfe" stroke="#6c5ce7" stroke-width="2"/><polygon points="32,18 40,32 32,46 24,32" fill="#e17055" opacity="0.4"/>'),
    ("trash", '<rect x="20" y="22" width="24" height="32" rx="3" fill="#b2bec3" stroke="#2d3436" stroke-width="2"/><rect x="18" y="18" width="28" height="6" rx="3" fill="#636e72" stroke="#2d3436" stroke-width="2"/>'),
    ("brick", '<rect x="14" y="20" width="36" height="28" rx="3" fill="#e17055" stroke="#2d3436" stroke-width="2"/><line x1="14" y1="34" x2="50" y2="34" stroke="#2d3436" stroke-width="1.5"/><line x1="26" y1="20" x2="26" y2="34" stroke="#2d3436" stroke-width="1.5"/><line x1="38" y1="34" x2="38" y2="48" stroke="#2d3436" stroke-width="1.5"/>'),
    ("spike", '<polygon points="32,10 48,54 16,54" fill="#636e72" stroke="#2d3436" stroke-width="2"/>'),
]
for oid, body in obstacles:
    write(f"obstacles/{oid}.svg", body)

# City decorations
city = [
    ("house", '<rect x="18" y="28" width="28" height="28" rx="3" fill="#fab1a0" stroke="#2d3436" stroke-width="2"/><polygon points="16,28 32,12 48,28" fill="#e17055" stroke="#2d3436" stroke-width="2"/><rect x="24" y="38" width="8" height="10" fill="#74b9ff" stroke="#2d3436" stroke-width="1.5"/>'),
    ("tree", '<rect x="28" y="38" width="8" height="20" fill="#8d6e63" stroke="#2d3436" stroke-width="2"/><circle cx="32" cy="28" r="14" fill="#00b894" stroke="#2d3436" stroke-width="2"/>'),
    ("fountain", '<rect x="12" y="44" width="40" height="12" rx="3" fill="#74b9ff" stroke="#2d3436" stroke-width="2"/><rect x="26" y="24" width="12" height="22" fill="#b2bec3" stroke="#2d3436" stroke-width="2"/><circle cx="32" cy="20" r="6" fill="#74b9ff" stroke="#2d3436" stroke-width="2"/>'),
    ("cafe", '<rect x="14" y="26" width="36" height="34" rx="3" fill="#fdcb6e" stroke="#2d3436" stroke-width="2"/><rect x="18" y="34" width="28" height="4" fill="white" opacity="0.6"/><rect x="18" y="42" width="28" height="4" fill="white" opacity="0.6"/>'),
    ("shop", '<rect x="16" y="30" width="32" height="28" rx="3" fill="#a29bfe" stroke="#2d3436" stroke-width="2"/><path d="M 16 30 Q 32 20 48 30" fill="none" stroke="#2d3436" stroke-width="2"/>'),
    ("park", '<path d="M 8 52 Q 32 40 56 52 L 56 54 L 8 54 Z" fill="#00b894" stroke="#2d3436" stroke-width="2"/><circle cx="20" cy="36" r="6" fill="#00b894" stroke="#2d3436" stroke-width="2"/><circle cx="44" cy="36" r="6" fill="#00b894" stroke="#2d3436" stroke-width="2"/><rect x="30" y="42" width="4" height="12" fill="#8d6e63" stroke="#2d3436" stroke-width="1.5"/>'),
    ("ball", '<circle cx="32" cy="34" r="20" fill="#fdcb6e" stroke="#2d3436" stroke-width="2"/><circle cx="32" cy="34" r="6" fill="#e17055"/>'),
    ("flower", '<line x1="32" y1="48" x2="32" y2="30" stroke="#00b894" stroke-width="3"/><circle cx="32" cy="22" r="8" fill="#e17055" stroke="#2d3436" stroke-width="2"/><circle cx="32" cy="22" r="3" fill="#fdcb6e"/>'),
    ("castle", '<rect x="22" y="32" width="20" height="24" fill="#b2bec3" stroke="#2d3436" stroke-width="2"/><rect x="16" y="20" width="8" height="20" fill="#b2bec3" stroke="#2d3436" stroke-width="2"/><rect x="40" y="20" width="8" height="20" fill="#b2bec3" stroke="#2d3436" stroke-width="2"/><rect x="28" y="40" width="8" height="16" fill="#636e72" stroke="#2d3436" stroke-width="2"/>'),
    ("firework", '<path d="M 32 52 L 32 20" stroke="#e17055" stroke-width="3" stroke-linecap="round"/><circle cx="32" cy="18" r="8" fill="#fdcb6e" opacity="0.6"/><circle cx="24" cy="26" r="3" fill="#fd79a8"/><circle cx="40" cy="26" r="3" fill="#74b9ff"/>'),
]
for cid, body in city:
    write(f"city/{cid}.svg", body)

# Items
items = {
    "star": '<polygon points="32,8 38,26 56,26 42,36 48,54 32,44 16,54 22,36 8,26 26,26" fill="#fdcb6e" stroke="#2d3436" stroke-width="2"/>',
    "heart": '<path d="M 32 52 C 32 52 10 36 10 24 C 10 16 16 10 24 10 C 28 10 32 14 32 14 C 32 14 36 10 40 10 C 48 10 54 16 54 24 C 54 36 32 52 32 52 Z" fill="#fd79a8" stroke="#2d3436" stroke-width="2"/>',
    "shield": '<path d="M 32 8 C 32 8 12 12 12 26 C 12 42 32 56 32 56 C 32 56 52 42 52 26 C 52 12 32 8 32 8 Z" fill="#74b9ff" stroke="#2d3436" stroke-width="2"/><path d="M 24 30 L 30 36 L 42 24" fill="none" stroke="white" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/>',
    "magnet": '<path d="M 26 8 L 26 20 C 26 34 38 34 38 20 L 38 8" fill="none" stroke="#e84393" stroke-width="6" stroke-linecap="round"/><path d="M 26 8 L 26 4 M 38 8 L 38 4" stroke="#2d3436" stroke-width="4" stroke-linecap="round"/>',
    "speed": '<polygon points="32,6 42,24 56,24 38,40 46,58 24,42 10,42 26,26 18,8" fill="#fdcb6e" stroke="#2d3436" stroke-width="2"/>',
    "chest": '<rect x="14" y="24" width="36" height="28" rx="4" fill="#e17055" stroke="#2d3436" stroke-width="2"/><rect x="14" y="36" width="36" height="6" fill="#d35400"/><circle cx="32" cy="38" r="5" fill="#fdcb6e" stroke="#2d3436" stroke-width="1.5"/>',
    "question": '<circle cx="32" cy="32" r="24" fill="#dfe6e9" stroke="#636e72" stroke-width="3"/><text x="32" y="42" font-size="28" fill="#636e72" text-anchor="middle" font-weight="700" font-family="Arial">?</text>',
    "check": '<circle cx="32" cy="32" r="26" fill="#00b894" stroke="#2d3436" stroke-width="3"/><path d="M 18 34 L 28 44 L 46 22" fill="none" stroke="white" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"/>',
    "lock": '<rect x="16" y="28" width="32" height="28" rx="4" fill="#636e72" stroke="#2d3436" stroke-width="3"/><path d="M 22 28 L 22 20 C 22 12 28 8 32 8 C 36 8 42 12 42 20 L 42 28" fill="none" stroke="#636e72" stroke-width="4" stroke-linecap="round"/>',
    "clipboard": '<rect x="14" y="14" width="36" height="44" rx="4" fill="white" stroke="#2d3436" stroke-width="3"/><rect x="24" y="8" width="16" height="10" rx="3" fill="#b2bec3" stroke="#2d3436" stroke-width="2"/><line x1="22" y1="30" x2="42" y2="30" stroke="#b2bec3" stroke-width="3" stroke-linecap="round"/><line x1="22" y1="40" x2="42" y2="40" stroke="#b2bec3" stroke-width="3" stroke-linecap="round"/><line x1="22" y1="50" x2="34" y2="50" stroke="#b2bec3" stroke-width="3" stroke-linecap="round"/>',
    "smile": '<circle cx="32" cy="32" r="26" fill="#fdcb6e" stroke="#2d3436" stroke-width="3"/><circle cx="24" cy="26" r="3" fill="#2d3436"/><circle cx="40" cy="26" r="3" fill="#2d3436"/><path d="M 22 38 Q 32 48 42 38" fill="none" stroke="#2d3436" stroke-width="3" stroke-linecap="round"/>',
}
for iid, body in items.items():
    write(f"items/{iid}.svg", body)

print("Done.")
