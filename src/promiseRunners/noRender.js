export default ({
  loadPage,
  createResourceDir,
  generateDownloadResourcesPromisesWithInfo,
  savePage,
  errorHandler,
}) => {
  const getDownloadPromises = () => generateDownloadResourcesPromisesWithInfo()
    .map(({ downloadPromise }) => downloadPromise);

  return loadPage()
    .then(createResourceDir)
    .then(savePage)
    .then(() => Promise.all(getDownloadPromises()))
    .catch(errorHandler);
};
