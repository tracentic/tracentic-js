// Core API
export {
  createTracentic,
  configure,
  getTracentic,
  type ITracentic,
} from './tracentic.js';

// Models
export { TracenticScope } from './scope.js';
export { type TracenticSpan } from './span.js';

// Configuration
export {
  type TracenticOptions,
  type ModelPricing,
  type AttributeLimitsOptions,
  AttributeLimits,
} from './options.js';

// Global context
export { TracenticGlobalContext } from './global-context.js';
