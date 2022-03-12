import { defineInterface } from '@directus/extensions-sdk';
import InterfaceComponent from './interface.vue';
import logger from './logger';
import pack from '../package.json';

logger.info(`🎯 Interface ${pack.name} loaded with version ${pack.version}`);

export default defineInterface({
  id: pack.name,
  name: 'Buttons to reloads events',
  icon: 'cached',
  description:
    'Interface that allow you to reload some parts of an event, like changing the Prezo',
  component: InterfaceComponent,
  options: null,
  types: ['string'],
});
