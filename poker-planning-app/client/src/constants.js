export const VOTING_PRESETS = {
  fibonacci: {
    displayName: 'Fibonacci',
    values: ['0', '1', '2', '3', '5', '8', '13', '21', '34', '55', '89', '?', '☕']
  },
  tshirt: {
    displayName: 'T-Shirt Sizes',
    values: ['XS', 'S', 'M', 'L', 'XL', 'XXL', '?', '☕']
  },
  powersOfTwo: {
    displayName: 'Powers of Two',
    values: ['0', '1', '2', '4', '8', '16', '32', '64', '?', '☕']
  },
};

export const MAX_VOTING_OPTIONS = 20;
// DEFAULT_VOTING_SCALE_CONFIG matches the backend's default
export const DEFAULT_VOTING_SCALE_CONFIG = { type: 'preset', name: 'fibonacci' };
