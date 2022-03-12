import { Request } from 'express';
import { Knex } from 'knex';
import crypto from 'crypto';
import { DateTime } from 'luxon';
import { databaseLogger, databaseLoggerDump } from '../types';

/**
 * Function to shuffle an array
 *
 * @param {any[]} array -- The array to shuffle
 * @return {any[]} -- The shuffled array
 */
export function shuffle(array: any[]) {
  const buffer = [...array];
  let currentIndex = buffer.length;
  let randomIndex;

  while (currentIndex !== 0) {
    randomIndex = Math.floor(Math.random() * currentIndex);
    currentIndex -= 1;
    [buffer[currentIndex], buffer[randomIndex]] = [
      buffer[randomIndex],
      buffer[currentIndex],
    ];
  }

  return buffer;
}
/**
 * Function to generate the last events suggestions
 */
export async function generateEventTypeSuggestions(
  request: Request,
  database: Knex
): Promise<void> {
  const dump: databaseLoggerDump[] = [];
  const { id } = request.params;
  const { force } = request.query;

  if (force) {
    const event = await database('events')
      .select('id', 'event_type_suggestion')
      .where({ id })
      .first();
    if (!event) {
      throw new Error('Cannot find the event');
    }
    dump.push({
      step: 'Find event',
      dump: JSON.parse(JSON.stringify(event)),
    });

    // Get all the required elements to have the ratings of every participant
    const presences = await database('event_presences')
      .join('directus_users', 'event_presences.user', 'directus_users.id')
      .select('user', 'presence', 'last_name')
      .where({ event: id })
      .whereIn('presence', ['present', 'unknow']);
    if (presences.length === 0) {
      throw new Error('No participants');
    }
    dump.push({
      step: 'People that will come or maybe come to the event',
      dump: JSON.parse(JSON.stringify(presences)),
    });

    const usersID: number[] = [];
    presences.forEach((presence) => usersID.push(presence.user));
    const likes = await database('event_type_preferences')
      .join(
        'event_types',
        'event_type_preferences.event_type',
        'event_types.id'
      )
      .join(
        'directus_users',
        'directus_users.id',
        'event_type_preferences.user'
      )
      .select(
        'event_type',
        'rating',
        'event_types.name',
        'directus_users.last_name'
      )
      .whereIn('event_type_preferences.user', usersID);
    dump.push({
      step: 'Preferences of people coming',
      dump: JSON.parse(JSON.stringify(likes)),
    });

    // Get all the events types
    const eventTypes = await database('event_types').select('id', 'name');

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
    dump.push({
      step: 'Aggregated tables of people ratings of event types',
      dump: JSON.parse(JSON.stringify(ratings)),
    });

    // Remove the last event types
    const lastEvents = await database('events')
      .join('event_types', 'events.event_type', 'event_types.id')
      .select('event_type', 'date', 'event_types.name')
      .orderBy('date', 'desc')
      .distinct()
      .whereNot({ 'events.id': id })
      .limit(4);
    dump.push({
      step: 'Last 4 event types',
      dump: JSON.parse(JSON.stringify(lastEvents)),
    });

    // Remove last event types from collection
    lastEvents.forEach((elem) => {
      const index = ratings.findIndex((a) => a.id === elem.event_type);
      if (index !== -1) {
        ratings.splice(index, 1);
      }
    });
    dump.push({
      step: 'Remove the last 4 events types from the ratings list',
      dump: JSON.parse(JSON.stringify(ratings)),
    });

    const myMap: Record<string, { id: string; name: string }[]> = {};
    ratings.forEach((rating) => {
      if (myMap[rating.avg]) {
        const current = myMap[rating.avg];
        if (current) {
          myMap[rating.avg] = [
            ...current,
            { id: rating.id, name: rating.name },
          ];
        }
      } else {
        myMap[rating.avg] = [{ id: rating.id, name: rating.name }];
      }
    });
    dump.push({
      step: 'Map of ratings',
      dump: JSON.parse(JSON.stringify(myMap)),
    });
    let suggestions: { id: string; name: string }[] = [];

    const keys = Object.keys(myMap) || [];
    keys.sort();
    dump.push({
      step: 'Keys of the map',
      dump: JSON.parse(JSON.stringify(keys)),
    });

    keys.forEach((key) => {
      const shuffled: { id: string; name: string }[] = shuffle(
        myMap[key] || []
      );
      suggestions = [...suggestions, ...shuffled];
    });
    dump.push({
      step: 'Each keys shuffled',
      dump: JSON.parse(JSON.stringify(suggestions)),
    });

    // Get 3 top elements
    suggestions = suggestions.slice(-3);
    dump.push({
      step: 'Top 3 elements',
      dump: JSON.parse(JSON.stringify(suggestions)),
    });

    // Directus relation complex system
    const bufferIDs: number[] = [];
    for (let i = 0; i < suggestions.length; i += 1) {
      // eslint-disable-next-line no-await-in-loop
      const currentResult = await database(
        'event_type_suggestions_event_types'
      ).insert({ event_types_id: suggestions[i]?.id }, ['id']);
      bufferIDs.push(currentResult[0].id);
    }
    const eventTypeSuggestion = await database('event_type_suggestions').insert(
      { id: crypto.randomUUID() },
      ['id']
    );
    for (let i = 0; i < bufferIDs.length; i += 1) {
      // eslint-disable-next-line no-await-in-loop
      await database('event_type_suggestions_event_types')
        .update({ event_type_suggestions_id: eventTypeSuggestion[0].id })
        .where({ id: bufferIDs[i] });
    }

    // Update the event
    await database('events')
      .update({ event_type_suggestion: eventTypeSuggestion[0].id })
      .where({ id });

    if (event.event_type_suggestion) {
      await database('event_type_suggestions')
        .del()
        .where({ id: event.event_type_suggestion });
    }
  } else {
    dump.push({
      step: 'Event already have a suggestion',
      dump: 'Do nothing',
    });
  }
  await database<databaseLogger>('logs').insert({
    id: crypto.randomUUID(),
    date_created: DateTime.local().toJSDate(),
    function: 'generateEventTypeSuggestions',
    dump: { value: dump },
  });
}
