#!/usr/bin/env python3
"""Generate Barsik character poses with transparent background using Pollinations + Remove.bg"""
import urllib.request, urllib.parse, subprocess, os, time, sys

BASE = 'https://image.pollinations.ai/prompt/'
API_KEY = os.environ.get('REMOVE_BG_API_KEY')
OUTDIR = os.path.join(os.path.dirname(__file__), 'assets')

STYLE = (
    "3D cute kawaii soft plastic toy snow leopard cub, "
    "big round blue eyes, fluffy white fur with soft blue-gray spots, "
    "small pink nose, friendly smile, {POSE}, "
    "full body centered, soft smooth lighting, pastel colors, "
    "clean white background, children's game mascot, high quality, 3D rendered"
)

POSES = {
    'idle': 'sitting pose facing forward calm',
    'run': 'running pose side view facing right dynamic',
    'jump': 'jumping pose side view facing right paws up',
    'fall': 'falling pose side view facing right legs tucked',
    'celebrate': 'celebrating pose arms up joyful with confetti',
    'wave': 'standing waving with right paw up',
}

def generate(pose, desc, seed):
    prompt = STYLE.format(POSE=desc)
    url = BASE + urllib.parse.quote(prompt) + f'?width=1024&height=1024&seed={seed}&nologo=true&model=flux'
    raw = os.path.join(OUTDIR, f'barsik_{pose}_raw.png')
    out = os.path.join(OUTDIR, f'barsik_{pose}.png')
    
    if os.path.exists(out) and os.path.getsize(out) > 5000:
        print(f'  SKIP {pose} (already exists)')
        return True

    print(f'  GEN {pose}...', end=' ', flush=True)
    try:
        req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
        with urllib.request.urlopen(req, timeout=180) as r:
            data = r.read()
        with open(raw, 'wb') as f:
            f.write(data)
        print(f'raw {len(data)//1024}KB', end=' ', flush=True)
    except Exception as e:
        print(f'FAIL gen: {e}')
        return False

    # Remove background
    try:
        subprocess.run(
            ['curl', '-s', '-H', f'X-Api-Key: {API_KEY}',
             '-F', f'image_file=@{raw}', '-F', 'size=auto',
             'https://api.remove.bg/v1.0/removebg', '-o', out],
            check=True, timeout=60
        )
        sz = os.path.getsize(out)
        print(f'→ {sz//1024}KB')
        return sz > 1000
    except Exception as e:
        print(f'FAIL rmbg: {e}')
        return False

def main():
    if not API_KEY:
        print('Missing REMOVE_BG_API_KEY environment variable', file=sys.stderr)
        return 1
    os.makedirs(OUTDIR, exist_ok=True)
    for i, (pose, desc) in enumerate(POSES.items(), start=700):
        ok = generate(pose, desc, i)
        if not ok:
            # Retry once
            time.sleep(3)
            generate(pose, desc, i + 100)
        time.sleep(1)
    print('Done!')
    return 0

if __name__ == '__main__':
    sys.exit(main())
