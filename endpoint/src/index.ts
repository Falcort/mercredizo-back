import { defineEndpoint } from '@directus/extensions-sdk';
import { Request, Response } from 'express';
import crypto from 'crypto';
import { DateTime } from 'luxon';
import pack from '../package.json';

function shuffle(array: any[]) {
  const buffer = [...array];
  let currentIndex = array.length;
  let randomIndex;

  while (currentIndex !== 0) {
    randomIndex = Math.floor(Math.random() * currentIndex);
    currentIndex -= 1;
    [buffer[currentIndex], buffer[randomIndex]] = [buffer[randomIndex], buffer[currentIndex]];
  }

  return array;
}

export default defineEndpoint((router, { database, logger }) => {
  logger.info(`🎯 Endpoint ${pack.name} loaded with version ${pack.version}`);

  /**
   * Endpoint to create and event
   */
  router.post('/createEvent/:date', async (request: Request, response: Response) => {
    let result: any = '';
    let status = 500;
    try {
      const { date } = request.params;
      const luxonDate = DateTime.fromISO(date || '');

      if (!luxonDate.isValid) {
        throw new Error('Invalid date');
      }

      result = await database('events').insert({ id: crypto.randomUUID(), date, status: 'enlist' }, ['id']);
      status = 200;
    } catch (e) {
      logger.error(e);
      result = e;
    }
    response.status(status).send(result);
  });

  /**
   * Function to generate the last events suggestions
   * TODO: Delete last suggestions
   */
  router.patch('/:id/generateEventTypeSuggestions', async (request: Request, response: Response) => {
    let result: any = '';
    let status = 500;
    try {
      const { id } = request.params;

      const event = await database('events')
        .select('*').where({ id })
        .first();
      if (!event) {
        throw new Error('Cannot find the event');
      }
      // Get all the required elements to have the ratings of every participant
      const presences = await database('event_presences').select('*').where({ event: event.id }).whereIn('presence', ['present', 'unknow']);
      if (presences.length === 0) {
        throw new Error('No participants');
      }

      const usersID: number[] = [];
      presences.forEach((presence) => usersID.push(presence.user));
      const likes = await database('event_type_preferences').select('*').whereIn('user', usersID);

      // Get all the events types
      const eventTypes = await database('event_types').select('*');

      // Iterate over the evenTypes to create the average
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

      // Remove the last event types
      const lastEvents = await database('events')
        .select('event_type', 'date')
        .orderBy('date', 'desc')
        .distinct()
        .limit(4);

      lastEvents.forEach((elem) => {
        const index = ratings.findIndex((a) => a.id === elem.event_type);
        if (index !== -1) {
          ratings.splice(index, 1);
        }
      });

      const myMap: Record<string, string[]> = {};
      ratings.forEach((rating) => {
        if (myMap[rating.avg]) {
          const current = myMap[rating.avg];
          if (current) {
            myMap[rating.avg] = [...current, rating.id];
          }
        } else {
          myMap[rating.avg] = [rating.id];
        }
      });
      let suggestions: string[] = [];

      const keys = Object.keys(myMap) || [];
      keys.sort();

      keys.forEach((key) => {
        const shuffled: string[] = shuffle(myMap[key] || []);
        suggestions = [...suggestions, ...shuffled];
      });

      // Get 3 top elements
      suggestions = suggestions.slice(0, 3);

      // Directus relation complex system
      const bufferIDs: number[] = [];
      for (let i = 0; i < suggestions.length; i += 1) {
        // eslint-disable-next-line no-await-in-loop
        const currentResult = await database('event_type_suggestions_event_types')
          .insert({ event_types_id: suggestions[i] }, ['id']);
        bufferIDs.push(currentResult[0].id);
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
      result = await database('events')
        .update({ status: 'event_type_triage', event_type_suggestion: eventTypeSuggestion[0].id }, ['id'])
        .where({ id });
      status = 200;
    } catch (e) {
      logger.error(e);
      result = e;
    }
    response.status(status).send(result);
  });

  /**
   * Function to generate the Prezo of the event
   */
  router.patch('/:id/generatePrezo', async (request: Request, response: Response) => {
    let result: any = '';
    let status = 500;
    try {
      const { id } = request.params;

      const event = await database('events')
        .select('*').where({ id })
        .first();
      if (!event) {
        throw new Error('Cannot find the event');
      }

      const lastPrezos = await database('events')
        .select('prezo', 'date')
        .orderBy('date', 'desc')
        .distinct()
        .limit(3);

      // Get who is going to the event
      const presences = await database('event_presences').select('*').where({ event: event.id, presence: 'present' });
      const potentialPrezo: any[] = [...presences];
      // Remove the last prezo from the array
      potentialPrezo.forEach((elem) => {
        potentialPrezo.splice(potentialPrezo.findIndex((a) => a === elem.user), 1);
      });

      // Remove old prezo
      lastPrezos.forEach((elem) => {
        potentialPrezo.splice(potentialPrezo.findIndex((a) => a === elem.prezo), 1);
      });

      let prezo = '';
      if (potentialPrezo.length !== 0) {
        prezo = potentialPrezo[Math.floor(Math.random() * potentialPrezo.length)];
      } else {
        prezo = presences[Math.floor(Math.random() * presences.length)];
      }

      await database('events')
        .update({ prezo }, ['id'])
        .where({ id });
      status = 200;
    } catch (e) {
      logger.error(e);
      result = e;
    }
    response.status(status).send(result);
  });
});
