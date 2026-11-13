import StructureView from '@/features/structure/StructureView';
import LibraryView from '@/features/library/LibraryView';

/**
 * Transitional shim: the former Content screen is replaced by
 * features/structure (/structure) and features/library (/library).
 * Delete this file once App.tsx routes to those views directly.
 */
export default function ContentView({ initialSection }: { initialSection?: string }) {
  return initialSection === 'library' ? <LibraryView /> : <StructureView />;
}
