import { AdminMenuPanel } from '../components/AdminMenuPanel';
import { Category, Product } from '../types';

interface Props {
  products: Product[];
  categories: Category[];
  onCreateProduct: (payload: { name: string; price: number; categoryId?: string }) => Promise<void>;
  onUpdateProduct: (
    id: string,
    payload: { name: string; price: number; categoryId?: string },
  ) => Promise<void>;
  onDeleteProduct: (id: string) => Promise<void>;
  onSetProductStatus: (id: string, isActive: boolean) => Promise<void>;
  onCreateCategory: (name: string, isPackaging?: boolean) => Promise<void>;
  onUpdateCategory: (
    id: string,
    payload: { name?: string; isPackaging?: boolean },
  ) => Promise<void>;
  onDeleteCategory: (id: string) => Promise<void>;
}

export function MenuPage(props: Props) {
  return <AdminMenuPanel {...props} />;
}
