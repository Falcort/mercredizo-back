import { defineHook } from '@directus/extensions-sdk';
import pack from '../package.json';

export default defineHook(({ filter }, { logger }) => {
  logger.info(`🎯 Hook ${pack.name} loaded with version ${pack.version}`);

  filter('users.create', async (payload) => {
    const buffer = { ...payload };
    if (!buffer.language) {
      buffer.language = 'fr-FR';
    }
    return buffer;
  });
});
