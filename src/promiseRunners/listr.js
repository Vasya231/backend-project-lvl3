import Listr from 'listr';

export default ({
  loadPage,
  createResourceDir,
  getDownloadResourcesPromisesWithURLs,
  savePage,
  errorHandler,
}) => {
  const tasks = new Listr([
    {
      title: 'Loading page',
      task: () => loadPage().catch(errorHandler),
    },
    {
      title: 'Creating resource directory',
      task: () => createResourceDir().catch(errorHandler),
    },
    {
      title: 'Downloading local resources',
      task: () => {
        const downloadResourcesTasks = getDownloadResourcesPromisesWithURLs().map(
          ({ dlLink, resourceFilePath, downloadPromise }) => ({
            title: `Downloading ${dlLink} to ${resourceFilePath}`,
            task: () => downloadPromise.catch(errorHandler),
          }),
        );
        return new Listr(downloadResourcesTasks, { concurrent: true, exitOnError: false });
      },
    },
    {
      title: 'Saving page',
      task: () => savePage().catch(errorHandler),
    },
  ]);
  return tasks.run();
};
