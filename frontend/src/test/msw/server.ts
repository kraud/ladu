import { setupServer } from 'msw/node';
import { handlers } from './handlers';

/** Node MSW server, shared across the suite via `test/setup.ts`. */
export const server = setupServer(...handlers);
