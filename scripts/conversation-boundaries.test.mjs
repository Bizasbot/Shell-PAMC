import assert from 'node:assert/strict';
import test from 'node:test';
import { buildImporterGraph } from './acceptance/ui-impact.mjs';

const AGENT_STATE = 'web/src/pages/agent/state.ts';
const CONVERSATION_LEAVES = new Set([
  'web/src/utils/ids.ts',
  'web/src/utils/thinking.ts',
  'web/src/types/requestModel.ts',
  'web/src/components/workspace/imageAttachments.ts',
  'web/src/components/workspace/conversationLabels.ts',
]);

function findBoundaryViolations({ importers }) {
  const violations = new Set();
  for (const [dependency, owners] of importers) {
    for (const owner of owners) {
      if (dependency === AGENT_STATE && !owner.startsWith('web/src/pages/agent/')) {
        violations.add(`${owner} -> ${dependency}`);
      }
      if ((CONVERSATION_LEAVES.has(owner) || owner.startsWith('web/src/components/workspace/')) && dependency.startsWith('web/src/pages/')) {
        violations.add(`${owner} -> ${dependency}`);
      }
    }
  }
  return [...violations];
}

function graphOf(sources) {
  return buildImporterGraph({ files: Object.keys(sources), readFile: file => sources[file] });
}

test('conversation boundaries detect eager and lazy page-state dependencies, not erased types', () => {
  const sources = {
    [AGENT_STATE]: 'export const createID = () => "id"; export interface Turn { id: string }',
    'web/src/agent/snapshot.ts': `import type { Turn } from '../pages/agent/state'; export const snapshot = (turn: Turn) => turn.id;`,
    'web/src/utils/ids.ts': `export const createID = () => import('../pages/agent/state');`,
  };
  // The type-only import in snapshot.ts is erased at build time, so only the lazy one counts.
  assert.deepEqual(findBoundaryViolations(graphOf(sources)), [`web/src/utils/ids.ts -> ${AGENT_STATE}`]);
  sources['web/src/utils/ids.ts'] = 'export const createID = () => "id";';
  assert.deepEqual(findBoundaryViolations(graphOf(sources)), []);
});

test('the real runtime graph keeps shared conversation primitives below page state', () => {
  const graph = buildImporterGraph();
  assert.deepEqual(graph.unresolved, []);
  assert.ok(graph.importers.get(AGENT_STATE)?.size > 0, 'discover actual Agent consumers');
  assert.deepEqual(findBoundaryViolations(graph), []);
  for (const leaf of CONVERSATION_LEAVES) assert.ok(graph.importers.get(leaf)?.size > 0, `discover consumers of ${leaf}`);
});

test('shared export policies cannot reach either page domain, including lazy dependencies', () => {
  const sources = {
    [AGENT_STATE]: 'export const formatDuration = () => "1s";',
    'web/src/pages/agent/errors.ts': 'export const failureCode = () => "gateway_unavailable";',
    'web/src/components/workspace/useConversationExport.ts': `export { formatDuration } from '../../pages/agent/state';`,
    'web/src/components/workspace/conversationLabels.ts': `export const failureKey = () => import('../../pages/agent/errors');`,
  };
  assert.deepEqual(findBoundaryViolations(graphOf(sources)).sort(), [
    'web/src/components/workspace/conversationLabels.ts -> web/src/pages/agent/errors.ts',
    `web/src/components/workspace/useConversationExport.ts -> ${AGENT_STATE}`,
  ]);
  sources['web/src/components/workspace/useConversationExport.ts'] = `export { formatDuration } from './conversationLabels';`;
  sources['web/src/components/workspace/conversationLabels.ts'] = 'export const formatDuration = () => "1s";';
  assert.deepEqual(findBoundaryViolations(graphOf(sources)), []);
});
