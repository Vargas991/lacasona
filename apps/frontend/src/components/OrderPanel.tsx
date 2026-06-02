// Imprimir preview de cocina en navegador (formato 58mm)
function printKitchenPreviewInBrowser(preview: KitchenTicketPreview) {
  const printWindow = window.open('', '_blank', 'width=600,height=600');
  if (!printWindow) return;
  printWindow.document.write(`
    <html>
      <head>
        <title>Comanda - ${preview.orderId}</title>
        <style>
          body { font-family: monospace; font-size: 14px; width: 58mm; margin: 0; padding: 8px; }
          pre { white-space: pre-wrap; word-break: break-all; font-size: 14px; }
        </style>
      </head>
      <body>
        <pre>${preview.previewText}</pre>
      </body>
    </html>
  `);
  printWindow.document.close();
  printWindow.focus();
  printWindow.print();
  printWindow.close();
}
import { useEffect, useMemo, useState } from 'react';
import { KitchenTicketPreview, OrderItem, Product, RestaurantTable } from '../types';
import { useIsMobile } from '../hooks/useIsMobile';

interface Props {
  table: RestaurantTable | null;
  tables: RestaurantTable[];
  products: Product[];
  items: OrderItem[];
  canMoveTable?: boolean;
  onMoveTable?: (fromTableId: string, toTableId: string) => Promise<void>;
  onChangeItems: (items: OrderItem[]) => void;
  onCreateOrder: (tableId: string, items: OrderItem[], isDelivery?: boolean, deliveryAddress?: string) => Promise<KitchenTicketPreview | null>;
  onPrintKitchenTicket: (orderId: string) => Promise<void>;
  setSelectedTable: (table: RestaurantTable | null) => void;
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
  onPrintKitchenTicket,
  setSelectedTable,
}: Props) {
  // TODOS LOS HOOKS DEBEN IR ANTES DE CUALQUIER RETURN O CONDICIONAL
  const isMobile = useIsMobile();
  const [activeCategory, setActiveCategory] = useState('');
  const [lastPreview, setLastPreview] = useState<KitchenTicketPreview | null>(null);
  const [showLastPreview, setShowLastPreview] = useState(false);
  const [isTakeout, setIsTakeout] = useState(false);
  const [deliveryAddress, setDeliveryAddress] = useState('');
  const [moveTargetTableId, setMoveTargetTableId] = useState('');
  const [moveModalOpen, setMoveModalOpen] = useState(false);
  // Selección de contornos por cada plato
  const [sideDishModal, setSideDishModal] = useState<{productId: string, quantity: number, idx?: number} | null>(null);
  const [selectedSideDishes, setSelectedSideDishes] = useState<string[]>([]);
  // const isMobile = useIsMobile();
  // Productos de envase
  const packagingProducts = useMemo(
    () => products.filter((product) => product.category?.isPackaging === true),
    [products],
  );
  const packagingProductIds = useMemo(
    () => new Set(packagingProducts.map((product) => product.id)),
    [packagingProducts],
  );
  // Productos de contornos
  const sideDishProducts = useMemo(
    () => products.filter((product) => product.category?.name?.toLowerCase() === 'contornos'),
    [products],
  );
  const sideDishProductIds = useMemo(
    () => new Set(sideDishProducts.map((product) => product.id)),
    [sideDishProducts],
  );
  // Productos normales (platos principales)
  const normalProducts = useMemo(
    () => products.filter((product) => !packagingProductIds.has(product.id) && !sideDishProductIds.has(product.id)),
    [products, packagingProductIds, sideDishProductIds],
  );

  const categories = useMemo(() => {
    const unique = new Set<string>();
    for (const product of normalProducts) {
      unique.add(product.category?.name || 'Sin categoria');
    }
    return Array.from(unique).sort((a, b) => a.localeCompare(b));
  }, [normalProducts]);

  useEffect(() => {
    if (!categories.includes(activeCategory)) {
      setActiveCategory(categories[0] || 'Todos');
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
    if (!activeCategory) {
      return normalProducts;
    }
    return normalProducts.filter(
      (product) => (product.category?.name || 'Sin categoria') === activeCategory,
    );
  }, [activeCategory, normalProducts]);

  const requiresSideDishes = (productId: string) => {
    const product = products.find((p) => p.id === productId);
    return Boolean(product?.category?.hasSideDish && sideDishProducts.length > 0);
  };

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
    (candidate) => candidate.id !== table.id && candidate.status === 'FREE',
  );


  // Agregar plato principal: abre modal para seleccionar contornos solo si la categoria lo requiere
  const add = (productId: string) => {
    if (requiresSideDishes(productId)) {
      setSideDishModal({ productId, quantity: 1 });
      setSelectedSideDishes([]);
      return;
    }

    onChangeItems([
      ...items,
      {
        productId,
        quantity: 1,
      },
    ]);
  };

  // Confirmar selección de contornos y agregar a la orden
  const confirmAddWithSides = () => {
    if (!sideDishModal) return;
    const { productId, quantity, idx } = sideDishModal;
    const contornos = selectedSideDishes.slice(0, 3)
      .map(id => {
        const prod = products.find(p => p.id === id);
        return prod ? prod.name : '';
      })
      .filter(Boolean)
      .join(', ');
    if (typeof idx === 'number') {
      // Editar el item existente, preservando la nota adicional
      onChangeItems(
        items.map((item, i) => {
          if (i !== idx) return item;
          // Extraer nota adicional existente
          let notaAdicional = '';
          if (item.note?.startsWith('Contornos: ')) {
            const match = item.note.match(/^Contornos: ([^|]*)(?: \| Nota: (.*))?$/);
            if (match) {
              notaAdicional = match[2] ?? '';
            }
          } else if (item.note) {
            notaAdicional = item.note;
          }
          let note = '';
          if (contornos) {
            if (notaAdicional && notaAdicional.trim() !== '') {
              note = `Contornos: ${contornos} \n| Nota: ${notaAdicional}`;
            } else {
              note = `Contornos: ${contornos}`;
            }
          } else {
            note = notaAdicional;
          }
          return { ...item, note };
        })
      );
    } else {
      // Agregar nuevo item
      let note = '';
      if (contornos) {
        note = `Contornos: ${contornos}`;
      }
      onChangeItems([
        ...items,
        {
          productId,
          quantity,
          note,
        },
      ]);
    }
    setSideDishModal(null);
    setSelectedSideDishes([]);
  };

  const removeOne = (idx: number) => {
    onChangeItems(
      items
        .map((item, i) =>
          i === idx ? { ...item, quantity: item.quantity - 1 } : item
        )
        .filter((item) => item.quantity > 0),
    );
  };

  // Sumar cantidad al mismo ítem (mismos contornos y nota)
  const addSame = (item: OrderItem, idx: number) => {
    onChangeItems(
      items.map((it, i) =>
        i === idx ? { ...it, quantity: it.quantity + 1 } : it
      )
    );
  };

  // Permite agregar nota adicional al final del comentario de contornos, por ítem (índice)
  const updateNote = (idx: number, note: string) => {
    onChangeItems(
      items.map((item, i) => {
        if (i !== idx) return item;
        // Si la nota ya tiene contornos, los separamos
        const contornoMatch = item.note?.match(/^Contornos: ([^|]*)(?: \| Nota: (.*))?$/);
        let contornos = contornoMatch ? contornoMatch[1] : '';
        let notaAdicional = note;
        if (contornos) {
          // Siempre incluir el separador | Nota: aunque esté vacío
          return {
            ...item,
            note: `Contornos: ${contornos} | Nota: ${notaAdicional ?? ''}`,
          };
        } else {
          return {
            ...item,
            note: notaAdicional ?? '',
          };
        }
      })
    );
  };

  async function printToKitchenPrinter(orderId: string) {
    try {
      await onPrintKitchenTicket(orderId);
      window.alert('Comanda enviada a la impresora de cocina.');
    } catch (err) {
      window.alert('No se pudo imprimir en cocina: ' + (err as Error).message);
    }
  }

  return (
    <section className="panel">
      <button className="back-button" onClick={() => setSelectedTable(null)}>Volver</button>
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
            {p.name} <span className="product-price"> ${Number(p.price).toFixed(2)}</span>
          </button>
        ))}
      </div>

      {/* Modal para seleccionar contornos */}
      {sideDishModal && (
        <div className="print-modal-backdrop" onClick={() => setSideDishModal(null)}>
          <section className="print-modal" onClick={e => e.stopPropagation()}>
            <header className="print-modal-header">
              <h4>Selecciona hasta 3 contornos</h4>
              <button type="button" onClick={() => setSideDishModal(null)}>Cerrar</button>
            </header>
            <div className="product-list">

              {sideDishProducts.map((contorno) => (
                <button
                key={contorno.id}
                type="button"
                  className={selectedSideDishes.includes(contorno.id) ? 'category-tab active' : 'category-tab'}
                  onClick={() => {
                    if (selectedSideDishes.includes(contorno.id)) {
                      setSelectedSideDishes(selectedSideDishes.filter(id => id !== contorno.id));
                    } else if (selectedSideDishes.length < 3) {
                      setSelectedSideDishes([...selectedSideDishes, contorno.id]);
                    }
                  }}
                  >
                  {contorno.name}
                </button>
              ))}
            </div>
            <button type="button" onClick={confirmAddWithSides}>
              Agregar plato con contornos
            </button>
          </section>
        </div>
      )}
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
                  {product.name} <span className="product-price"> ${Number(product.price).toFixed(2)}</span>
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
        {items.map((item, idx) => {
          const p = products.find((product) => product.id === item.productId);
          // Mostrar contornos en la nota si existen
          let contornos = '';
          let notaAdicional = '';
          if (item.note?.startsWith('Contornos: ')) {
            const match = item.note.match(/^Contornos: ([^|]*)(?: \| Nota: (.*))?$/);
            if (match) {
              contornos = match[1];
              notaAdicional = match[2] ?? '';
            }
          } else if (item.note) {
            notaAdicional = item.note;
          }
          return (
            <li key={idx}>
              <div className="order-item-main">
                <span>
                  {item.quantity} x {p?.name}
                  {/* Botón para editar contornos solo para productos principales con contornos disponibles */}
                  {contornos && <span style={{fontSize: '0.9em', color: '#888'}}> (Contornos: {contornos})</span>}
                  {p && !packagingProductIds.has(p.id) && !sideDishProductIds.has(p.id) && p.category?.hasSideDish && sideDishProducts.length > 0 && (
                    <button
                      type="button"
                      className="order-edit-sides-btn"
                      style={{ marginLeft: 8 }}
                      onClick={() => {
                        setSideDishModal({ productId: item.productId, quantity: item.quantity, idx });
                        // Si ya hay contornos, marcarlos como seleccionados
                        if (contornos) {
                          const selected = contornos.split(',').map(s => s.trim());
                          setSelectedSideDishes(
                            sideDishProducts.filter(sd => selected.includes(sd.name)).map(sd => sd.id)
                          );
                        } else {
                          setSelectedSideDishes([]);
                        }
                      }}
                    >
                      Editar
                    </button>
                  )}
                </span>
                <input
                  className="order-note-input"
                  type="text"
                  placeholder="Nota adicional para cocina (ej. sin cebolla)"
                  value={notaAdicional}
                  onChange={(e) => updateNote(idx, e.target.value)}
                />
              </div>
              <div className="order-item-actions">
                <button type="button" onClick={() => removeOne(idx)}>
                  -
                </button>
                <button type="button" onClick={() => addSame(item, idx)}>
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
          // Antes de enviar, quitamos sideDishes y solo dejamos note
          let itemsToSend = items.map(item => {
            const { sideDishes, ...rest } = item;
            return rest;
          });
          
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
          }
          
          // Llama a onCreateOrder con isDelivery y deliveryAddress si es para llevar
          const preview = await onCreateOrder(
            table.id,
            itemsToSend,
            isTakeout ? true : undefined,
            isTakeout ? deliveryAddress.trim() : undefined
          );

          onChangeItems([]);
          setLastPreview(preview);
          setShowLastPreview(Boolean(preview));
          setIsTakeout(false);
          setDeliveryAddress('');
          
          if (!preview) {
            window.alert('Comanda enviada. No se pudo generar preview de impresion.');
            return;
          }
          
          if (!preview.printable) {
            window.alert(
              `Comanda enviada con errores de impresion:\n- ${preview.validationErrors.join('\n- ')}`,
            );
          }
        }}
        disabled={!items.length}
        >
        Enviar a cocina
      </button>
      <br />
      <br />
        {lastPreview && !showLastPreview && (
          <button
            type="button"
            className="view-order-button"
            onClick={() => setShowLastPreview(true)}
          >
            Ver pedido generado
          </button>
        )}

      {showLastPreview && lastPreview && (
        <div className="print-modal-backdrop" onClick={() => setShowLastPreview(false)}>
          <section className="print-modal" onClick={(event) => event.stopPropagation()}>
            <header className="print-modal-header">
              <h4>Preview de impresion</h4>
              <button type="button" onClick={() => setShowLastPreview(false)}>
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
                onClick={() => printToKitchenPrinter(lastPreview.orderId)}
                disabled={!lastPreview.printable}
              >
                Imprimir en cocina
              </button>
              {/* <button
                type="button"
                onClick={() => printKitchenPreviewInBrowser(lastPreview)}
                disabled={!lastPreview.printable}
              >
                Imprimir desde navegador
              </button> */}
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
