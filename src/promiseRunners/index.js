import defaultExecutor from './default';
import listrExecutor from './listr';

const executors = {
  default: defaultExecutor,
  listr: listrExecutor,
  none: (promises) => promises,
};

export default (executorType) => executors[executorType];
