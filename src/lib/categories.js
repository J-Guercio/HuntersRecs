// Category metadata: canonical order, colors (mirrors CSS vars), and emoji icons.
export const CATEGORIES = ['Coffee', 'Food', 'Bar/Club', 'Shopping', 'Entertainment', 'Grocery'];

export const CATEGORY_COLOR = {
  Coffee: '#b45309',
  Food: '#ef4444',
  'Bar/Club': '#a855f7',
  Shopping: '#ec4899',
  Entertainment: '#f59e0b',
  Grocery: '#10b981',
};

export const CATEGORY_ICON = {
  Coffee: '☕',
  Food: '🍽️',
  'Bar/Club': '🍸',
  Shopping: '🛍️',
  Entertainment: '🎶',
  Grocery: '🛒',
};

export const colorFor = (cat) => CATEGORY_COLOR[cat] || '#64748b';
export const iconFor = (cat) => CATEGORY_ICON[cat] || '📍';
