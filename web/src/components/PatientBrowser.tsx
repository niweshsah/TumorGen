import { ArrowDownWideNarrow, Search, X } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import type { CaseRecord } from '../types';

export function PatientBrowser({
  cases,
  selected,
  onSelect,
  open,
  onClose,
}: {
  cases: CaseRecord[];
  selected: string;
  onSelect: (record: CaseRecord) => void;
  open: boolean;
  onClose: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    if (open && !dialog.current?.open) dialog.current?.showModal();
    if (!open && dialog.current?.open) dialog.current?.close();
  }, [open]);
  const [query, setQuery] = useState(''),
    [volume, setVolume] = useState('all'),
    [sort, setSort] = useState('id');
  const [minDice, setMinDice] = useState(0);
  const filtered = useMemo(
    () =>
      cases
        .filter((record) => {
          const ml = record.metrics.WT.groundTruthMl;
          return (
            `${record.id} ${record.category} ${record.cohort}`
              .toLowerCase()
              .includes(query.toLowerCase()) &&
            record.metrics.WT.dice >= minDice &&
            (volume === 'all' ||
              (volume === 'small' && ml < 20) ||
              (volume === 'medium' && ml >= 20 && ml < 60) ||
              (volume === 'large' && ml >= 60))
          );
        })
        .sort((a, b) =>
          sort === 'dice'
            ? a.metrics.WT.dice - b.metrics.WT.dice
            : sort === 'volume'
              ? b.metrics.WT.groundTruthMl - a.metrics.WT.groundTruthMl
              : a.id.localeCompare(b.id),
        ),
    [cases, query, volume, sort, minDice],
  );
  return (
    <>
      <dialog
        ref={dialog}
        className="patient-browser"
        aria-label="Patient browser"
        onCancel={onClose}
        onClick={(event) => {
          if (event.target === event.currentTarget) {
            const box = event.currentTarget.getBoundingClientRect();
            if (
              event.clientX > box.right ||
              event.clientX < box.left ||
              event.clientY > box.bottom ||
              event.clientY < box.top
            )
              onClose();
          }
        }}
      >
        <div className="browser-heading">
          <div>
            <h2>
              Case library <span>{cases.length}</span>
            </h2>
          </div>
          <button
            className="mobile-close icon-button"
            aria-label="Close case browser"
            onClick={onClose}
          >
            <X size={18} />
          </button>
        </div>
        <label className="search-field">
          <Search size={15} />
          <input
            aria-label="Search cases"
            placeholder="Search case ID…"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
          {query && (
            <button aria-label="Clear search" onClick={() => setQuery('')}>
              <X size={13} />
            </button>
          )}
        </label>
        <div className="browser-filters">
          <select
            aria-label="Filter tumor volume"
            value={volume}
            onChange={(event) => setVolume(event.target.value)}
          >
            <option value="all">All tumor volumes</option>
            <option value="small">Small · under 20 mL</option>
            <option value="medium">Medium · 20–60 mL</option>
            <option value="large">Large · over 60 mL</option>
          </select>
          <label title="Sort cases">
            <ArrowDownWideNarrow size={14} />
            <select
              aria-label="Sort cases"
              value={sort}
              onChange={(event) => setSort(event.target.value)}
            >
              <option value="id">Case ID</option>
              <option value="dice">Dice ↑</option>
              <option value="volume">Volume ↓</option>
            </select>
          </label>
        </div>
        <details className="dice-filter">
          <summary>
            Agreement filter <span>{minDice ? `≥ ${minDice.toFixed(2)}` : 'Any Dice'}</span>
          </summary>
          <label>
            Minimum whole-tumor Dice
            <input
              aria-label="Minimum Dice"
              type="range"
              min={0}
              max={1}
              step={0.05}
              value={minDice}
              onChange={(event) => setMinDice(Number(event.target.value))}
            />
          </label>
        </details>
        <div className="browser-list-label">
          <span>{filtered.length} cases</span>
          <span>Ground Truth volume</span>
        </div>
        <div className="case-list">
          {filtered.map((record, index) => (
            <button
              type="button"
              className={`case-item ${record.id === selected ? 'selected' : ''}`}
              key={record.id}
              aria-label={`Select ${record.id}`}
              aria-pressed={record.id === selected}
              onClick={() => {
                onSelect(record);
                onClose();
              }}
            >
              <div className="case-thumbnail">
                <img src={record.thumbnailUrl} alt="" loading={index < 8 ? 'eager' : 'lazy'} />
              </div>
              <div className="case-item-text">
                <span className="case-code">
                  {record.id.replace('UPENN-GBM-', 'GBM-').replace('_11', '')}
                </span>
                <span className="case-category">
                  Glioblastoma <span>·</span> mpMRI
                </span>
                <span className="case-item-metrics">
                  <span>{record.metrics.WT.groundTruthMl.toFixed(1)} mL</span>
                  <span>D {record.metrics.WT.dice.toFixed(3)}</span>
                </span>
              </div>
              <span className="selection-marker" />
            </button>
          ))}
          {!filtered.length && (
            <div className="no-results">
              No matching cases.
              <button
                onClick={() => {
                  setQuery('');
                  setVolume('all');
                  setMinDice(0);
                }}
              >
                Clear filters
              </button>
            </div>
          )}
        </div>
        <div className="browser-footer">
          <span className="status-dot" />
          <div>
            UPenn-GBM<span>Real MRI · Expert-reviewed reference</span>
          </div>
        </div>
      </dialog>
    </>
  );
}

export function CaseStrip({
  cases,
  selected,
  onSelect,
}: {
  cases: CaseRecord[];
  selected: string;
  onSelect: (record: CaseRecord) => void;
}) {
  const active = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    active.current?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
  }, [selected]);
  return (
    <div className="case-strip" aria-label="Case thumbnails">
      {cases.map((record, index) => (
        <button
          key={record.id}
          ref={record.id === selected ? active : undefined}
          aria-label={`View ${record.id}`}
          aria-pressed={record.id === selected}
          className={record.id === selected ? 'selected' : ''}
          onClick={() => onSelect(record)}
          title={`${record.id} · ${record.metrics.WT.groundTruthMl.toFixed(1)} mL`}
        >
          <img src={record.thumbnailUrl} alt="" loading={index < 8 ? 'eager' : 'lazy'} />
        </button>
      ))}
    </div>
  );
}
