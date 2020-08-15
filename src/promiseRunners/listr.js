import Listr from 'listr';

export default ({
  loadPage,
  createResourceDir,
  getLoadResourcesPromisesWithURLs,
  savePage,
  getSaveResourcesPromisesWithPaths,
  errorHandler,
}) => {
  const tasks = new Listr([
    {
      title: 'Loading page',
      task: loadPage,
    },
    {
      title: 'Creating resource directory',
      task: createResourceDir,
    },
    {
      title: 'Loading local resources',
      task: () => {
        const loadResourcesTasks = getLoadResourcesPromisesWithURLs().map(
          ({ dlLink, loadPromise }) => ({
            title: `Loading ${dlLink}`,
            task: () => loadPromise,
          }),
        );
        return new Listr(loadResourcesTasks, { concurrent: true });
      },
    },
    {
      title: 'Saving page',
      task: savePage,
    },
    {
      title: 'Saving resource files',
      task: () => {
        const saveResourcesTasks = getSaveResourcesPromisesWithPaths().map(
          ({ filePath, savePromise }) => ({
            title: `Saving ${filePath}`,
            task: () => savePromise,
          }),
        );
        return new Listr(saveResourcesTasks, { concurrent: true });
      },
    },
  ]);
  return tasks.run().catch(errorHandler);
};
