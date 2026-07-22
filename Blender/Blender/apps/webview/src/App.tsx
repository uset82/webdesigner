import { useExtensionBridge } from "@/bridge/useExtensionBridge";
import { AvatarPanel } from "@/components/AvatarPanel";

export function App() {
  const bridgeState = useExtensionBridge();

  return <AvatarPanel {...bridgeState} />;
}
