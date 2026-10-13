// The demo is served on openui.com under this path (a rewrite in the OpenUI docs app), so the
// app lives under it everywhere. Next adds it to links, pages and its own assets; paths written by
// hand (fetch calls, files in public/) go through withBase().
export const BASE_PATH = "/demo/f1-dashboard-agent";

export const withBase = (path: string) => `${BASE_PATH}${path}`;
