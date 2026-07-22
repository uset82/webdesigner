import argparse
import json
import math
import os
import sys


REQUIRED_SHAPE_KEYS = {
    "Blink_L",
    "Blink_R",
    "Mouth_Open",
    "Smile",
    "Frown",
    "Brow_Up",
    "Brow_Down",
}
REQUIRED_ACTIONS = {
    "idle_loop",
    "listening_loop",
    "thinking_loop",
    "speaking_loop",
    "coding_loop",
    "reviewing_loop",
    "debugging_loop",
    "building_loop",
    "warning_loop",
    "sleeping_loop",
    "welcome_once",
    "success_once",
    "error_once",
    "blink_once",
    "look_left_once",
    "look_right_once",
    "nod_once",
    "shake_once",
    "celebrate_once",
    "point_once",
    "talk_start",
    "talk_stop",
}


def parse_args():
    parser = argparse.ArgumentParser(description="Audit a rigged Blender avatar scene without modifying it.")
    parser.add_argument("--input", required=True, help="Path to the .blend file.")
    parser.add_argument("--output", required=True, help="Path to the JSON audit report.")
    return parser.parse_args(sys.argv[sys.argv.index("--") + 1 :] if "--" in sys.argv else [])


def near(value, target=0.0, tolerance=1e-4):
    return abs(value - target) <= tolerance


def transform_is_applied(obj):
    return (
        all(near(value) for value in obj.location)
        and all(near(value) for value in obj.rotation_euler)
        and all(near(value, 1.0) for value in obj.scale)
    )


def action_loop_matches(action):
    for curve in action.fcurves:
        points = curve.keyframe_points
        if len(points) < 2:
            continue
        if not near(points[0].co.y, points[-1].co.y, 1e-3):
            return False
    return True


def main():
    args = parse_args()
    if not os.path.isfile(args.input):
        raise FileNotFoundError("Avatar scene does not exist: {}".format(args.input))

    import bpy

    bpy.ops.wm.open_mainfile(filepath=args.input)
    meshes = [obj for obj in bpy.context.scene.objects if obj.type == "MESH" and not obj.hide_render]
    armatures = [obj for obj in bpy.context.scene.objects if obj.type == "ARMATURE"]
    triangles = 0
    max_influences = 0
    non_normalized_vertices = 0
    transform_issues = []
    shape_keys = set()

    depsgraph = bpy.context.evaluated_depsgraph_get()
    for obj in meshes:
        evaluated = obj.evaluated_get(depsgraph)
        evaluated_mesh = evaluated.to_mesh()
        evaluated_mesh.calc_loop_triangles()
        triangles += len(evaluated_mesh.loop_triangles)
        evaluated.to_mesh_clear()

        if not transform_is_applied(obj):
            transform_issues.append(obj.name)
        if obj.data.shape_keys:
            shape_keys.update(key.name for key in obj.data.shape_keys.key_blocks if key.name != "Basis")
        for vertex in obj.data.vertices:
            weights = [group.weight for group in vertex.groups if group.weight > 1e-5]
            max_influences = max(max_influences, len(weights))
            if weights and not near(sum(weights), 1.0, 0.02):
                non_normalized_vertices += 1

    actions = {action.name: action for action in bpy.data.actions}
    loop_actions = sorted(name for name in actions if name.endswith("_loop"))
    bad_loop_endpoints = [name for name in loop_actions if not action_loop_matches(actions[name])]
    deform_bones = sum(sum(1 for bone in armature.data.bones if bone.use_deform) for armature in armatures)
    root_bone_at_origin = False
    if armatures:
        root = armatures[0].data.bones.get("Root")
        root_bone_at_origin = bool(root and root.head.length <= 1e-4)

    failures = []
    if triangles > 60000:
        failures.append("triangle budget exceeded")
    if deform_bones > 50:
        failures.append("deforming bone budget exceeded")
    if max_influences > 4:
        failures.append("more than four bone influences found")
    if non_normalized_vertices:
        failures.append("non-normalized vertex weights found")
    if transform_issues:
        failures.append("mesh transforms are not applied")
    if not root_bone_at_origin:
        failures.append("Root bone is not at world origin")
    missing_actions = sorted(REQUIRED_ACTIONS.difference(actions))
    missing_shape_keys = sorted(REQUIRED_SHAPE_KEYS.difference(shape_keys))
    if missing_actions:
        failures.append("required actions are missing")
    if missing_shape_keys:
        failures.append("required shape keys are missing")
    if bad_loop_endpoints:
        failures.append("loop endpoints do not match")

    report = {
        "schemaVersion": 1,
        "sourceFile": os.path.basename(args.input),
        "collections": sorted(collection.name for collection in bpy.data.collections),
        "meshObjects": len(meshes),
        "armatures": [armature.name for armature in armatures],
        "triangles": triangles,
        "deformingBones": deform_bones,
        "maxInfluencesPerVertex": max_influences,
        "nonNormalizedVertices": non_normalized_vertices,
        "unappliedMeshTransforms": transform_issues,
        "rootBoneAtOrigin": root_bone_at_origin,
        "shapeKeys": sorted(shape_keys),
        "missingShapeKeys": missing_shape_keys,
        "actions": sorted(actions),
        "missingActions": missing_actions,
        "loopActions": loop_actions,
        "loopEndpointFailures": bad_loop_endpoints,
        "budgets": {"triangles": 60000, "deformingBones": 50, "influencesPerVertex": 4},
        "valid": not failures,
        "failures": failures,
    }
    os.makedirs(os.path.dirname(os.path.abspath(args.output)), exist_ok=True)
    with open(args.output, "w", encoding="utf-8") as file:
        json.dump(report, file, indent=2)
        file.write("\n")
    print(json.dumps(report, indent=2))
    if failures:
        raise RuntimeError("Avatar scene audit failed: {}".format("; ".join(failures)))


if __name__ == "__main__":
    try:
        main()
    except Exception as error:
        print("Codex Avatar scene audit failed: {}".format(error), file=sys.stderr)
        sys.exit(1)
