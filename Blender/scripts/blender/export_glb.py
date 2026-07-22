import argparse
import json
import os
import sys


def parse_args():
    parser = argparse.ArgumentParser(description="Export a Blender scene to GLB for Codex Avatar Studio.")
    parser.add_argument("--input", required=True, help="Path to the .blend file.")
    parser.add_argument("--output", required=True, help="Path to the output .glb file.")
    parser.add_argument("--manifest", default="", help="Optional manifest path to write.")
    return parser.parse_args(sys.argv[sys.argv.index("--") + 1 :] if "--" in sys.argv else [])


def main():
    args = parse_args()
    if not os.path.exists(args.input):
        raise FileNotFoundError("Input .blend file does not exist: {}".format(args.input))

    os.makedirs(os.path.dirname(os.path.abspath(args.output)), exist_ok=True)

    import bpy

    bpy.ops.wm.open_mainfile(filepath=args.input)

    if not hasattr(bpy.ops.export_scene, "gltf"):
        raise RuntimeError("This Blender build does not include the glTF exporter.")

    export_objects, collection_name = collect_export_objects(bpy)
    if not export_objects:
        raise RuntimeError("The Export/Avatar collection does not contain exportable objects.")
    for obj in bpy.context.scene.objects:
        obj.select_set(False)
    for obj in export_objects:
        if obj.name in bpy.context.view_layer.objects:
            obj.select_set(True)
    bpy.context.view_layer.objects.active = export_objects[0]

    bpy.ops.export_scene.gltf(
        filepath=args.output,
        export_format="GLB",
        export_apply=True,
        export_yup=True,
        use_selection=True,
        export_cameras=False,
        export_lights=False,
    )

    if args.manifest:
        write_export_report(args.manifest, args.input, args.output, "glb", collection_name, export_objects)

    print("GLB export complete: {}".format(args.output))


def collect_export_objects(bpy):
    source = bpy.data.collections.get("Export") or bpy.data.collections.get("Avatar") or bpy.context.scene.collection
    allowed_types = {"MESH", "CURVE", "SURFACE", "META", "FONT", "ARMATURE", "EMPTY", "GPENCIL", "GREASEPENCIL"}
    objects = []
    seen = set()

    def visit(collection):
        if collection.name in {"Guides", "Ignore"}:
            return
        for obj in collection.objects:
            if obj.type in allowed_types and obj.name not in seen:
                seen.add(obj.name)
                objects.append(obj)
        for child in collection.children:
            visit(child)

    visit(source)
    return objects, source.name


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
                "guidance": "GLB is export-only until a verified WebGL avatar renderer is enabled; SVG remains the runtime fallback.",
            },
            file,
            indent=2,
        )
        file.write("\n")


if __name__ == "__main__":
    try:
        main()
    except Exception as error:
        print("Codex Avatar Blender GLB export failed: {}".format(error), file=sys.stderr)
        sys.exit(1)
