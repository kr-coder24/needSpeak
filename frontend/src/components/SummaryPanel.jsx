import { motion } from 'framer-motion';
import { Brain, Tag, Package, AlertTriangle, IndianRupee, ChefHat, Wrench, BookOpen, Pill, ShoppingBag } from 'lucide-react';

const intentIcons = {
  recipe: ChefHat,
  diy: Wrench,
  supplies: BookOpen,
  medical: Pill,
  general: ShoppingBag,
};

const intentColors = {
  recipe: '#FF9900',
  diy: '#3B82F6',
  supplies: '#8B5CF6',
  medical: '#EF4444',
  general: '#00A86B',
};

export default function SummaryPanel({ intentType, contextSummary, summary, cart, unavailableItems, totalPrice, isEmpty }) {
  if (isEmpty) {
    return (
      <div className="glass-panel h-full flex flex-col items-center justify-center p-5 text-center">
        <motion.div
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="w-16 h-16 rounded-2xl flex items-center justify-center mb-4"
          style={{ background: 'rgba(139, 92, 246, 0.1)' }}
        >
          <Brain size={28} className="text-text-muted" />
        </motion.div>
        <h3 className="text-base font-semibold text-text-primary mb-2">AI Summary</h3>
        <p className="text-xs text-text-secondary">
          After processing your input, a detailed summary will appear here.
        </p>
      </div>
    );
  }

  const IntentIcon = intentIcons[intentType] || ShoppingBag;
  const intentColor = intentColors[intentType] || '#FF9900';
  const itemsFound = cart?.length || 0;
  const itemsUnavailable = unavailableItems?.length || 0;
  const substituted = cart?.filter(i => i.substituted)?.length || 0;

  return (
    <div className="glass-panel h-full flex flex-col p-5 overflow-y-auto gap-5">
      {/* Intent badge */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex items-center gap-3 p-4 rounded-xl"
        style={{ background: `${intentColor}10`, border: `1px solid ${intentColor}20` }}
      >
        <div className="w-10 h-10 rounded-lg flex items-center justify-center" style={{ background: `${intentColor}20` }}>
          <IntentIcon size={20} style={{ color: intentColor }} />
        </div>
        <div>
          <span className="text-[10px] uppercase tracking-wider font-semibold" style={{ color: intentColor }}>
            {intentType}
          </span>
          <p className="text-sm text-text-primary mt-0.5">{contextSummary}</p>
        </div>
      </motion.div>

      {/* AI Summary */}
      {summary && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
        >
          <div className="flex items-center gap-2 mb-2">
            <Brain size={14} className="text-accent" />
            <h3 className="text-xs font-semibold text-text-secondary uppercase tracking-wider">AI Summary</h3>
          </div>
          <p className="text-sm text-text-primary leading-relaxed">{summary}</p>
        </motion.div>
      )}

      {/* Stats */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="grid grid-cols-2 gap-3"
      >
        <StatCard icon={Package} label="Items Found" value={itemsFound} color="#00A86B" />
        <StatCard icon={AlertTriangle} label="Unavailable" value={itemsUnavailable} color={itemsUnavailable > 0 ? '#F39C12' : '#00A86B'} />
        <StatCard icon={Tag} label="Substituted" value={substituted} color={substituted > 0 ? '#3B82F6' : '#00A86B'} />
        <StatCard icon={IndianRupee} label="Total Cost" value={`Rs.${totalPrice}`} color="#FF9900" />
      </motion.div>

      {/* Powered by */}
      <div className="mt-auto pt-4" style={{ borderTop: '1px solid var(--color-border)' }}>
        <p className="text-[10px] text-text-muted text-center">
          Powered by Amazon Bedrock (Claude Sonnet 4.6)
        </p>
      </div>
    </div>
  );
}

function StatCard({ icon: Icon, label, value, color }) {
  return (
    <div className="p-3 rounded-xl bg-bg-deep/50" style={{ border: '1px solid var(--color-border)' }}>
      <div className="flex items-center gap-1.5 mb-1">
        <Icon size={12} style={{ color }} />
        <span className="text-[10px] text-text-muted uppercase tracking-wider">{label}</span>
      </div>
      <p className="text-lg font-bold text-text-primary">{value}</p>
    </div>
  );
}
