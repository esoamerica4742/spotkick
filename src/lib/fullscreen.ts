export async function enterMatchFullscreen(): Promise<void> {
  if (typeof document === "undefined") return;
  const node = document.documentElement as HTMLElement & {
    webkitRequestFullscreen?: () => Promise<void> | void;
  };
  const active =
    document.fullscreenElement ||
    (document as Document & { webkitFullscreenElement?: Element })
      .webkitFullscreenElement;
  if (active) return;
  try {
    if (node.requestFullscreen) {
      await node.requestFullscreen();
      return;
    }
    await node.webkitRequestFullscreen?.();
  } catch {
    // iOS Safari and some embeds reject this; standalone PWA is already full screen.
  }
}
