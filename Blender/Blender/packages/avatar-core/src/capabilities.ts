import { avatarCapabilities, type AvatarCapability } from "./types.js";

export function supportsAvatarCapability(
  capabilities: ReadonlySet<AvatarCapability> | readonly AvatarCapability[],
  capability: AvatarCapability
): boolean {
  return capabilities instanceof Set
    ? capabilities.has(capability)
    : Array.isArray(capabilities) && capabilities.includes(capability);
}

export function isKnownAvatarCapability(value: string): value is AvatarCapability {
  return (avatarCapabilities as readonly string[]).includes(value);
}
