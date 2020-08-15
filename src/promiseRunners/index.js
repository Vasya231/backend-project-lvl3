import defaultExecutor from './default';
import listrExecutor from './listr';

const executors = {
  default: defaultExecutor,
  listr: listrExecutor,
};

export default (executorType) => executors[executorType];
