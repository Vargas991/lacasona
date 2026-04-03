import { useEffect, useMemo, useState } from 'react';
import { KitchenTicketPreview, OrderItem, Product, RestaurantTable } from '../types';

interface Props {
  table: RestaurantTable | null;
  tables: RestaurantTable[];
  products: Product[];
  items: OrderItem[];
  canMoveTable?: boolean;
  onMoveTable?: (fromTableId: string, toTableId: string) => Promise<void>;
  onChangeItems: (items: OrderItem[]) => void;
  onCreateOrder: (tableId: string, items: OrderItem[]) => Promise<KitchenTicketPreview | null>;
}

export function OrderPanel({
  table,
  tables,
  products,
  items,
  canMoveTable = false,
  onMoveTable,
  onChangeItems,
  onCreateOrder,
}: Props) {
  const [activeCategory, setActiveCategory] = useState('Todos');
  const [lastPreview, setLastPreview] = useState<KitchenTicketPreview | null>(null);
  const [isTakeout, setIsTakeout] = useState(false);
  const [deliveryAddress, setDeliveryAddress] = useState('');
  const [moveTargetTableId, setMoveTargetTableId] = useState('');
  const [moveModalOpen, setMoveModalOpen] = useState(false);

  const packagingProducts = useMemo(
    () => products.filter((product) => product.category?.isPackaging === true),
    [products],
  );
  const packagingProductIds = useMemo(
    () => new Set(packagingProducts.map((product) => product.id)),
    [packagingProducts],
  );
  const normalProducts = useMemo(
    () => products.filter((product) => !packagingProductIds.has(product.id)),
    [products, packagingProductIds],
  );

  const categories = useMemo(() => {
    const unique = new Set<string>();
    for (const product of normalProducts) {
      unique.add(product.category?.name || 'Sin categoria');
    }
    return ['Todos', ...Array.from(unique).sort((a, b) => a.localeCompare(b))];
  }, [normalProducts]);

  useEffect(() => {
    if (!categories.includes(activeCategory)) {
      setActiveCategory('Todos');
    }
  }, [activeCategory, categories]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setLastPreview(null);
        setMoveModalOpen(false);
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  const visibleProducts = useMemo(() => {
    if (activeCategory === 'Todos') {
      return normalProducts;
    }
    return normalProducts.filter(
      (product) => (product.category?.name || 'Sin categoria') === activeCategory,
    );
  }, [activeCategory, normalProducts]);

  const subtotal = useMemo(
    () =>
      items.reduce((sum, item) => {
        if (packagingProductIds.has(item.productId)) {
          return sum;
        }
        const product = products.find((p) => p.id === item.productId);
        return sum + (product ? Number(product.price) * item.quantity : 0);
      }, 0),
    [items, packagingProductIds, products],
  );

  const packagingPrice = useMemo(
    () =>
      items.reduce((sum, item) => {
        if (!packagingProductIds.has(item.productId)) {
          return sum;
        }
        const product = products.find((p) => p.id === item.productId);
        return sum + (product ? Number(product.price) * item.quantity : 0);
      }, 0),
    [items, packagingProductIds, products],
  );

  const finalTotal = subtotal + packagingPrice;

  const packagingCategoryName = packagingProducts[0]?.category?.name || 'Envases';

  if (!table) {
    return <section className="panel">Selecciona una mesa para crear comanda</section>;
  }

  const availableMoveTargets = tables.filter(
    (candidate) =>
      candidate.id !== table.id &&
      candidate.status === 'FREE',
  );

  const add = (productId: string) => {
    const existing = items.find((i) => i.productId === productId);
    if (existing) {
      onChangeItems(
        items.map((i) => (i.productId === productId ? { ...i, quantity: i.quantity + 1 } : i)),
      );
      return;
    }

    onChangeItems([...items, { productId, quantity: 1 }]);
  };

  const removeOne = (productId: string) => {
    onChangeItems(
      items
        .map((item) =>
          item.productId === productId ? { ...item, quantity: item.quantity - 1 } : item,
        )
        .filter((item) => item.quantity > 0),
    );
  };

  const updateNote = (productId: string, note: string) => {
    onChangeItems(
      items.map((item) =>
        item.productId === productId
          ? { ...item, note: note.trim() ? note : undefined }
          : item,
      ),
    );
  };

  const printPreview = (preview: KitchenTicketPreview) => {
    const popup = window.open('', '_blank', 'width=420,height=640');
    if (!popup) {
      window.alert('No se pudo abrir ventana de impresion. Revisa el bloqueador de ventanas.');
      return;
    }

    popup.document.write(`
      <html>
        <head>
          <title>Comanda Cocina</title>
          <style>
            body { font-family: monospace; padding: 16px; }
            pre { white-space: pre-wrap; font-size: 14px; }
          </style>
        </head>
        <body>
          <pre>${preview.previewText.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</pre>
        </body>
      </html>
    `);
    popup.document.close();
    popup.focus();
    popup.print();
  };

  return (
    <section className="panel">
      <div className="order-panel-header">
        <h3>Comanda {table.name}</h3>
        {canMoveTable && onMoveTable && table.status !== 'FREE' && (
          <button
            type="button"
            className="order-move-open-btn"
            onClick={() => setMoveModalOpen(true)}
          >
            Mover mesa
          </button>
        )}
      </div>

      <div className="category-tabs">
        {categories.map((category) => (
          <button
            key={category}
            type="button"
            className={category === activeCategory ? 'category-tab active' : 'category-tab'}
            onClick={() => setActiveCategory(category)}
          >
            {category}
          </button>
        ))}
      </div>
      <div className="product-list">
        {visibleProducts.map((p) => (
          <button key={p.id} onClick={() => add(p.id)}>
            {p.name} ${Number(p.price).toFixed(2)}
          </button>
        ))}
      </div>
      {!visibleProducts.length && <p>No hay productos en esta categoria.</p>}
      <section className="takeout-section">
        <label className="takeout-toggle">
          <input
            type="checkbox"
            checked={isTakeout}
            onChange={(event) => {
              const checked = event.target.checked;
              setIsTakeout(checked);

              if (!checked) {
                onChangeItems(items.filter((item) => !packagingProductIds.has(item.productId)));
                setDeliveryAddress('');
              }
            }}
          />
          Pedido para llevar
        </label>

        {isTakeout && (
          <div className="takeout-controls">
            <p className="takeout-category-title">{packagingCategoryName}</p>
            <div className="product-list">
              {packagingProducts.map((product) => (
                <button type="button" key={product.id} onClick={() => add(product.id)}>
                  {product.name} ${Number(product.price).toFixed(2)}
                </button>
              ))}
            </div>
          </div>
        )}

        {isTakeout && !packagingProducts.length && (
          <p className="print-error">
            No hay productos de envase configurados. Crea uno en Menu (ej. "Envase").
          </p>
        )}
      </section>
      <ul>
        {items.map((item) => {
          const p = products.find((product) => product.id === item.productId);
          return (
            <li key={item.productId}>
              <div className="order-item-main">
                <span>
                  {item.quantity} x {p?.name}
                </span>
                <input
                  className="order-note-input"
                  type="text"
                  placeholder="Nota para cocina (ej. sin cebolla)"
                  value={item.note || ''}
                  onChange={(e) => updateNote(item.productId, e.target.value)}
                />
              </div>
              <div className="order-item-actions">
                <button type="button" onClick={() => removeOne(item.productId)}>
                  -
                </button>
                <button type="button" onClick={() => add(item.productId)}>
                  +
                </button>
              </div>
            </li>
          );
        })}
      </ul>
      <p>Total: ${subtotal.toFixed(2)}</p>
      {isTakeout && <p>Total con envase: ${finalTotal.toFixed(2)}</p>}
      {isTakeout && (
        <input
          className="takeout-address-input"
          type="text"
          placeholder="Direccion de entrega"
          value={deliveryAddress}
          onChange={(event) => setDeliveryAddress(event.target.value)}
        />
      )}
      <button
        onClick={async () => {
          let itemsToSend = items;

          if (isTakeout) {
            if (!packagingProducts.length) {
              window.alert('Debes configurar productos en la categoria de envases.');
              return;
            }

            const hasPackagingItem = items.some((item) => packagingProductIds.has(item.productId));
            if (!hasPackagingItem) {
              window.alert('Selecciona al menos un envase para el pedido para llevar.');
              return;
            }

            if (!deliveryAddress.trim()) {
              window.alert('Ingresa la direccion de entrega.');
              return;
            }

            let addedAddress = false;
            itemsToSend = items.map((item) => {
              if (addedAddress || !packagingProductIds.has(item.productId)) {
                return item;
              }

              addedAddress = true;
              const extraNote = `Para llevar | Direccion: ${deliveryAddress.trim()}`;
              return {
                ...item,
                note: item.note ? `${item.note} | ${extraNote}` : extraNote,
              };
            });
          }

          const preview = await onCreateOrder(table.id, itemsToSend);
          onChangeItems([]);
          setLastPreview(preview);
          setIsTakeout(false);
          setDeliveryAddress('');

          if (!preview) {
            window.alert('Comanda enviada. No se pudo generar preview de impresion.');
            return;
          }

          if (!preview.printable) {
            window.alert(`Comanda enviada con errores de impresion:\n- ${preview.validationErrors.join('\n- ')}`);
            return;
          }
        }}
        disabled={!items.length}
      >
        Enviar a cocina
      </button>

      {lastPreview && (
        <div className="print-modal-backdrop" onClick={() => setLastPreview(null)}>
          <section className="print-modal" onClick={(event) => event.stopPropagation()}>
            <header className="print-modal-header">
              <h4>Preview de impresion</h4>
              <button type="button" onClick={() => setLastPreview(null)}>
                Cerrar
              </button>
            </header>

            {!lastPreview.printable && (
              <p className="print-error">
                Validacion fallida: {lastPreview.validationErrors.join(' | ')}
              </p>
            )}

            <pre>{lastPreview.previewText}</pre>

            <div className="print-preview-actions">
              <button
                type="button"
                onClick={() => printPreview(lastPreview)}
                disabled={!lastPreview.printable}
              >
                Imprimir comanda
              </button>
            </div>
          </section>
        </div>
      )}

      {moveModalOpen && canMoveTable && onMoveTable && table.status !== 'FREE' && (
        <div className="print-modal-backdrop" onClick={() => setMoveModalOpen(false)}>
          <section className="move-table-modal" onClick={(event) => event.stopPropagation()}>
            <header className="print-modal-header">
              <h4>Mover {table.name}</h4>
              <button type="button" onClick={() => setMoveModalOpen(false)}>
                Cerrar
              </button>
            </header>

            <p>Selecciona una mesa libre para mover la comanda actual.</p>

            <select
              value={moveTargetTableId}
              onChange={(event) => setMoveTargetTableId(event.target.value)}
            >
              <option value="">Selecciona mesa libre</option>
              {availableMoveTargets.map((candidate) => (
                <option key={candidate.id} value={candidate.id}>
                  {candidate.name}
                </option>
              ))}
            </select>

            {!availableMoveTargets.length && (
              <p className="print-error">No hay mesas libres disponibles.</p>
            )}

            <div className="move-table-modal-actions">
              <button type="button" onClick={() => setMoveModalOpen(false)}>
                Cancelar
              </button>
              <button
                type="button"
                disabled={!moveTargetTableId}
                onClick={async () => {
                  if (!moveTargetTableId) {
                    return;
                  }

                  await onMoveTable(table.id, moveTargetTableId);
                  setMoveTargetTableId('');
                  setMoveModalOpen(false);
                }}
              >
                Confirmar movimiento
              </button>
            </div>
          </section>
        </div>
      )}
    </section>
  );
}
