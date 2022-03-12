import { defineEndpoint } from '@directus/extensions-sdk';
import { Request, Response } from 'express';
import pack from '../package.json';
import {
  generateEvent,
  generateEventTypeSuggestions,
  pickPrezo,
} from './functions';

export default defineEndpoint((router, { database, logger }) => {
  logger.info(`🎯 Endpoint ${pack.name} loaded with version ${pack.version}`);

  /**
   * Endpoint to create and event
   */
  router.post(
    '/generateEvent/:date',
    async (request: Request, response: Response) => {
      try {
        await generateEvent(request, database);
        response.status(200).send('success');
      } catch (e) {
        logger.error(e);
        response.status(500).send(e);
      }
    }
  );

  /**
   * Endpoint to generate the last events suggestions
   * @TODO: Query to force reload, if not do nothing
   */
  router.patch(
    '/:id/generateEventTypeSuggestions',
    async (request: Request, response: Response) => {
      try {
        await generateEventTypeSuggestions(request, database);
        response.status(200).send('success');
      } catch (e) {
        logger.error(e);
        response.status(500).send(e);
      }
    }
  );

  /**
   * Function to generate the Prezo of the event
   */
  router.patch(
    '/:id/generatePrezo',
    async (request: Request, response: Response) => {
      try {
        await pickPrezo(request, database);
        response.status(200).send('success');
      } catch (e) {
        logger.error(e);
        response.status(500).send(e);
      }
    }
  );
});
