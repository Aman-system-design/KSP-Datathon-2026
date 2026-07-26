import { fail } from '../services/errors.mjs';
import {
  getUtility as getUtilityDefinition,
  listUtilities as listUtilityDefinitions,
  listUtilityCategories as listRegistryCategories,
} from './utility-registry.mjs';

const envelope = data => ({ data });

export function createUtilityServices() {
  return Object.freeze({
    async listUtilities({ query = {} } = {}) {
      return envelope(listUtilityDefinitions({ category: query.category }));
    },
    async listUtilityCategories() {
      return envelope(listRegistryCategories());
    },
    async getUtility({ params } = {}) {
      const definition = getUtilityDefinition(params?.utilityKey);
      if (!definition) fail('NOT_FOUND');
      return envelope(structuredClone(definition));
    },
  });
}
