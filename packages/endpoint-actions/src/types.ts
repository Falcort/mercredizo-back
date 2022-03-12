export type databaseLoggerDump = {
  step: string;
  dump: any;
};

export type databaseLogger = {
  id: string;
  date_created: Date;
  function: string;
  dump: { value: databaseLoggerDump[] };
};

export type expressFunctionReturn = {
  status: number;
  payload: any;
};
