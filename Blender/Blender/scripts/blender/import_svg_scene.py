import argparse
import json
import math
import os
import sys


def parse_args():
    parser = argparse.ArgumentParser(description="Create an editable Blender starting scene from sanitized SVG curves.")
    parser.add_argument("--input", required=True, help="Path to the sanitized SVG file.")
    parser.add_argument("--output", required=True, help="Path to the new .blend working copy.")
    parser.add_argument("--manifest", required=True, help="Path to the portable export report.")
    return parser.parse_args(sys.argv[sys.argv.index("--") + 1 :] if "--" in sys.argv else [])


def main():
    args = parse_args()
    if not os.path.isfile(args.input) or os.path.splitext(args.input)[1].lower() != ".svg":
        raise FileNotFoundError("Input must be an existing sanitized SVG file.")
    if os.path.exists(args.output):
        raise FileExistsError("The Blender working copy already exists.")

    import bpy

    bpy.ops.wm.read_factory_settings(use_empty=True)
    scene = bpy.context.scene
    avatar = bpy.data.collections.new("Avatar")
    export = bpy.data.collections.new("Export")
    guides = bpy.data.collections.new("Guides")
    ignore = bpy.data.collections.new("Ignore")
    scene.collection.children.link(avatar)
    avatar.children.link(export)
    scene.collection.children.link(guides)
    scene.collection.children.link(ignore)

    ensure_svg_importer(bpy)
    before = set(bpy.data.objects)
    result = bpy.ops.import_curve.svg(filepath=os.path.abspath(args.input))
    if "FINISHED" not in result:
        raise RuntimeError("Blender's SVG importer did not finish successfully.")
    imported = [obj for obj in bpy.data.objects if obj not in before and obj.type == "CURVE"]
    if not imported:
        raise RuntimeError("The SVG did not create editable curve objects.")

    for obj in imported:
        for collection in list(obj.users_collection):
            collection.objects.unlink(obj)
        export.objects.link(obj)
        obj.data.dimensions = "2D"
        obj.data.extrude = 0.01
        obj.data.bevel_depth = 0.002
    remove_empty_import_collections(bpy, {avatar, export, guides, ignore})
    frame_imported_curves(imported)
    add_camera_and_light(bpy, imported)

    output_path = os.path.abspath(args.output)
    os.makedirs(os.path.dirname(output_path), exist_ok=True)
    bpy.ops.wm.save_as_mainfile(filepath=output_path, check_existing=False)
    write_report(args.manifest, args.input, args.output, len(imported))
    print("Editable Blender SVG scene created: {}".format(output_path))


def ensure_svg_importer(bpy):
    if hasattr(bpy.ops.import_curve, "svg"):
        return
    import addon_utils

    addon_utils.enable("io_curve_svg", default_set=False, persistent=False)
    if not hasattr(bpy.ops.import_curve, "svg"):
        raise RuntimeError("This Blender installation does not provide the bundled SVG curve importer.")


def remove_empty_import_collections(bpy, keep):
    for collection in list(bpy.data.collections):
        if collection in keep:
            continue
        if len(collection.objects) == 0 and len(collection.children) == 0:
            bpy.data.collections.remove(collection)


def frame_imported_curves(imported):
    from mathutils import Vector

    points = [obj.matrix_world @ Vector(corner) for obj in imported for corner in obj.bound_box]
    minimum = Vector((min(point.x for point in points), min(point.y for point in points), min(point.z for point in points)))
    maximum = Vector((max(point.x for point in points), max(point.y for point in points), max(point.z for point in points)))
    center = (minimum + maximum) * 0.5
    size = max(maximum.x - minimum.x, maximum.y - minimum.y, 0.001)
    scale = 3.0 / size
    for obj in imported:
        obj.location = (obj.location - center) * scale
        obj.scale *= scale


def add_camera_and_light(bpy, imported):
    scene = bpy.context.scene
    bpy.ops.object.camera_add(location=(0, 0, 6), rotation=(0, 0, 0))
    camera = bpy.context.object
    camera.name = "AvatarCamera"
    camera.data.type = "ORTHO"
    camera.data.ortho_scale = 4.5
    scene.camera = camera
    bpy.ops.object.light_add(type="AREA", location=(0, 0, 4))
    light = bpy.context.object
    light.name = "AvatarKeyLight"
    light.data.energy = 500
    light.data.size = 4
    scene.render.film_transparent = True
    if scene.world is None:
        scene.world = bpy.data.worlds.new("AvatarWorld")
    scene.world.color = (0.05, 0.05, 0.05)


def write_report(report_path, input_path, output_path, object_count):
    os.makedirs(os.path.dirname(os.path.abspath(report_path)), exist_ok=True)
    with open(report_path, "w", encoding="utf-8") as file:
        json.dump(
            {
                "schemaVersion": 1,
                "mode": "svg-handoff",
                "sourceFile": os.path.basename(input_path),
                "outputFile": os.path.basename(output_path),
                "collection": "Export",
                "objectCount": object_count,
                "guidance": "Imported SVG curves are an editable starting scene, not an automatic rig or production 3D character.",
            },
            file,
            indent=2,
        )
        file.write("\n")


if __name__ == "__main__":
    try:
        main()
    except Exception as error:
        print("Codex Avatar SVG-to-Blender handoff failed: {}".format(error), file=sys.stderr)
        sys.exit(1)
