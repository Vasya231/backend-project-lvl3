export default ({
  loadPage,
  createResourceDir,
  getDownloadResourcesPromisesWithURLs,
  savePage,
  errorHandler,
}) => {
  const getDownloadPromises = () => getDownloadResourcesPromisesWithURLs()
    .map(({ downloadPromise }) => downloadPromise);

  return loadPage()
    .then(createResourceDir)
    .then(savePage)
    .then(() => Promise.all(getDownloadPromises()))
    .catch(errorHandler);
};
