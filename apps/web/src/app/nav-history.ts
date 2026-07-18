import { useNavStore, type NavSnapshot } from './nav-store';

function snapshotOf(state: NavSnapshot): NavSnapshot {
  return { view: state.view, residentId: state.residentId, incomeId: state.incomeId };
}

function sameView(a: NavSnapshot, b: NavSnapshot): boolean {
  return a.view === b.view && a.residentId === b.residentId && a.incomeId === b.incomeId;
}

export function startNavHistory(): () => void {
  if (typeof window === 'undefined') {
    return () => {};
  }

  let restoring = false;
  window.history.replaceState(snapshotOf(useNavStore.getState()), '');

  const onPopState = (event: PopStateEvent) => {
    const snapshot = event.state as NavSnapshot | null;
    if (!snapshot?.view) return;
    restoring = true;
    useNavStore.getState().restore(snapshot);
    restoring = false;
  };
  window.addEventListener('popstate', onPopState);

  const unsubscribe = useNavStore.subscribe((state, previous) => {
    if (restoring || sameView(state, previous)) return;
    window.history.pushState(snapshotOf(state), '');
  });

  return () => {
    window.removeEventListener('popstate', onPopState);
    unsubscribe();
  };
}
