'use client';

import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';

interface DetailRow {
  label: string;
  sublabel?: string;
  value: string;
}

interface DetailSection {
  heading: string;
  total: string;
  rows: DetailRow[];
}

export default function DetailedStatCard({
  label,
  value,
  hint,
  sections,
  modalTitle,
  modalHint,
}: {
  label: string;
  value: string;
  hint?: string;
  sections: DetailSection[];
  modalTitle: string;
  modalHint?: string;
}) {
  const [showModal, setShowModal] = useState(false);
  // Portals can only render once we're mounted in the browser (no
  // document.body during SSR) — this flag just guards that.
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const modal = (
    <AnimatePresence>
      {showModal && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
          className="fixed inset-0 bg-ink/40 backdrop-blur-sm flex items-center justify-center z-50 p-4"
          onClick={() => setShowModal(false)}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 6 }}
            transition={{ type: 'spring', stiffness: 400, damping: 32 }}
            className="bg-white rounded-xl2 shadow-card w-full max-w-3xl p-6 max-h-[85vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
          <h2 className="font-display text-2xl mb-1">{modalTitle}</h2>
          {modalHint && <p className="text-sm text-forest-500/70 mb-5">{modalHint}</p>}

          <div className="space-y-6">
            {sections.map((section) => (
              <div key={section.heading}>
                <div className="flex items-center justify-between mb-2">
                  <h3 className="font-display text-lg">{section.heading}</h3>
                  <span className="text-sm font-medium text-forest-700">{section.total}</span>
                </div>
                <div className="rounded-lg border border-forest-100 divide-y divide-forest-50 overflow-hidden">
                  {section.rows.map((row, i) => (
                    <div key={`${row.label}-${i}`} className="flex items-center justify-between gap-3 px-3.5 py-2.5 text-sm">
                      <div className="min-w-0">
                        <p className="font-medium text-ink">{row.label}</p>
                        {row.sublabel && <p className="text-xs text-forest-500/60">{row.sublabel}</p>}
                      </div>
                      <span className="text-forest-700 whitespace-nowrap text-right">{row.value}</span>
                    </div>
                  ))}
                  {section.rows.length === 0 && (
                    <p className="text-sm text-forest-500/50 px-3.5 py-3">Nothing recorded here.</p>
                  )}
                </div>
              </div>
            ))}
            {sections.length === 0 && <p className="text-sm text-forest-500/60 py-4">No data for this period.</p>}
          </div>

          <button
            onClick={() => setShowModal(false)}
            className="mt-6 w-full rounded-lg border border-forest-200 py-2.5 text-sm font-medium hover:bg-forest-50 active:scale-[0.98] transition-transform"
          >
            Close
          </button>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );

  return (
    <>
      <motion.div
        className="relative bg-white rounded-xl2 border border-forest-100 shadow-card p-5 cursor-pointer"
        onClick={() => setShowModal(true)}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') setShowModal(true);
        }}
        whileHover={{ y: -4, boxShadow: '0 12px 28px rgba(21,38,37,0.12)', borderColor: '#7fab9d' }}
        whileTap={{ scale: 0.98 }}
        transition={{ type: 'spring', stiffness: 400, damping: 28 }}
      >
        <p className="text-xs uppercase tracking-wide text-forest-500/70">{label}</p>
        <p className="font-display text-3xl mt-1.5">{value}</p>
        {hint && <p className="text-xs text-forest-500/60 mt-1">{hint}</p>}
      </motion.div>

      {mounted ? createPortal(modal, document.body) : null}
    </>
  );
}
