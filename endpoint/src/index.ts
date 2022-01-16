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
  router.get('/createEvent/:date', async (request: Request, response: Response) => {
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

  // TODO: Remove last 4 event types
  router.get('/:id/generateEventTypeSuggestions', async (request: Request, response: Response) => {
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
      // Get all the required elements to have the ratings of every participants
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

      const myMap: Record<string, string[]> = {};
      ratings.forEach((rating) => {
        if (myMap[rating.avg]) {
          const current = myMap[rating.avg];
          if (current) {
            const buffer = [...current, rating.id];
            myMap[rating.avg] = buffer;
          }
        } else {
          myMap[rating.avg] = [rating.id];
        }
      });
      let suggestions: string[] = [];

      const keys = Object.keys(myMap) || [];
      keys.sort();

      keys.forEach((key) => {
        const shuffled = shuffle(myMap[key] || []);
        suggestions = [...shuffled];
      });

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
});
