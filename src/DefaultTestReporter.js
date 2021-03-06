/**
 * Copyright (c) 2014, Facebook, Inc. All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree. An additional grant
 * of patent rights can be found in the PATENTS file in the same directory.
 */
'use strict';

var colors = require('./lib/colors');
var formatFailureMessage = require('./lib/utils').formatFailureMessage;
var formatMsg = require('./lib/utils').formatMsg;
var path = require('path');
var VerboseLogger = require('./lib/testLogger');

var FAIL_COLOR = colors.RED_BG + colors.BOLD;
var PASS_COLOR = colors.GREEN_BG + colors.BOLD;
var TEST_NAME_COLOR = colors.BOLD;

function DefaultTestReporter(customProcess) {
  this._process = customProcess || process;
}

DefaultTestReporter.prototype.log = function(str) {
  this._process.stdout.write(str + '\n');
};

DefaultTestReporter.prototype.onRunStart =
function(config, aggregatedResults) {
  this._config = config;
  this._printWaitingOn(aggregatedResults);
  if (this._config.verbose) {
    var verboseLogger = new VerboseLogger(this._config, this._process);
    this.verboseLog = verboseLogger.verboseLog.bind(verboseLogger);
  }
};

DefaultTestReporter.prototype.onTestResult =
function(config, testResult, aggregatedResults) {
  this._clearWaitingOn();

  var pathStr =
    config.rootDir
    ? path.relative(config.rootDir, testResult.testFilePath)
    : testResult.testFilePath;
  var allTestsPassed = testResult.numFailingTests === 0;
  var testRunTime =
    testResult.perfStats
    ? (testResult.perfStats.end - testResult.perfStats.start) / 1000
    : null;

  var testRunTimeString;
  if (testRunTime !== null) {
    testRunTimeString = '(' + testRunTime + 's)';
    if (testRunTime > 2.5) {
      testRunTimeString = this._formatMsg(testRunTimeString, FAIL_COLOR);
    }
  }

  var resultHeader = this._getResultHeader(allTestsPassed, pathStr, [
    testRunTimeString
  ]);

  /*
  if (config.collectCoverage) {
    // TODO: Find a nice pretty way to print this out
  }
  */

  this.log(resultHeader);
  if (config.verbose) {
    this.verboseLog(testResult.testResults, resultHeader);
  }

  if (!allTestsPassed) {
    var failureMessage = formatFailureMessage(testResult, {
      rootPath: config.rootDir,
      useColor: !config.noHighlight,
    });
    if (config.verbose) {
      aggregatedResults.postSuiteHeaders.push(
        resultHeader,
        failureMessage
      );
    } else {
      // If we write more than one character at a time it is possible that iojs
      // exits in the middle of printing the result.
      // If you are reading this and you are from the future, this might not
      // be true any more.
      for (var i = 0; i < failureMessage.length; i++) {
        this._process.stdout.write(failureMessage.charAt(i));
      }
      this._process.stdout.write('\n');
    }

    if (config.bail) {
      this.onRunComplete(config, aggregatedResults);
      this._process.exit(0);
    }
  }

  this._printWaitingOn(aggregatedResults);
};

DefaultTestReporter.prototype.onRunComplete =
function (config, aggregatedResults) {
  var numFailedTests = aggregatedResults.numFailedTests;
  var numPassedTests = aggregatedResults.numPassedTests;
  var numTotalTests = aggregatedResults.numTotalTests;
  var runTime = (Date.now() - aggregatedResults.startTime) / 1000;

  if (numTotalTests === 0) {
    return;
  }

  if (config.verbose) {
    if (aggregatedResults.postSuiteHeaders.length > 0) {
      this.log(aggregatedResults.postSuiteHeaders.join('\n'));
    }
  }

  var results = '';
  if (numFailedTests) {
    results += this._formatMsg(
      numFailedTests + ' test' + (numFailedTests === 1 ? '' : 's') + ' failed',
      colors.RED + colors.BOLD
    );
    results += ', ';
  }
  results += this._formatMsg(
    numPassedTests + ' test' + (numPassedTests === 1 ? '' : 's') + ' passed',
    colors.GREEN + colors.BOLD
  );

  var pluralTestSuites =
      aggregatedResults.numTotalTestSuites === 1 ?
      'test suite' : 'test suites';

  results += ' (' + numTotalTests + ' total in ' +
    aggregatedResults.numTotalTestSuites + ' ' +
    pluralTestSuites + ', run time ' + runTime + 's)';

  this.log(results);
};

DefaultTestReporter.prototype._clearWaitingOn = function() {
  // Don't write special chars in noHighlight mode
  // to get clean output for logs.
  var command = this._config.noHighlight
    ? '\n'
    : '\r\x1B[K';
  this._process.stdout.write(command);
};

DefaultTestReporter.prototype._formatMsg = function(msg, color) {
  return formatMsg(msg, color, this._config);
};

DefaultTestReporter.prototype._getResultHeader =
function (passed, testName, columns) {
  var passFailTag = passed
    ? this._formatMsg(' PASS ', PASS_COLOR)
    : this._formatMsg(' FAIL ', FAIL_COLOR);

  return [
    passFailTag,
    this._formatMsg(testName, TEST_NAME_COLOR)
  ].concat(columns || []).join(' ');
};

DefaultTestReporter.prototype._printWaitingOn = function(aggregatedResults) {
  var completedTestSuites =
    aggregatedResults.numPassedTestSuites +
    aggregatedResults.numFailedTestSuites;
  var remainingTestSuites =
    aggregatedResults.numTotalTestSuites -
    completedTestSuites;
  if (remainingTestSuites > 0) {
    var pluralTestSuites =
      remainingTestSuites === 1 ? 'test suite' : 'test suites';
    this._process.stdout.write(
      this._formatMsg(
        'Running ' + remainingTestSuites + ' ' + pluralTestSuites + '...',
        colors.GRAY + colors.BOLD
      )
    );
  }
};

module.exports = DefaultTestReporter;
