import { defineHook } from '@directus/extensions-sdk';
import pack from '../package.json';

export default defineHook(({ filter }, { logger }) => {
  logger.info(`🎯 Hook ${pack.name} loaded with version ${pack.version}`);

  filter('users.create', async (payload) => {
    const buffer = { ...payload };
    if (!buffer.role) {
      buffer.role = 'd4fe3074-aee9-4c6d-a9ce-bfdc3261a182';
    }
    return buffer;
  });
});
