import { defineHook } from '@directus/extensions-sdk';
import { DateTime } from 'luxon';
import axios from 'axios';
import pack from '../package.json';

const API_URL = 'http://localhost:8055';

export default defineHook(({ schedule }, { database, logger }) => {
  logger.info(`🎯 Hook ${pack.name} loaded with version ${pack.version}`);

  async function findEventByDate(days = 0): Promise<Record<string, any>> {
    const date = DateTime.now().plus({ days }).toISODate();
    const event = await database('events')
      .select('*').where({ date })
      .first();
    if (!event) {
      throw new Error('No event found');
    }
    return event;
  }

  /**
   * Run every sunday
   * Create the next event
   * @tested on 20 jan 2022
   * @CRON 0 0 * * SUN
   */
  schedule('0 0 * * SUN', async () => {
    logger.info('CRON - +Event: Running');
    try {
      const date = DateTime.now().plus({ days: 3 });
      await axios.post(`${API_URL}/actions/createEvent/${date.toISODate()}`);
    } catch (e) {
      logger.error('CRON - +Event: Unknown error');
      logger.error(e);
    }
  });

  /**
   * Run every tuesday
   * Update the next event with event types suggestions
   * @tested on 29 nov 2021
   * @CRON 0 0 * * TUE
   */
  schedule('0 0 * * TUE', async (): Promise<void> => {
    logger.info('CRON - +event_type_suggestions & status -> event_type_triage: Running');
    try {
      const event = await findEventByDate(1);
      await axios.patch(`${API_URL}/actions/${event.id}/generateEventTypeSuggestions`);
    } catch (e) {
      logger.error('CRON - +event_type_suggestions & status -> event_type_triage: Unknown error');
      logger.error(e);
    }
  });

  /**
   * Run every tuesday at noon
   * Update the next event with the real event type and the prezo
   * @tested on 29 nov 2021
   * @CRON 0 12 * * TUE
   */
  schedule('0 12 * * TUE', async (): Promise<void> => {
    logger.info('CRON - +event_type & +prezo & status -> place_triage: Running');
    try {
      const event = await findEventByDate(1);

      // Set the prezo
      await axios.patch(`${API_URL}/actions/${event.id}/generatePrezo`);

      // Random event type
      // TODO: Change with votes
      const suggestion = await database('event_type_suggestions_event_types').select('*').where({ event_type_suggestions_id: event.event_type_suggestion });
      const eventType = suggestion[Math.floor(Math.random() * suggestion.length)].event_types_id;
      await database('events')
        .update({ status: 'place_triage', event_type: eventType }, ['id'])
        .where({ id: event.id });
    } catch (e) {
      logger.error('CRON - +event_type & +prezo & status -> place_triage: Unknown error');
      logger.error(e);
    }
  });

  /**
   * Run every wednesday at noon
   * Change the event to running
   * @tested on 29 november 2021
   * @CRON 0 12 * * WED
   */
  schedule('0 12 * * WED', async (): Promise<void> => {
    logger.info('CRON - status -> running: Running');
    try {
      const event = await findEventByDate();
      await database('events')
        .update({ status: 'running' }, ['id'])
        .where({ id: event.id });
    } catch (e) {
      logger.error('CRON - status -> running: Unknown error');
      logger.error(e);
    }
  });

  /**
  * Run every wednesday at 2PM
  * Change the event to running
  * @tested on 29 nov 2021
  * @CRON 0 14 * * WED
  */
  schedule('0 14 * * WED', async (): Promise<void> => {
    logger.info('CRON - status -> finished: Running');
    try {
      const event = await findEventByDate(0);
      await database('events')
        .update({ status: 'finished' }, ['id'])
        .where({ id: event.id });
    } catch (e) {
      logger.error('CRON - status -> finished: Unknown error');
      logger.error(e);
    }
  });
});
