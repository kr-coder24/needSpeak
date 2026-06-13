import { motion } from 'framer-motion';
import { Sparkles, Search, ShoppingCart } from 'lucide-react';

const steps = [
  { icon: Sparkles, label: 'Analyzing your input...', color: '#FF9900' },
  { icon: Search, label: 'Finding products...', color: '#00A86B' },
  { icon: ShoppingCart, label: 'Building your cart...', color: '#3B82F6' },
];

export default function LoadingState({ currentStep = 0 }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 gap-8">
      {/* Animated orb */}
      <motion.div
        className="relative w-24 h-24"
        animate={{ rotate: 360 }}
        transition={{ duration: 3, repeat: Infinity, ease: 'linear' }}
      >
        <div className="absolute inset-0 rounded-full" style={{
          background: `conic-gradient(from 0deg, ${steps[currentStep]?.color || '#FF9900'}, transparent, ${steps[currentStep]?.color || '#FF9900'})`,
          opacity: 0.3,
          filter: 'blur(8px)',
        }} />
        <div className="absolute inset-2 rounded-full bg-bg-deep flex items-center justify-center">
          {(() => {
            const Icon = steps[currentStep]?.icon || Sparkles;
            return (
              <motion.div
                key={currentStep}
                initial={{ scale: 0, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ type: 'spring', stiffness: 200 }}
              >
                <Icon size={28} style={{ color: steps[currentStep]?.color }} />
              </motion.div>
            );
          })()}
        </div>
      </motion.div>

      {/* Steps */}
      <div className="flex flex-col gap-3">
        {steps.map((step, i) => (
          <motion.div
            key={i}
            className="flex items-center gap-3"
            initial={{ opacity: 0.3 }}
            animate={{ opacity: i <= currentStep ? 1 : 0.3 }}
            transition={{ duration: 0.3 }}
          >
            <div className="w-2 h-2 rounded-full" style={{
              background: i <= currentStep ? step.color : 'var(--color-bg-hover)',
              boxShadow: i === currentStep ? `0 0 8px ${step.color}` : 'none',
            }} />
            <span className={`text-sm ${i === currentStep ? 'text-text-primary font-medium' : 'text-text-muted'}`}>
              {step.label}
            </span>
            {i < currentStep && (
              <motion.span
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                className="text-xs text-success"
              >
                Done
              </motion.span>
            )}
          </motion.div>
        ))}
      </div>

      {/* Skeleton cart items */}
      <div className="w-full max-w-md space-y-3 mt-4">
        {[1, 2, 3].map((i) => (
          <div key={i} className="skeleton h-16 w-full" style={{ animationDelay: `${i * 0.2}s` }} />
        ))}
      </div>
    </div>
  );
}
