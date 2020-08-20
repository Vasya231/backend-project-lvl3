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
      task: loadPage,
    },
    {
      title: 'Creating resource directory',
      task: createResourceDir,
    },
    {
      title: 'Downloading local resources',
      task: () => {
        const downloadResourcesTasks = getDownloadResourcesPromisesWithURLs().map(
          ({ dlLink, resourceFilePath, downloadPromise }) => ({
            title: `Downloading ${dlLink} to ${resourceFilePath}`,
            task: () => downloadPromise,
          }),
        );
        return new Listr(downloadResourcesTasks, { concurrent: true });
      },
    },
    {
      title: 'Saving page',
      task: savePage,
    },
  ]);
  return tasks.run().catch(errorHandler);
};
