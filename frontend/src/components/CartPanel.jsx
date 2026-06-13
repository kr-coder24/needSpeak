import { motion, AnimatePresence } from 'framer-motion';
import { ShoppingCart, Package, AlertCircle, TrendingDown } from 'lucide-react';
import CartItem from './CartItem';
import LoadingState from './LoadingState';

export default function CartPanel({ cart, unavailableItems, totalPrice, budgetExceeded, budget, isLoading, loadingStep, isEmpty }) {
  if (isLoading) {
    return (
      <div className="glass-panel h-full flex flex-col p-5 overflow-y-auto">
        <LoadingState currentStep={loadingStep} />
      </div>
    );
  }

  if (isEmpty) {
    return (
      <div className="glass-panel h-full flex flex-col items-center justify-center p-5 text-center">
        <motion.div
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: 'spring', stiffness: 150 }}
          className="w-20 h-20 rounded-2xl flex items-center justify-center mb-6"
          style={{ background: 'var(--color-accent-glow)' }}
        >
          <ShoppingCart size={36} className="text-accent" />
        </motion.div>
        <h3 className="text-lg font-semibold text-text-primary mb-2">Your Cart is Empty</h3>
        <p className="text-sm text-text-secondary max-w-xs">
          Paste a recipe, shopping list, or URL on the left to automatically build your cart.
        </p>
      </div>
    );
  }

  return (
    <div className="glass-panel h-full flex flex-col p-5 overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <h2 className="text-lg font-bold text-text-primary">Your Cart</h2>
          <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-accent/15 text-accent">
            {cart?.length || 0} items
          </span>
        </div>
        <p className="text-lg font-bold gradient-text">Rs.{totalPrice}</p>
      </div>

      {/* Budget bar */}
      {budget && (
        <div className="mb-4">
          <div className="flex items-center justify-between text-xs mb-1.5">
            <span className="text-text-secondary flex items-center gap-1">
              <TrendingDown size={12} /> Budget
            </span>
            <span className={budgetExceeded ? 'text-danger font-medium' : 'text-success font-medium'}>
              Rs.{totalPrice} / Rs.{budget}
            </span>
          </div>
          <div className="w-full h-1.5 rounded-full bg-bg-deep overflow-hidden">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${Math.min((totalPrice / budget) * 100, 100)}%` }}
              transition={{ duration: 0.8, ease: 'easeOut' }}
              className="h-full rounded-full"
              style={{
                background: budgetExceeded
                  ? 'linear-gradient(90deg, var(--color-danger), #FF6B6B)'
                  : 'linear-gradient(90deg, var(--color-success), #34D399)',
              }}
            />
          </div>
        </div>
      )}

      {/* Cart items */}
      <div className="flex-1 overflow-y-auto space-y-2 pr-1">
        <AnimatePresence mode="popLayout">
          {cart?.map((item, i) => (
            <CartItem key={item.sku} item={item} index={i} />
          ))}
        </AnimatePresence>
      </div>

      {/* Unavailable items */}
      {unavailableItems && unavailableItems.length > 0 && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}
          className="mt-4 pt-4" style={{ borderTop: '1px solid var(--color-border)' }}
        >
          <div className="flex items-center gap-2 mb-2">
            <AlertCircle size={14} className="text-warning" />
            <span className="text-xs font-medium text-warning">
              {unavailableItems.length} item{unavailableItems.length > 1 ? 's' : ''} not available
            </span>
          </div>
          <div className="space-y-1">
            {unavailableItems.map((item, i) => (
              <div key={i} className="flex items-center justify-between text-xs px-3 py-2 rounded-lg bg-bg-deep/50">
                <span className="text-text-secondary capitalize">{item.name}</span>
                <span className="text-text-muted">
                  {item.reason === 'not_in_catalog' ? 'Not in catalog' : 'Out of stock'}
                </span>
              </div>
            ))}
          </div>
        </motion.div>
      )}

      {/* Total bar */}
      <div className="mt-4 pt-4 flex items-center justify-between" style={{ borderTop: '1px solid var(--color-border)' }}>
        <span className="text-sm text-text-secondary">Total ({cart?.length} items)</span>
        <span className="text-xl font-bold gradient-text">Rs.{totalPrice}</span>
      </div>
    </div>
  );
}
