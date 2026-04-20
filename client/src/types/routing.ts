import type { Category } from '../types';

export interface AppOutletContext {
  categories: Category[];
  selectedLlm: string;
  onLlmChange: (id: string) => void;
  onManageFeeds: (categoryId: number) => void;
  deleteCategory: (id: number) => Promise<void>;
  onSelectCategory: (name: string) => void;
  articleFontSize: number;
  onFontSizeChange: (size: number) => void;
}
