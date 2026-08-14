/**
 * Settings-row styles as plain CSS, injected at apply time and removed on
 * unload. Mirrors how the official bundles ship their CSS-module output
 * (a `<style data-plugin-css>` tag), without needing a CSS toolchain.
 */

/** Unique tag id used for the injected style element. */
export const STYLE_TAG_ID = "dsh-enter-send/EnterSendRow.css";

export const CSS = `
.dsh-es_row{border-bottom:1px solid var(--dsw-alias-border-l2);align-items:center;gap:8px;padding:16px 0;display:flex}
.dsh-es_rowText{flex-direction:column;flex:1;gap:4px;min-width:0;padding-right:48px;display:flex}
.dsh-es_title{color:var(--dsw-alias-label-primary);font-size:14px;font-weight:400;line-height:22px}
.dsh-es_desc{color:var(--dsw-alias-label-tertiary);font-size:12px;font-weight:400;line-height:18px}
.dsh-es_selector{background:var(--dsw-alias-bg-module-platform);height:36px;font:inherit;color:var(--dsw-alias-label-primary);cursor:pointer;border:none;border-radius:18px;align-items:center;gap:12px;padding:0 14px;font-size:14px;line-height:22px;display:inline-flex}
.dsh-es_selector:hover{background:var(--dsw-alias-interactive-bg-hover)}
.dsh-es_chevron{flex:none}
`;

/**
 * Inject the stylesheet once; returns the disposer removing it.
 * No-op outside a DOM environment.
 */
export function injectStyles(): () => void {
  if (typeof document === "undefined") return () => {};
  if (document.querySelector(`style[data-plugin-css="${STYLE_TAG_ID}"]`) !== null) return () => {};
  const tag = document.createElement("style");
  tag.dataset.plugin = "dsh-enter-send";
  tag.dataset.pluginCss = STYLE_TAG_ID;
  tag.textContent = CSS;
  document.head.appendChild(tag);
  return () => tag.remove();
}
