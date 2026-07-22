import argparse
import json
import math
import os
import sys


def parse_args():
    parser = argparse.ArgumentParser(description="Export Blender line art to SVG when Blender SVG support is available.")
    parser.add_argument("--input", required=True, help="Path to the .blend file.")
    parser.add_argument("--output", required=True, help="Path to the output .svg file.")
    parser.add_argument("--manifest", default="", help="Optional manifest path to write.")
    return parser.parse_args(sys.argv[sys.argv.index("--") + 1 :] if "--" in sys.argv else [])


def main():
    args = parse_args()
    if not os.path.exists(args.input):
        raise FileNotFoundError("Input .blend file does not exist: {}".format(args.input))

    os.makedirs(os.path.dirname(os.path.abspath(args.output)), exist_ok=True)

    import bpy

    bpy.ops.wm.open_mainfile(filepath=args.input)
    ensure_orthographic_camera(bpy)
    export_objects, collection_name = collect_export_objects(bpy)

    if try_grease_pencil_svg_export(bpy, args.output, export_objects):
        if args.manifest:
            write_export_report(args.manifest, args.input, args.output, "svg", collection_name, export_objects)
        print("SVG line-art export complete: {}".format(args.output))
        return

    raise RuntimeError(
        "SVG line-art export requires Grease Pencil objects and Blender's Grease Pencil SVG exporter. "
        "It does not vectorize arbitrary meshes or pictures."
    )


def ensure_orthographic_camera(bpy):
    scene = bpy.context.scene
    camera = scene.camera
    if camera is None:
        bpy.ops.object.camera_add(location=(0, -6, 2.4), rotation=(math.radians(68), 0, 0))
        camera = bpy.context.object
        scene.camera = camera

    camera.data.type = "ORTHO"
    camera.data.ortho_scale = 4.0
    scene.render.use_freestyle = True


def collect_export_objects(bpy):
    source = bpy.data.collections.get("Export") or bpy.data.collections.get("Avatar") or bpy.context.scene.collection
    objects = []
    seen = set()

    def visit(collection):
        if collection.name in {"Guides", "Ignore"}:
            return
        for obj in collection.objects:
            if obj.name not in seen:
                seen.add(obj.name)
                objects.append(obj)
        for child in collection.children:
            visit(child)

    visit(source)
    return objects, source.name


def try_grease_pencil_svg_export(bpy, output_path, export_objects):
    if not hasattr(bpy.ops.wm, "grease_pencil_export_svg"):
        return False

    grease_pencil_objects = [obj for obj in export_objects if obj.type in {"GPENCIL", "GREASEPENCIL"}]
    if not grease_pencil_objects:
        return False

    for obj in bpy.context.scene.objects:
        obj.select_set(False)
    for obj in grease_pencil_objects:
        obj.select_set(True)
    bpy.context.view_layer.objects.active = grease_pencil_objects[0]

    bpy.ops.wm.grease_pencil_export_svg(filepath=output_path)
    return os.path.exists(output_path)


def write_export_report(manifest_path, input_path, output_path, mode, collection_name, export_objects):
    os.makedirs(os.path.dirname(os.path.abspath(manifest_path)), exist_ok=True)
    with open(manifest_path, "w", encoding="utf-8") as file:
        json.dump(
            {
                "schemaVersion": 1,
                "mode": mode,
                "sourceFile": os.path.basename(input_path),
                "outputFile": os.path.basename(output_path),
                "collection": collection_name,
                "objectCount": len(export_objects),
                "guidance": "Blender SVG export is capability-dependent Grease Pencil line art, not automatic bitmap or mesh vectorization.",
            },
            file,
            indent=2,
        )
        file.write("\n")


if __name__ == "__main__":
    try:
        main()
    except Exception as error:
        print("Codex Avatar Blender SVG export failed: {}".format(error), file=sys.stderr)
        sys.exit(1)
