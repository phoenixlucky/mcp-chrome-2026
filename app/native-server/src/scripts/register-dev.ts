import { registerUserLevelHostWithNodePath } from './utils';

registerUserLevelHostWithNodePath().then((registered) => {
  if (!registered) process.exitCode = 1;
});
