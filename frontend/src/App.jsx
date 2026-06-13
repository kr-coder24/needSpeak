import { useState, useCallback } from 'react';
import { motion } from 'framer-motion';
import { ShoppingCart, Zap, Menu } from 'lucide-react';
import InputPanel from './components/InputPanel';
import CartPanel from './components/CartPanel';
import SummaryPanel from './components/SummaryPanel';
import ErrorBanner from './components/ErrorBanner';
import { parseContent } from './api';

export default function App() {
  const [cart, setCart] = useState(null);
  const [unavailableItems, setUnavailableItems] = useState([]);
  const [totalPrice, setTotalPrice] = useState(0);
  const [budgetExceeded, setBudgetExceeded] = useState(false);
  const [intentType, setIntentType] = useState('');
  const [contextSummary, setContextSummary] = useState('');
  const [summary, setSummary] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [loadingStep, setLoadingStep] = useState(0);
  const [error, setError] = useState(null);
  const [budget, setBudget] = useState(null);
  const [mockMode, setMockMode] = useState(false);
  const [mockClickCount, setMockClickCount] = useState(0);

  // Hidden mock mode toggle: click the lightning bolt 5 times
  const handleMockToggle = () => {
    const newCount = mockClickCount + 1;
    setMockClickCount(newCount);
    if (newCount >= 5) {
      setMockMode(!mockMode);
      setMockClickCount(0);
    }
    // Reset counter after 3 seconds
    setTimeout(() => setMockClickCount(0), 3000);
  };

  const handleSubmit = useCallback(async (input) => {
    setIsLoading(true);
    setError(null);
    setLoadingStep(0);
    setBudget(input.budget_inr || null);

    // Simulate step progression
    const stepTimer1 = setTimeout(() => setLoadingStep(1), 1500);
    const stepTimer2 = setTimeout(() => setLoadingStep(2), 3000);

    try {
      const result = await parseContent(input, mockMode);

      setCart(result.cart || []);
      setUnavailableItems(result.unavailable_items || []);
      setTotalPrice(result.total_price_inr || 0);
      setBudgetExceeded(result.budget_exceeded || false);
      setIntentType(result.intent_type || 'general');
      setContextSummary(result.context_summary || '');
      setSummary(result.summary || '');
    } catch (err) {
      setError(err.message || 'Something went wrong. Please try again.');
      setCart(null);
    } finally {
      clearTimeout(stepTimer1);
      clearTimeout(stepTimer2);
      setIsLoading(false);
      setLoadingStep(0);
    }
  }, [mockMode]);

  const isEmpty = !cart && !isLoading;

  return (
    <div className="h-screen flex flex-col overflow-hidden">
      {/* Top bar */}
      <header className="flex items-center justify-between px-6 py-3" style={{ borderBottom: '1px solid var(--color-border)' }}>
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: 'linear-gradient(135deg, var(--color-accent), #FF6B00)' }}>
            <ShoppingCart size={16} className="text-bg-deep" />
          </div>
          <div>
            <h1 className="text-sm font-bold text-text-primary flex items-center gap-1">
              Context-to-Cart
              <span className="text-[10px] font-normal px-1.5 py-0.5 rounded-full bg-accent/10 text-accent">v1.0</span>
            </h1>
            <p className="text-[10px] text-text-muted">Amazon Hackon 2026</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {mockMode && (
            <motion.span
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              className="text-[10px] px-2 py-1 rounded-full bg-warning/15 text-warning font-medium"
            >
              Mock Mode
            </motion.span>
          )}
          <button onClick={handleMockToggle} className="text-text-muted hover:text-accent transition-colors" title="">
            <Zap size={16} />
          </button>
        </div>
      </header>

      {/* Error banner */}
      {error && (
        <div className="px-6 pt-3">
          <ErrorBanner error={error} onDismiss={() => setError(null)} />
        </div>
      )}

      {/* Three-panel layout */}
      <main className="flex-1 grid grid-cols-[380px_1fr_320px] gap-4 p-4 overflow-hidden">
        <InputPanel onSubmit={handleSubmit} isLoading={isLoading} />
        <CartPanel
          cart={cart}
          unavailableItems={unavailableItems}
          totalPrice={totalPrice}
          budgetExceeded={budgetExceeded}
          budget={budget}
          isLoading={isLoading}
          loadingStep={loadingStep}
          isEmpty={isEmpty}
        />
        <SummaryPanel
          intentType={intentType}
          contextSummary={contextSummary}
          summary={summary}
          cart={cart}
          unavailableItems={unavailableItems}
          totalPrice={totalPrice}
          isEmpty={isEmpty}
        />
      </main>
    </div>
  );
}
