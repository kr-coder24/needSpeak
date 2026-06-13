import { motion } from 'framer-motion';
import { Package, ArrowRightLeft, Info } from 'lucide-react';

export default function CartItem({ item, index }) {
  return (
    <motion.div
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: index * 0.05, type: 'spring', stiffness: 200 }}
      className={`group relative flex items-center gap-4 p-4 rounded-xl transition-all duration-200 hover:bg-bg-hover/50 ${
        item.optional ? 'opacity-70' : ''
      }`}
      style={{ border: '1px solid var(--color-border)' }}
    >
      {/* Product icon */}
      <div className="shrink-0 w-10 h-10 rounded-lg flex items-center justify-center" style={{
        background: item.substituted ? 'rgba(243, 156, 18, 0.15)' : 'rgba(255, 153, 0, 0.1)',
      }}>
        {item.substituted ? (
          <ArrowRightLeft size={18} className="text-warning" />
        ) : (
          <Package size={18} className="text-accent" />
        )}
      </div>

      {/* Product details */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <h4 className="text-sm font-medium text-text-primary truncate capitalize">
            {item.name}
          </h4>
          {item.optional && (
            <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-bg-hover text-text-muted">
              Optional
            </span>
          )}
          {item.substituted && (
            <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-warning/20 text-warning font-medium">
              Swapped
            </span>
          )}
        </div>
        <p className="text-xs text-text-secondary mt-0.5">
          {item.brand} &middot; {item.quantity_units} x {item.unit_quantity}{item.unit}
        </p>
        {item.substitution_reason && (
          <p className="text-[11px] text-warning/80 mt-1 flex items-center gap-1">
            <Info size={10} /> {item.substitution_reason}
          </p>
        )}
      </div>

      {/* Price */}
      <div className="text-right shrink-0">
        <p className="text-sm font-semibold text-text-primary">Rs.{item.total_price_inr}</p>
        {item.quantity_units > 1 && (
          <p className="text-[11px] text-text-muted">Rs.{item.price_per_unit_inr} each</p>
        )}
      </div>
    </motion.div>
  );
}
