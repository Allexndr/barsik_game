#!/usr/bin/env python3
"""Generate parallax background layers for all worlds using Pollinations.ai"""
import urllib.request, urllib.parse, os, time

BASE = 'https://image.pollinations.ai/prompt/'
OUTDIR = os.path.join(os.path.dirname(__file__), 'assets')

STYLE = (
    "3D cute kawaii soft plastic toy style, {SCENE}, "
    "soft smooth lighting, bright pastel colors, "
    "children's game background, horizontal seamless panorama, "
    "no characters, no text, high quality, 3D rendered"
)

WORLDS = {
    'fruit_forest': {
        'sky': 'bright sunny sky with fluffy white clouds and rainbow, fruit forest theme',
        'far': 'distant green hills with giant strawberries and fruit trees, cute style',
        'mid': 'colorful fruit trees and bushes, apples and cherries, cute round shapes',
        'near': 'foreground bushes with berries and flowers, cute grass tufts',
    },
    'ice_valley': {
        'sky': 'cold blue sky with aurora and snowflakes, icy valley theme',
        'far': 'distant snowy mountains with ice crystals, sparkly cute style',
        'mid': 'ice cave formations and frozen trees, cute snow piles',
        'near': 'foreground snow drifts and ice crystals, cute snowflakes',
    },
    'rainbow_country': {
        'sky': 'magical sky with rainbow and sparkles, candy clouds, rainbow country theme',
        'far': 'distant candy mountains with rainbow waterfalls, cute style',
        'mid': 'colorful mushroom houses and rainbow trees, lollipop plants',
        'near': 'foreground rainbow flowers and sparkly grass, candy ground',
    },
    'mountains': {
        'sky': 'clear blue mountain sky with eagles, mountain theme',
        'far': 'distant rocky mountain peaks with snow caps, cute style',
        'mid': 'mountain pine trees and rocky paths, cute boulders',
        'near': 'foreground mountain flowers and grass tufts, small rocks',
    },
    'cola_city': {
        'sky': 'purple pink sunset sky over a soda city, cola city theme',
        'far': 'distant city skyline with soda bottle buildings, cute style',
        'mid': 'colorful city buildings with cola bubbles, cute shops',
        'near': 'foreground city street with cola fountains and flowers',
    },
    'friends_city': {
        'sky': 'warm golden sky with fireworks and confetti, friends city celebration theme',
        'far': 'distant festive city with banners and flags, cute style',
        'mid': 'celebration buildings with balloons and streamers, party decorations',
        'near': 'foreground party confetti and gift boxes, festive flowers',
    },
}

def generate(world_id, layer, desc, seed):
    prompt = STYLE.format(SCENE=desc)
    url = BASE + urllib.parse.quote(prompt) + f'?width=1920&height=1080&seed={seed}&nologo=true&model=flux'
    out = os.path.join(OUTDIR, f'bg_{world_id}_{layer}.png')
    
    if os.path.exists(out) and os.path.getsize(out) > 5000:
        print(f'  SKIP {world_id}_{layer}')
        return True

    print(f'  GEN {world_id}_{layer}...', end=' ', flush=True)
    try:
        req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
        with urllib.request.urlopen(req, timeout=180) as r:
            data = r.read()
        with open(out, 'wb') as f:
            f.write(data)
        print(f'{len(data)//1024}KB')
        return True
    except Exception as e:
        print(f'FAIL: {e}')
        return False

def main():
    os.makedirs(OUTDIR, exist_ok=True)
    seed = 1000
    for world_id, layers in WORLDS.items():
        print(f'World: {world_id}')
        for layer, desc in layers.items():
            generate(world_id, layer, desc, seed)
            seed += 1
            time.sleep(1)
    print('Done!')

if __name__ == '__main__':
    main()
