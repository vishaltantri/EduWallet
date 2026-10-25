#!/usr/bin/env python3
"""
Prepare screenshots for the report.

Full-page captures are much taller than they are wide, and placing one in a
single column either runs past the bottom of the page or shrinks to nothing.
Each tall capture is trimmed of dead margin and then cut into vertical slices
that sit side by side, so the whole page is visible in a block that is wider
than it is tall.
"""

from pathlib import Path

from PIL import Image

SPLIT_DIR_NAME = "_split"

# A capture taller than this, relative to its width, is sliced.
TWO_COLUMN_RATIO = 1.35
THREE_COLUMN_RATIO = 2.40

# Slices overlap slightly so nothing is lost at a seam.
OVERLAP = 0.015


def _uniform_rows(image, axis="bottom", tolerance=6):
    """Count flat, single-colour rows at the top or bottom of an image."""
    grey = image.convert("L")
    width, height = grey.size
    pixels = grey.load()
    sample = range(0, width, max(1, width // 60))

    order = range(height - 1, -1, -1) if axis == "bottom" else range(height)
    count = 0
    for y in order:
        values = [pixels[x, y] for x in sample]
        if max(values) - min(values) > tolerance:
            break
        count += 1
    return count


def trim(image, keep_margin=24):
    """Remove flat dead space at the top and bottom, leaving a small margin."""
    top = max(0, _uniform_rows(image, "top") - keep_margin)
    bottom = max(0, _uniform_rows(image, "bottom") - keep_margin)
    width, height = image.size
    if top + bottom >= height - 100:
        return image
    return image.crop((0, top, width, height - bottom))


def slices_for(ratio):
    if ratio >= THREE_COLUMN_RATIO:
        return 3
    if ratio >= TWO_COLUMN_RATIO:
        return 2
    return 1


def prepare(path: Path, out_dir: Path):
    """
    Return a list of image paths to lay out side by side.

    One path means the capture is used whole. Two or three mean it is cut into
    that many vertical slices, read left to right.
    """
    out_dir.mkdir(parents=True, exist_ok=True)

    with Image.open(path) as original:
        image = trim(original.convert("RGB"))
        width, height = image.size
        count = slices_for(height / width)

        if count == 1:
            target = out_dir / path.name
            image.save(target, "PNG", optimize=True)
            return [target]

        step = height / count
        overlap = int(step * OVERLAP)
        parts = []
        for index in range(count):
            top = max(0, int(index * step) - (overlap if index else 0))
            bottom = min(height, int((index + 1) * step) + (overlap if index < count - 1 else 0))
            part = image.crop((0, top, width, bottom))
            target = out_dir / f"{path.stem}-{index + 1}.png"
            part.save(target, "PNG", optimize=True)
            parts.append(target)
        return parts
