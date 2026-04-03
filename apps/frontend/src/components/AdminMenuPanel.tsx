import { FormEvent, useState } from 'react';
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
  onUpdateCategory: (id: string, payload: { name?: string; isPackaging?: boolean }) => Promise<void>;
  onDeleteCategory: (id: string) => Promise<void>;
}

export function AdminMenuPanel({
  products,
  categories,
  onCreateProduct,
  onUpdateProduct,
  onDeleteProduct,
  onSetProductStatus,
  onCreateCategory,
  onUpdateCategory,
  onDeleteCategory,
}: Props) {
  const [name, setName] = useState('');
  const [price, setPrice] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [categoryName, setCategoryName] = useState('');
  const [categoryIsPackaging, setCategoryIsPackaging] = useState(false);
  const [saving, setSaving] = useState(false);

  const handleCreateCategory = async (event: FormEvent) => {
    event.preventDefault();
    if (!categoryName.trim()) {
      return;
    }

    setSaving(true);
    try {
      await onCreateCategory(categoryName.trim(), categoryIsPackaging);
      setCategoryName('');
      setCategoryIsPackaging(false);
    } finally {
      setSaving(false);
    }
  };

  const handleCreate = async (event: FormEvent) => {
    event.preventDefault();
    const parsedPrice = Number(price);
    if (!name.trim() || Number.isNaN(parsedPrice)) {
      return;
    }

    setSaving(true);
    try {
      await onCreateProduct({ name: name.trim(), price: parsedPrice, categoryId: categoryId || undefined });
      setName('');
      setPrice('');
      setCategoryId('');
    } finally {
      setSaving(false);
    }
  };

  const groupedProducts = products.reduce<Record<string, Product[]>>((acc, product) => {
    const key = product.category?.name || 'Sin categoria';
    if (!acc[key]) {
      acc[key] = [];
    }
    acc[key].push(product);
    return acc;
  }, {});

  const orderedCategoryNames = Object.keys(groupedProducts).sort((a, b) =>
    a.localeCompare(b),
  );

  return (
    <section className="panel admin-menu">
      <h3>Gestion de Menu</h3>

      <form className="admin-category-form" onSubmit={handleCreateCategory}>
        <input
          placeholder="Nueva categoria (ej. Bebidas)"
          value={categoryName}
          onChange={(e) => setCategoryName(e.target.value)}
        />
        <label className="category-packaging-toggle">
          <input
            type="checkbox"
            checked={categoryIsPackaging}
            onChange={(e) => setCategoryIsPackaging(e.target.checked)}
          />
          Categoria de envases
        </label>
        <button disabled={saving}>{saving ? 'Guardando...' : 'Agregar categoria'}</button>
      </form>

      <form className="admin-menu-form" onSubmit={handleCreate}>
        <input
          placeholder="Nombre de producto"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
        <input
          type="number"
          placeholder="Precio"
          min="0"
          step="0.01"
          value={price}
          onChange={(e) => setPrice(e.target.value)}
        />
        <select value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
          <option value="">Sin categoria</option>
          {categories.map((category) => (
            <option key={category.id} value={category.id}>
                {category.name}{category.isPackaging ? ' (Envases)' : ''}
            </option>
          ))}
        </select>
        <button disabled={saving}>{saving ? 'Guardando...' : 'Agregar producto'}</button>
      </form>

      <div className="admin-menu-list">
        {orderedCategoryNames.map((categoryName) => (
          <section key={categoryName} className="admin-menu-group">
            {(() => {
              const category = categories.find((item) => item.name === categoryName);
              if (!category) {
                return <h4>{categoryName}</h4>;
              }

              return (
                <EditableCategoryRow
                  category={category}
                  onSave={onUpdateCategory}
                  onDelete={onDeleteCategory}
                />
              );
            })()}
            {groupedProducts[categoryName].map((product) => (
              <EditableProductRow
                key={product.id}
                product={product}
                categories={categories}
                onSave={onUpdateProduct}
                onDelete={onDeleteProduct}
                onSetStatus={onSetProductStatus}
              />
            ))}
          </section>
        ))}
      </div>
    </section>
  );
}

function EditableCategoryRow({
  category,
  onSave,
  onDelete,
}: {
  category: Category;
  onSave: (id: string, payload: { name?: string; isPackaging?: boolean }) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
}) {
  const [name, setName] = useState(category.name);
  const [isPackaging, setIsPackaging] = useState(Boolean(category.isPackaging));
  const [busy, setBusy] = useState(false);
  const [saving, setSaving] = useState(false);
  const [isEditing, setIsEditing] = useState(false);

  const save = async () => {
    if (!name.trim()) {
      return;
    }

    setBusy(true);
    setSaving(true);
    try {
      await onSave(category.id, { name: name.trim(), isPackaging });
      setIsEditing(false);
    } finally {
      setSaving(false);
      setBusy(false);
    }
  };

  const remove = async () => {
    const ok = window.confirm(
      `Eliminar categoria ${category.name}? Los productos quedaran en Sin categoria.`,
    );
    if (!ok) {
      return;
    }

    setBusy(true);
    try {
      await onDelete(category.id);
    } finally {
      setBusy(false);
    }
  };

  return (
    <article className="category-admin-item">
      <div className="category-admin-summary">
        <strong className="category-title">
          {category.name}
          {category.isPackaging ? ' (Envases)' : ''}
        </strong>
        <button
          type="button"
          className="icon-btn"
          onClick={() => setIsEditing((current) => !current)}
          disabled={busy}
          title="Editar categoria"
          aria-label="Editar categoria"
        >
          ✎
        </button>
      </div>

      {isEditing && (
        <div className="category-admin-editor">
          <input value={name} onChange={(e) => setName(e.target.value)} />
          <label className="category-packaging-toggle">
            <input
              type="checkbox"
              checked={isPackaging}
              onChange={(e) => setIsPackaging(e.target.checked)}
            />
            Envases
          </label>
          <button type="button" onClick={save} disabled={busy}>
            {saving ? 'Guardando...' : 'Guardar'}
          </button>
          <button type="button" className="danger-btn" onClick={remove} disabled={busy}>
            Eliminar
          </button>
        </div>
      )}
    </article>
  );
}

function EditableProductRow({
  product,
  categories,
  onSave,
  onDelete,
  onSetStatus,
}: {
  product: Product;
  categories: Category[];
  onSave: (
    id: string,
    payload: { name: string; price: number; categoryId?: string },
  ) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  onSetStatus: (id: string, isActive: boolean) => Promise<void>;
}) {
  const [name, setName] = useState(product.name);
  const [price, setPrice] = useState(String(product.price));
  const [categoryId, setCategoryId] = useState(product.category?.id || '');
  const [busy, setBusy] = useState(false);

  const save = async () => {
    const parsedPrice = Number(price);
    if (!name.trim() || Number.isNaN(parsedPrice)) {
      return;
    }

    setBusy(true);
    try {
      await onSave(product.id, {
        name: name.trim(),
        price: parsedPrice,
        categoryId: categoryId || undefined,
      });
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    const ok = window.confirm(`Desactivar ${product.name} del menu?`);
    if (!ok) {
      return;
    }
    setBusy(true);
    try {
      await onDelete(product.id);
    } finally {
      setBusy(false);
    }
  };

  return (
    <article className="admin-menu-item">
      <input value={name} onChange={(e) => setName(e.target.value)} />
      <input
        type="number"
        min="0"
        step="0.01"
        value={price}
        onChange={(e) => setPrice(e.target.value)}
      />
      <select value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
        <option value="">Sin categoria</option>
        {categories.map((category) => (
          <option key={category.id} value={category.id}>
            {category.name}
          </option>
        ))}
      </select>
      <button type="button" onClick={save} disabled={busy}>
        Guardar
      </button>
      <button
        type="button"
        onClick={() => onSetStatus(product.id, !(product.isActive ?? true))}
        disabled={busy}
      >
        {product.isActive ?? true ? 'Desactivar' : 'Activar'}
      </button>
      <button type="button" className="danger-btn" onClick={remove} disabled={busy}>
        Eliminar
      </button>
    </article>
  );
}
