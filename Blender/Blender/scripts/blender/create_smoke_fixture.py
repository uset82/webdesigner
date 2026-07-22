import argparse
import math
import os
import sys


def parse_args():
    parser = argparse.ArgumentParser(description="Create a small Codex Avatar Blender export smoke fixture.")
    parser.add_argument("--output", required=True)
    return parser.parse_args(sys.argv[sys.argv.index("--") + 1 :] if "--" in sys.argv else [])


def main():
    args = parse_args()
    import bpy

    bpy.ops.wm.read_factory_settings(use_empty=True)
    scene = bpy.context.scene
    export_collection = bpy.data.collections.new("Export")
    scene.collection.children.link(export_collection)
    ignore_collection = bpy.data.collections.new("Ignore")
    scene.collection.children.link(ignore_collection)

    bpy.ops.mesh.primitive_uv_sphere_add(segments=24, ring_count=12, location=(0, 0, 0))
    avatar = bpy.context.object
    avatar.name = "SmokeAvatar"
    for collection in list(avatar.users_collection):
        collection.objects.unlink(avatar)
    export_collection.objects.link(avatar)

    bpy.ops.mesh.primitive_cube_add(location=(20, 20, 20))
    ignored = bpy.context.object
    ignored.name = "IgnoredGuide"
    for collection in list(ignored.users_collection):
        collection.objects.unlink(ignored)
    ignore_collection.objects.link(ignored)

    bpy.ops.object.light_add(type="AREA", location=(3, -3, 5))
    bpy.context.object.data.energy = 900
    bpy.context.object.data.shape = "DISK"
    bpy.context.object.data.size = 4
    bpy.ops.object.camera_add(location=(4, -4, 2.8))
    camera = bpy.context.object
    camera.rotation_euler = direction_to_euler(camera.location, (0, 0, 0))
    scene.camera = camera
    scene.render.engine = "BLENDER_EEVEE_NEXT"
    scene.render.resolution_percentage = 100
    if scene.world is None:
        scene.world = bpy.data.worlds.new("SmokeWorld")
    scene.world.color = (0.025, 0.025, 0.025)

    output = os.path.abspath(args.output)
    os.makedirs(os.path.dirname(output), exist_ok=True)
    bpy.ops.wm.save_as_mainfile(filepath=output)
    print("Codex Avatar smoke fixture saved: {}".format(output))


def direction_to_euler(origin, target):
    from mathutils import Vector

    direction = Vector(target) - origin
    return direction.to_track_quat("-Z", "Y").to_euler()


if __name__ == "__main__":
    try:
        main()
    except Exception as error:
        print("Could not create Blender smoke fixture: {}".format(error), file=sys.stderr)
        sys.exit(1)
