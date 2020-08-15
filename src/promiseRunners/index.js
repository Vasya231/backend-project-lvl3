import defaultExecutor from './default';

const executors = {
  default: defaultExecutor,
};

export default (executorType) => executors[executorType];
