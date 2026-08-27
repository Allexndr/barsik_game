#!/usr/bin/env python3
"""Merge Meshy per-clip GLBs (identical skeleton) into one multi-clip GLB.

Keeps mesh/skins/materials/textures from the base (first) file and appends
animation samplers + their accessor/bufferView/buffer bytes from the others.
"""

from __future__ import annotations

import argparse
import json
import struct
import sys
from pathlib import Path


def read_glb(path: Path) -> tuple[dict, bytes]:
    data = path.read_bytes()
    magic, version, length = struct.unpack_from("<4sII", data, 0)
    if magic != b"glTF":
        raise ValueError(f"Not a GLB: {path}")
    off = 12
    json_chunk = None
    bin_chunk = b""
    while off + 8 <= length:
        clen, ctype = struct.unpack_from("<I4s", data, off)
        off += 8
        chunk = data[off : off + clen]
        off += clen
        if ctype == b"JSON":
            json_chunk = json.loads(chunk.decode("utf-8"))
        elif ctype == b"BIN\x00":
            bin_chunk = chunk
    if json_chunk is None:
        raise ValueError(f"No JSON chunk in {path}")
    return json_chunk, bin_chunk


def write_glb(path: Path, gltf: dict, bin_blob: bytes) -> None:
    json_bytes = json.dumps(gltf, separators=(",", ":")).encode("utf-8")
    json_bytes += b" " * ((4 - (len(json_bytes) % 4)) % 4)
    bin_pad = b"\x00" * ((4 - (len(bin_blob) % 4)) % 4)
    bin_bytes = bin_blob + bin_pad
    total = 12 + 8 + len(json_bytes) + 8 + len(bin_bytes)
    out = bytearray()
    out += struct.pack("<4sII", b"glTF", 2, total)
    out += struct.pack("<I4s", len(json_bytes), b"JSON")
    out += json_bytes
    out += struct.pack("<I4s", len(bin_bytes), b"BIN\x00")
    out += bin_bytes
    path.write_bytes(out)


def anim_accessor_indices(gltf: dict, anim: dict) -> set[int]:
    idxs: set[int] = set()
    for s in anim.get("samplers") or []:
        if "input" in s:
            idxs.add(s["input"])
        if "output" in s:
            idxs.add(s["output"])
    return idxs


def copy_accessors_into(
    dst: dict,
    dst_bin: bytearray,
    src: dict,
    src_bin: bytes,
    accessor_ids: set[int],
) -> dict[int, int]:
    """Copy accessors (+ bufferViews + bytes) into dst. Returns old→new accessor map."""
    mapping: dict[int, int] = {}
    src_accessors = src.get("accessors") or []
    src_views = src.get("bufferViews") or []
    dst.setdefault("accessors", [])
    dst.setdefault("bufferViews", [])
    dst.setdefault("buffers", [{"byteLength": 0}])

    for old_i in sorted(accessor_ids):
        acc = dict(src_accessors[old_i])
        view_i = acc.get("bufferView")
        if view_i is None:
            # sparse / no view — rare for anim curves; skip copy of bytes
            mapping[old_i] = len(dst["accessors"])
            dst["accessors"].append(acc)
            continue
        view = dict(src_views[view_i])
        offset = view.get("byteOffset", 0)
        length = view["byteLength"]
        # Align to 4
        while len(dst_bin) % 4:
            dst_bin.append(0)
        new_offset = len(dst_bin)
        dst_bin.extend(src_bin[offset : offset + length])
        view["buffer"] = 0
        view["byteOffset"] = new_offset
        new_view_i = len(dst["bufferViews"])
        dst["bufferViews"].append(view)
        acc["bufferView"] = new_view_i
        mapping[old_i] = len(dst["accessors"])
        dst["accessors"].append(acc)

    dst["buffers"][0]["byteLength"] = len(dst_bin)
    return mapping


def strip_scale_channels(anim: dict) -> None:
    """Drop scale tracks — Meshy walks often look like the character shrinks."""
    new_samplers: list[dict] = []
    samp_map: dict[int, int] = {}
    new_channels: list[dict] = []
    for ch in anim.get("channels") or []:
        if ch.get("target", {}).get("path") == "scale":
            continue
        si = ch["sampler"]
        if si not in samp_map:
            samp_map[si] = len(new_samplers)
            new_samplers.append(anim["samplers"][si])
        nc = dict(ch)
        nc["sampler"] = samp_map[si]
        new_channels.append(nc)
    anim["samplers"] = new_samplers
    anim["channels"] = new_channels


def remap_anim(anim: dict, acc_map: dict[int, int], name: str) -> dict:
    out = {
        "name": name,
        "channels": [],
        "samplers": [],
    }
    samplers = anim.get("samplers") or []
    for s in samplers:
        ns = dict(s)
        ns["input"] = acc_map[s["input"]]
        ns["output"] = acc_map[s["output"]]
        out["samplers"].append(ns)
    for ch in anim.get("channels") or []:
        # node indices must already match between Meshy exports
        out["channels"].append(dict(ch))
    return out


def merge(clips: list[tuple[str, Path]], out: Path) -> None:
    base_name, base_path = clips[0]
    gltf, bin_blob = read_glb(base_path)
    bin_arr = bytearray(bin_blob)

    # Rename base anims
    for a in gltf.get("animations") or []:
        a["name"] = base_name
    gltf.setdefault("animations", [])

    # Drop all but first base animation (Meshy usually one)
    if len(gltf["animations"]) > 1:
        gltf["animations"] = [gltf["animations"][0]]
    if gltf["animations"]:
        gltf["animations"][0]["name"] = base_name
        strip_scale_channels(gltf["animations"][0])

    for name, path in clips[1:]:
        src, src_bin = read_glb(path)
        src_anims = src.get("animations") or []
        if not src_anims:
            print(f"skip {name}: no animations", file=sys.stderr)
            continue
        anim = src_anims[0]
        strip_scale_channels(anim)
        # Sanity: same node count
        if len(src.get("nodes") or []) != len(gltf.get("nodes") or []):
            print(
                f"warn {name}: node count {len(src.get('nodes') or [])} "
                f"!= base {len(gltf.get('nodes') or [])}",
                file=sys.stderr,
            )
        acc_ids = anim_accessor_indices(src, anim)
        acc_map = copy_accessors_into(gltf, bin_arr, src, src_bin, acc_ids)
        gltf["animations"].append(remap_anim(anim, acc_map, name))
        print(f"+ {name} channels={len(anim.get('channels') or [])}")

    write_glb(out, gltf, bytes(bin_arr))
    print(f"wrote {out} ({out.stat().st_size / 1024:.0f} KB) anims={[a.get('name') for a in gltf['animations']]}")


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--out", type=Path, required=True)
    ap.add_argument("--clip", action="append", required=True, help="Name=path.glb")
    args = ap.parse_args()
    clips: list[tuple[str, Path]] = []
    for spec in args.clip:
        name, _, path = spec.partition("=")
        clips.append((name, Path(path)))
    merge(clips, args.out)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
