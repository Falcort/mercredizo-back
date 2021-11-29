import { defineHook } from '@directus/extensions-sdk';
import { DateTime } from 'luxon';
import crypto from 'crypto';

export default defineHook(({ schedule }, { database, logger }) => {
  /**
   * Run every sunday
   * Create the next event
   * @tested on 29/11/2021
   */
  schedule('0 0 * * SUN', async () => {
    logger.info('Running CRON of event draft');
    const date = DateTime.now().plus({ days: 4 }).toISODate();
    database('events')
      .insert({ id: crypto.randomUUID(), date, status: 'draft' }, ['id'])
      .then((e) => logger.info(`Event ${e[0].id} created succesfully`))
      .catch((e) => logger.error(e));
  });

  /**
   * Run every monday
   * Update the next event to allow inscription
   * @tested on 29/11/2021
   */
  schedule('0 0 * * MON', async (): Promise<void> => {
    logger.info('Running CRON of event draft -> inscription');
    const date = DateTime.now().plus({ days: 3 }).toISODate();
    const event = await database('events')
      .select('*').where({ date })
      .first()
      .catch((e) => logger.error(e));
    if (!event) {
      return logger.error('Cron of monday failed to find an event');
    }
    return database('events').update({ status: 'enlist' }, ['id'])
      .then((e) => logger.info(`Event ${e[0].id} updated to "enlist" successfully`))
      .catch((e) => logger.error(e));
  });

  /**
   * Run every tuesday
   * Update the next event with event types suggestions
   * @tested on 29/11/2021
   */
  schedule('0 0 * * TUE', async (): Promise<void> => {
    logger.info('Running CRON of event inscription -> event_type_triage');
    const date = DateTime.now().plus({ days: 1 }).toISODate();
    // Get the next event
    const event = await database('events')
      .select('*').where({ date })
      .first()
      .catch((e) => logger.error(e));
    if (!event) {
      return logger.error('Cron of tuesday failed to find an event');
    }
    // Get all the required elements to have the ratings of every participants
    const presences = await database('event_presences').select('*').where({ event: event.id });
    const usersID: number[] = [];
    presences.forEach((presence) => usersID.push(presence.user));
    const likes = await database('event_type_preferences').select('*').whereIn('user', usersID);
    // Get all the events types
    const eventTypes = await database('event_types').select('*');
    // Iterate over the eventypes to create the average
    const ratings = eventTypes.map((eventType) => {
      const buffer = { ...eventType };
      buffer.total = 0;
      buffer.count = 0;
      // TODO: Optimise by removing the current element;
      likes.forEach((like) => {
        if (eventType.id === like.event_type) {
          buffer.total += like.rating;
          buffer.count += 1;
        }
      });
      buffer.avg = buffer.total / buffer.count;
      return buffer;
    });
    // Get the 3 max ratings
    const suggestions = [];
    for (let i = 0; i < 3; i += 1) {
      let currentMax = 0;
      let currentMaxID = 0;
      let currentMaxIndex = 0;

      // Remove the array so no duplicates
      for (let j = ratings.length - 1; j !== 0; j -= 1) {
        const rating = ratings[j];
        if (rating.avg > currentMax) {
          currentMax = rating.avg;
          currentMaxID = rating.id;
          currentMaxIndex = j;
        }
      }

      suggestions.push(currentMaxID);
      ratings.splice(currentMaxIndex, 1);
    }
    // Directus relation complexe system
    const bufferIDs: number[] = [];
    for (let i = 0; i < suggestions.length; i += 1) {
      // eslint-disable-next-line no-await-in-loop
      const result = await database('event_type_suggestions_event_types')
        .insert({ event_types_id: suggestions[i] }, ['id']);
      bufferIDs.push(result[0].id);
    }
    const eventTypeSuggestion = await database('event_type_suggestions')
      .insert({ id: crypto.randomUUID() }, ['id']);
    for (let i = 0; i < bufferIDs.length; i += 1) {
      // eslint-disable-next-line no-await-in-loop
      await database('event_type_suggestions_event_types')
        .update({ event_type_suggestions_id: eventTypeSuggestion[0].id })
        .where({ id: bufferIDs[i] });
    }
    // Update the event
    return database('events')
      .update({ status: 'event_type_triage', event_type_suggestion: eventTypeSuggestion[0].id }, ['id'])
      .where({ id: event.id })
      .then((e) => logger.info(`Event ${e[0].id} updated to "event_type_triage" successfully`))
      .catch((e) => logger.error(e));
  });
});
