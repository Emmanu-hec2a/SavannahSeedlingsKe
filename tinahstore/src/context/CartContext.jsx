import { createContext, useMemo, useState, useEffect } from 'react';
import { initialCart } from '../data/products.js';

export const CartContext = createContext(null);
const defaultDeliveryFee = null; // The nursery quotes delivery after reviewing the address.

export function CartProvider({ children }) {
  // Load initial cart from localStorage if available
  const [items, setItems] = useState(() => {
    try {
      const savedCart = localStorage.getItem('ts_cart');
      if (savedCart) {
        const parsed = JSON.parse(savedCart);
        if (Array.isArray(parsed)) return parsed;
      }
      return initialCart;
    } catch (err) {
      console.error('Failed to load cart from localStorage', err);
      return initialCart;
    }
  });

  const [deliveryFee, setDeliveryFee] = useState(defaultDeliveryFee);

  // Persist cart to localStorage whenever it changes
  useEffect(() => {
    try {
      localStorage.setItem('ts_cart', JSON.stringify(items));
    } catch (err) {
      console.error('Failed to save cart to localStorage', err);
    }
  }, [items]);

  const subtotal = items.reduce((sum, item) => sum + item.product.price * item.quantity, 0);
  const total = items.length && deliveryFee == null ? null : subtotal + (items.length ? deliveryFee : 0);
  const count = items.reduce((sum, item) => sum + item.quantity, 0);

  function addItem(product, options = {}) {
    setItems((current) => {
      // Find if item with same ID already exists
      const match = current.find((item) => item.productId === product.id);

      if (match) {
        return current.map((item) =>
          item === match
            ? { ...item, quantity: item.quantity + (options.quantity || 1) }
            : item
        );
      }

      return [...current, {
        productId: product.id,
        product: product, // Store full product object
        quantity: options.quantity || 1,
      }];
    });
  }

  function updateQuantity(productId, quantity) {
    setItems((current) => current.map((item) => (item.productId === productId ? { ...item, quantity: Math.max(1, quantity) } : item)));
  }

  function removeItem(productId) {
    setItems((current) => current.filter((item) => item.productId !== productId));
  }

  function clear() {
    setItems([]);
  }

  return (
    <CartContext.Provider value={{ items, addItem, updateQuantity, removeItem, clear, subtotal, deliveryFee, setDeliveryFee, total, count }}>
      {children}
    </CartContext.Provider>
  );
}
