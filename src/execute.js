export default ({
  loadPage,
  createResourceDir,
  getLoadResourcesPromisesWithURLs,
  savePage,
  getSaveResourcesPromisesWithPaths,
  errorHandler,
}) => {
  const getLoadPromises = () => getLoadResourcesPromisesWithURLs()
    .map(({ loadPromise }) => loadPromise);
  const getSavePromises = () => getSaveResourcesPromisesWithPaths()
    .map(({ savePromise }) => savePromise);

  return loadPage()
    .then(() => Promise.all(getLoadPromises()))
    .then(createResourceDir)
    .then(savePage)
    .then(() => Promise.all(getSavePromises()))
    .catch(errorHandler);
};
