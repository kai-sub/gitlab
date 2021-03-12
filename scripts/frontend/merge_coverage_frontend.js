const { sync } = require('glob');
const { createCoverageMap } = require('istanbul-lib-coverage');
const { createContext } = require('istanbul-lib-report');
const { create } = require('istanbul-reports');
const { resolve } = require('path');

const coverageMap = createCoverageMap();

const coverageDir = resolve(__dirname, '../../coverage-frontend');
const reportFiles = sync(`${coverageDir}/*/coverage-final.json`);

// Normalize coverage report generated by jest that has additional "data" key
// https://github.com/facebook/jest/issues/2418#issuecomment-423806659
const normalizeReport = (report) => {
  const normalizedReport = { ...report };
  Object.entries(normalizedReport).forEach(([k, v]) => {
    if (v.data) normalizedReport[k] = v.data;
  });
  return normalizedReport;
};

reportFiles
  .map((reportFile) => {
    // eslint-disable-next-line global-require, import/no-dynamic-require
    return require(reportFile);
  })
  .map(normalizeReport)
  .forEach((report) => coverageMap.merge(report));

const context = createContext({ coverageMap, dir: 'coverage-frontend' });

['json', 'lcov', 'text-summary', 'clover', 'cobertura'].forEach((reporter) => {
  create(reporter, {}).execute(context);
});
