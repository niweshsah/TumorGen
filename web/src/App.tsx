import { lazy, Suspense, useEffect, useRef, useState } from 'react';
import {
  Github,
  Activity,
  ArrowLeft,
  ArrowRight,
  BrainCircuit,
  ChevronRight,
  CircleHelp,
  FileText,
  ListFilter,
  LoaderCircle,
  FolderOpen,
  Crosshair,
  Moon,
  Sun,
  ScanLine,
  ShieldCheck,
  X,
} from 'lucide-react';
import { loadManifest } from './data/dataset';
import { useCase } from './data/use-case';
import { useWorkspace } from './state';
import {
  MODALITY_NAMES,
  type CaseRecord,
  type Manifest,
  type Modality,
  type ViewMode,
} from './types';
import { CaseStrip, PatientBrowser } from './components/PatientBrowser';
import { Analysis } from './components/Analysis';
import { IconButton, RangeControl, ViewControls } from './components/Controls';
import { ResearchPage } from './components/ResearchPage';
import { REPOSITORY } from './research';
import { ResearchDialog } from './components/ResearchDialog';
import { SliceViewer } from './visualization/SliceViewer';
const BrainViewer = lazy(() =>
  import('./visualization/BrainViewer').then((module) => ({
    default: module.BrainViewer,
  })),
);

function LoadingWorkspace({ progress }: { progress: number }) {
  return (
    <div className="workspace-loading" role="status">
      <div className="loading-orbit">
        <BrainCircuit size={38} />
      </div>
      <strong>Preparing the volume</strong>
      <span>MRI · Ground Truth · Prediction</span>
      <div className="loading-track">
        <i style={{ transform: `scaleX(${progress})` }} />
      </div>
      <small>{Math.round(progress * 100)}% · Aligning physical coordinates</small>
    </div>
  );
}
export default function App() {
  const [researchOpen, setResearchOpen] = useState(
    () => new URLSearchParams(window.location.search).get('view') === 'research',
  );
  const navigate = (research: boolean) => {
    const url = new URL(window.location.href);
    if (research) url.searchParams.set('view', 'research');
    else url.searchParams.delete('view');
    url.hash = '';
    window.history.pushState(null, '', url);
    setResearchOpen(research);
    window.scrollTo(0, 0);
  };
  useEffect(() => {
    const update = () =>
      setResearchOpen(new URLSearchParams(window.location.search).get('view') === 'research');
    window.addEventListener('popstate', update);
    return () => window.removeEventListener('popstate', update);
  }, []);
  useEffect(() => {
    if (researchOpen && window.location.hash)
      requestAnimationFrame(() =>
        document.getElementById(window.location.hash.slice(1))?.scrollIntoView(),
      );
  }, [researchOpen]);
  const [manifest, setManifest] = useState<Manifest | null>(null),
    [manifestError, setManifestError] = useState<string | null>(null);
  const [record, setRecord] = useState<CaseRecord | null>(null),
    [retry, setRetry] = useState(0),
    [datasetRetry, setDatasetRetry] = useState(0);
  const [dialog, setDialog] = useState<'method' | 'provenance' | null>(null),
    [browserOpen, setBrowserOpen] = useState(false),
    [help, setHelp] = useState(false),
    [notice, setNotice] = useState('');
  const state = useWorkspace(),
    comparisonRef = useRef<HTMLDivElement>(null);
  const loaded = useCase(record, state.modality, retry);
  useEffect(() => {
    const controller = new AbortController();
    setManifestError(null);
    loadManifest(controller.signal)
      .then((value) => {
        setManifest(value);
        const requested = new URLSearchParams(window.location.search).get('case');
        setRecord(value.cases.find((item) => item.id === requested) ?? value.cases[0]);
      })
      .catch((error) => {
        if (!controller.signal.aborted) setManifestError(error.message);
      });
    return () => controller.abort();
  }, [datasetRetry]);
  useEffect(() => {
    if (!record) return;
    useWorkspace.getState().set({ crosshair: record.centroid });
    useWorkspace.getState().resetCamera();
    const url = new URL(window.location.href);
    url.searchParams.set('case', record.id);
    window.history.replaceState(null, '', url);
  }, [record]);
  useEffect(() => {
    if (!notice) return;
    const timer = setTimeout(() => setNotice(''), 4000);
    return () => clearTimeout(timer);
  }, [notice]);
  const fullscreen = async () => {
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else if (comparisonRef.current?.requestFullscreen)
        await comparisonRef.current.requestFullscreen();
      else setNotice('Fullscreen is unavailable in this browser.');
    } catch {
      setNotice('Fullscreen could not be opened.');
    }
  };
  const position = manifest?.cases.findIndex((item) => item.id === record?.id) ?? 0;
  const moveCase = (direction: number) => {
    if (manifest) {
      const next = manifest.cases[position + direction];
      if (next) setRecord(next);
    }
  };
  return (
    <div className="app-shell">
      <a className="skip-link" href={researchOpen ? '#research' : '#workspace'}>
        Skip to workspace
      </a>
      <aside className="primary-nav" aria-label="Workspace navigation">
        <a className="brand" href="./" aria-label="TumorGen home">
          <BrainCircuit size={29} strokeWidth={1.6} />
          <span>TumorGen</span>
        </a>
        <nav aria-label="Main navigation">
          <button
            aria-label="Compare segmentations"
            className={!researchOpen ? 'nav-active' : ''}
            onClick={() => {
              navigate(false);
              state.set({ mode: 'combined' });
            }}
          >
            <ScanLine size={22} />
            <span>Compare</span>
          </button>
          <button
            aria-label="Browse case library"
            onClick={() => {
              if (researchOpen) navigate(false);
              setBrowserOpen(true);
            }}
            disabled={!manifest}
          >
            <FolderOpen size={22} />
            <span>Cases</span>
          </button>
          <button
            aria-label="Research approach"
            className={researchOpen ? 'nav-active' : ''}
            onClick={() => navigate(true)}
          >
            <FileText size={22} />
            <span>Research</span>
          </button>
          <button aria-label="Source attribution" onClick={() => setDialog('provenance')}>
            <ShieldCheck size={22} />
            <span>Source</span>
          </button>
          <a href={REPOSITORY} target="_blank" rel="noreferrer" aria-label="GitHub repository">
            <Github size={22} />
            <span>GitHub</span>
          </a>
        </nav>
        <div className="nav-utilities">
          <IconButton
            label={state.theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
            onClick={state.toggleTheme}
          >
            {state.theme === 'dark' ? <Sun size={20} /> : <Moon size={20} />}
          </IconButton>
          <IconButton label="Viewer help" active={help} onClick={() => setHelp(!help)}>
            <CircleHelp size={20} />
          </IconButton>
        </div>
      </aside>
      {researchOpen && <ResearchPage onCompare={() => navigate(false)} />}
      <div className={researchOpen ? 'workspace-retained' : undefined} inert={researchOpen}>
        <main className="workspace" id="workspace" tabIndex={-1}>
          {manifest && record ? (
            <>
              <PatientBrowser
                cases={manifest.cases}
                selected={record.id}
                onSelect={setRecord}
                open={browserOpen}
                onClose={() => setBrowserOpen(false)}
              />
              <header className="case-toolbar">
                <div className="case-pagination">
                  <IconButton
                    label="Previous case"
                    disabled={position === 0}
                    onClick={() => moveCase(-1)}
                  >
                    <ArrowLeft size={17} />
                  </IconButton>
                  <IconButton
                    label="Next case"
                    disabled={position === manifest.cases.length - 1}
                    onClick={() => moveCase(1)}
                  >
                    <ArrowRight size={17} />
                  </IconButton>
                </div>
                <div className="active-case">
                  <strong>{record.id.replace('_11', '')}</strong>
                  <span>
                    {String(position + 1).padStart(2, '0')} of {manifest.cases.length} ·
                    Glioblastoma
                  </span>
                </div>
                <CaseStrip cases={manifest.cases} selected={record.id} onSelect={setRecord} />
                <button
                  className="browse-button"
                  aria-label="Open case browser"
                  onClick={() => {
                    if (researchOpen) navigate(false);
                    setBrowserOpen(true);
                  }}
                >
                  <FolderOpen size={17} />
                  <span className="case-browse-label">Browse {manifest.cases.length} cases</span>
                  <span className="mobile-case-count">{manifest.cases.length} cases</span>
                  <ChevronRight size={15} />
                </button>
              </header>
              {help && (
                <div className="help-strip">
                  <ScanLine size={20} />
                  <p>
                    <strong>Explore the volume.</strong> Drag to rotate, scroll to zoom, right-drag
                    to pan. Click an MRI slice to move the crosshair; arrow keys work when a slice
                    is focused.
                  </p>
                  <IconButton label="Close viewer help" onClick={() => setHelp(false)}>
                    <X size={16} />
                  </IconButton>
                </div>
              )}
              <div className="comparison-workspace" ref={comparisonRef}>
                <div className="workspace-title">
                  <h1>Brain tumor segmentation</h1>
                  <div className="segmented-control" aria-label="View mode">
                    {(
                      [
                        ['combined', 'Overview'],
                        ['3d', '3D comparison'],
                        ['slices', 'MRI slices'],
                      ] as [ViewMode, string][]
                    ).map(([mode, name]) => (
                      <button
                        key={mode}
                        aria-pressed={state.mode === mode}
                        className={state.mode === mode ? 'selected' : ''}
                        onClick={() => state.set({ mode })}
                      >
                        {name}
                      </button>
                    ))}
                  </div>
                </div>
                {loaded.error ? (
                  <div className="volume-error" role="alert">
                    <Activity size={30} />
                    <h2>Unable to load this volume</h2>
                    <p>{loaded.error}</p>
                    <button
                      className="primary-button"
                      onClick={() => setRetry((value) => value + 1)}
                    >
                      Retry case
                    </button>
                  </div>
                ) : !loaded.data ? (
                  <LoadingWorkspace progress={loaded.progress} />
                ) : (
                  <>
                    <div
                      className={`comparison-layout ${state.mode === 'slices' ? 'slices-only' : ''}`}
                    >
                      {state.mode !== 'slices' && (
                        <div className="viewer-pair">
                          {(['gt', 'pred'] as const).map((kind) => (
                            <section
                              className={`viewer-panel ${kind}`}
                              key={kind}
                              aria-label={
                                kind === 'gt' ? 'Ground Truth 3D viewer' : 'Prediction 3D viewer'
                              }
                            >
                              <div className="viewer-heading">
                                <div>
                                  <span className={`panel-indicator ${kind}`} />
                                  <h2>{kind === 'gt' ? 'Ground Truth' : 'Prediction'}</h2>
                                </div>
                                <span>
                                  {kind === 'gt'
                                    ? 'Expert-reviewed annotation'
                                    : 'TumorGen Prediction'}
                                </span>
                              </div>
                              <div className="brain-canvas">
                                <Suspense
                                  fallback={
                                    <div className="viewer-fallback">
                                      <LoaderCircle className="spin" size={24} />
                                    </div>
                                  }
                                >
                                  <BrainViewer
                                    record={record}
                                    mri={loaded.data!.mri}
                                    mask={
                                      kind === 'gt'
                                        ? loaded.data!.groundTruth
                                        : loaded.data!.prediction
                                    }
                                    meshUrls={
                                      kind === 'gt'
                                        ? record.groundTruthMeshes
                                        : loaded.data!.artifact.meshUrls
                                    }
                                    kind={kind}
                                  />
                                </Suspense>
                                <div className="viewer-annotation">
                                  <span>RAS space · mm</span>
                                </div>
                              </div>
                              <div className="viewer-footer">
                                <span>{kind === 'gt' ? 'Ground Truth' : 'Prediction'} volume</span>
                                <span className="mono">
                                  {(kind === 'gt'
                                    ? loaded.data!.metrics.WT.groundTruthMl
                                    : loaded.data!.metrics.WT.predictionMl
                                  ).toFixed(2)}{' '}
                                  <small>mL</small>
                                </span>
                              </div>
                            </section>
                          ))}
                        </div>
                      )}
                      <ViewControls fullscreen={fullscreen} />
                    </div>
                    <Analysis
                      record={record}
                      metrics={loaded.data.metrics}
                      provenance={loaded.data.artifact.provenance}
                      onProvenance={() => setDialog('provenance')}
                    />
                    {state.mode !== '3d' && (
                      <section className="mri-workspace">
                        <div className="mri-toolbar">
                          <div>
                            <ScanLine size={19} />
                            <h2>Multiplanar MRI</h2>
                            <span className="radiology-label">Radiological orientation</span>
                          </div>
                          <label className="modality-select">
                            Modality
                            <select
                              aria-label="MRI modality"
                              value={state.modality}
                              onChange={(event) =>
                                state.set({
                                  modality: event.target.value as Modality,
                                  window: 255,
                                  level: 127.5,
                                })
                              }
                            >
                              {Object.entries(MODALITY_NAMES).map(([key, name]) => (
                                <option key={key} value={key}>
                                  {name}
                                </option>
                              ))}
                            </select>
                          </label>
                        </div>
                        <SliceViewer
                          mri={loaded.data.mri}
                          groundTruth={loaded.data.groundTruth}
                          prediction={loaded.data.prediction}
                        />
                        <div className="slice-control-footer">
                          <span>
                            <Crosshair size={15} /> Crosshair synchronized{' '}
                            <span className="mono subtle">{state.crosshair.join(' / ')}</span>
                          </span>
                          <details className="window-control">
                            <summary>
                              Window / level <ListFilter size={15} />
                            </summary>
                            <div className="settings-popover">
                              <RangeControl
                                label="MRI window"
                                value={state.window}
                                onChange={(window) => state.set({ window })}
                                min={1}
                                max={510}
                                step={1}
                                suffix=""
                              />
                              <RangeControl
                                label="MRI level"
                                value={state.level}
                                onChange={(level) => state.set({ level })}
                                min={0}
                                max={255}
                                step={1}
                                suffix=""
                              />
                            </div>
                          </details>
                        </div>
                      </section>
                    )}
                  </>
                )}
              </div>
              <footer className="workspace-footer">
                <span>
                  <span className="status-dot" />{' '}
                  {loaded.data
                    ? 'Volume ready'
                    : loaded.error
                      ? 'Volume unavailable'
                      : 'Loading volume'}{' '}
                  <span className="footer-divider">/</span> {record.shape.join(' × ')} voxels
                </span>
                <button aria-label="Source attribution" onClick={() => setDialog('provenance')}>
                  Source & methodology <ArrowRight size={14} />
                </button>
              </footer>
            </>
          ) : (
            <div className="setup-screen">
              <BrainCircuit size={45} />
              <h1>{manifestError ? 'Prepare your study cohort' : 'Opening the workspace'}</h1>
              {manifestError ? (
                <>
                  <p>{manifestError}</p>
                  <button
                    className="primary-button"
                    onClick={() => setDatasetRetry((value) => value + 1)}
                  >
                    Reload dataset
                  </button>
                </>
              ) : (
                <LoaderCircle size={24} className="spin" />
              )}
            </div>
          )}
        </main>
      </div>
      {dialog && (
        <ResearchDialog
          kind={dialog}
          provenance={loaded.data?.artifact.provenance}
          onClose={() => setDialog(null)}
        />
      )}
      {notice && (
        <div className="toast" role="status">
          {notice}
        </div>
      )}
    </div>
  );
}
