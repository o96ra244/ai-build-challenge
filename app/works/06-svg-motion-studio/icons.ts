export type IconCategory = "ナビゲーション" | "操作" | "状態・通知";

export type BuiltInIcon = {
  id: string;
  name: string;
  category: IconCategory;
  svg: string;
};

const wrap = (body: string) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${body}</svg>`;

export const BUILT_IN_ICONS: readonly BuiltInIcon[] = [
  { id: "arrow-right", name: "Arrow Right", category: "ナビゲーション", svg: wrap('<path d="M5 12h14M13 6l6 6-6 6"/>') },
  { id: "arrow-left", name: "Arrow Left", category: "ナビゲーション", svg: wrap('<path d="M19 12H5m6 6-6-6 6-6"/>') },
  { id: "chevron-down", name: "Chevron Down", category: "ナビゲーション", svg: wrap('<path d="m6 9 6 6 6-6"/>') },
  { id: "external-link", name: "External Link", category: "ナビゲーション", svg: wrap('<path d="M14 5h5v5M19 5l-9 9M19 13v6H5V5h6"/>') },
  { id: "plus", name: "Plus", category: "操作", svg: wrap('<path d="M12 5v14M5 12h14"/>') },
  { id: "minus", name: "Minus", category: "操作", svg: wrap('<path d="M5 12h14"/>') },
  { id: "close", name: "Close", category: "操作", svg: wrap('<path d="m6 6 12 12M18 6 6 18"/>') },
  { id: "menu", name: "Menu", category: "操作", svg: wrap('<path d="M4 7h16M4 12h16M4 17h16"/>') },
  { id: "search", name: "Search", category: "操作", svg: wrap('<circle cx="11" cy="11" r="6"/><path d="m16 16 4 4"/>') },
  { id: "copy", name: "Copy", category: "操作", svg: wrap('<rect x="8" y="8" width="11" height="11" rx="2"/><path d="M16 8V5H5v11h3"/>') },
  { id: "download", name: "Download", category: "操作", svg: wrap('<path d="M12 4v11m-4-4 4 4 4-4M5 20h14"/>') },
  { id: "refresh", name: "Refresh", category: "操作", svg: wrap('<path d="M19 7V3l-2 2a8 8 0 1 0 2 10M19 3h-4"/>') },
  { id: "check", name: "Check", category: "状態・通知", svg: wrap('<path d="m5 12 4 4L19 6"/>') },
  { id: "info", name: "Info", category: "状態・通知", svg: wrap('<circle cx="12" cy="12" r="9"/><path d="M12 11v6M12 7h.01"/>') },
  { id: "warning", name: "Warning", category: "状態・通知", svg: wrap('<path d="M12 3 2.5 20h19L12 3Z"/><path d="M12 9v5M12 17h.01"/>') },
  { id: "bell", name: "Bell", category: "状態・通知", svg: wrap('<path d="M18 9a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4"/>') },
  { id: "heart", name: "Heart", category: "状態・通知", svg: wrap('<path d="M20.8 5.8a5 5 0 0 0-7.1 0L12 7.5l-1.7-1.7a5 5 0 0 0-7.1 7.1L12 21l8.8-8.1a5 5 0 0 0 0-7.1Z"/>') },
  { id: "loader", name: "Loader", category: "状態・通知", svg: wrap('<path d="M12 3v3M12 18v3M3 12h3M18 12h3M5.6 5.6l2.1 2.1M16.3 16.3l2.1 2.1M18.4 5.6l-2.1 2.1M7.7 16.3l-2.1 2.1"/>') },
];

export const ICON_CATEGORIES: readonly IconCategory[] = ["ナビゲーション", "操作", "状態・通知"];
