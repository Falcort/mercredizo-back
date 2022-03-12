import crypto from 'crypto';
import { DateTime } from 'luxon';
import { Request } from 'express';
import { Knex } from 'knex';
import { databaseLogger, databaseLoggerDump } from '../types';

export default async function pickPrezo(request: Request, database: Knex): Promise<void> {
  const dump: databaseLoggerDump[] = [];
  const { id } = request.params;

  const event = await database('events')
    .select('id', 'date').where({ id })
    .first();
  if (!event) {
    throw new Error('Cannot find the event');
  }
  dump.push({
    step: 'Find event',
    dump: JSON.parse(JSON.stringify(event)),
  });

  const lastPrezos = await database('events')
    .select('prezo', 'date')
    .orderBy('date', 'desc')
    .distinct()
    .whereNot({ id })
    .limit(3);
  dump.push({
    step: 'Find 3 last prezos in the database',
    dump: JSON.parse(JSON.stringify(lastPrezos)),
  });

  // Get who is going to the event
  const presences = await database('event_presences').select('user').where({ event: id, presence: 'present' });
  const potentialPrezo: any[] = [...presences];
  dump.push({
    step: 'Get all potential prezos (people that will come to the event)',
    dump: JSON.parse(JSON.stringify(presences)),
  });

  // Remove the last prezo from the array
  lastPrezos.forEach((lastPrezo) => {
    const index = potentialPrezo.findIndex((a) => a.user === lastPrezo.prezo);
    if (index >= 0) {
      potentialPrezo.splice(index, 1);
    }
  });
  dump.push({
    step: 'Remove old prezos from potential list',
    dump: JSON.parse(JSON.stringify(potentialPrezo)),
  });

  let prezo = '';
  if (potentialPrezo.length !== 0) {
    prezo = potentialPrezo[Math.floor(Math.random() * potentialPrezo.length)].user;
    dump.push({
      step: 'Select a random prezo in the remaining list',
      dump: prezo,
    });
  } else {
    prezo = presences[Math.floor(Math.random() * presences.length)].user;
    dump.push({
      step: 'Select a random prezo in presences as there is nobody left',
      dump: prezo,
    });
  }

  await database('events')
    .update({ prezo })
    .where({ id });

  await database<databaseLogger>('logs').insert({
    id: crypto.randomUUID(), date_created: DateTime.local().toJSDate(), function: 'generatePrezo', dump: { value: dump },
  });
}
