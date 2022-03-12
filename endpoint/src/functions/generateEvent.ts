import { DateTime } from 'luxon';
import crypto from 'crypto';
import { Request } from 'express';
import { Knex } from 'knex';
import { databaseLogger } from '../types';

export default async function generateEvent(request: Request, database: Knex): Promise<void> {
  const { date } = request.params;
  const luxonDate = DateTime.fromISO(date || '');

  if (!luxonDate.isValid) {
    throw new Error('Invalid date');
  }

  const event = await database('events').insert({ id: crypto.randomUUID(), date, status: 'enlist' }, ['*']);
  await database<databaseLogger>('logs').insert({
    id: crypto.randomUUID(),
    date_created: DateTime.local().toJSDate(),
    function: 'generateEvent',
    dump: {
      value: [{
        step: 'Create the event',
        dump: event,
      }],
    },
  });
}
