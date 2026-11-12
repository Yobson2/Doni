import { DataSource } from 'typeorm';
import * as dotenv from 'dotenv';
import { buildDataSourceOptions } from './data-source.options';

dotenv.config();

/** DataSource used by the TypeORM CLI (`pnpm typeorm ...`). */
export default new DataSource(buildDataSourceOptions());
