var os = require('os');
var path = require('path');
var fs = require('fs');
var builder = require('xmlbuilder');

var CruiseControlReporter = function(baseReporterDecorator, config, logger, helper, formatError){
    // boilerplate reporter code
  var log = logger.create('reporter.cruisecontrol');
  var reporterConfig = config.ccreporter || {};
  var pkgName = reporterConfig.suite || 'Karma Results';
  var namespace = reporterConfig.namespace || "Unspecified";
  var outputFile = helper.normalizeWinPath(path.resolve(config.basePath, reporterConfig.outputFile
      || 'test-results.xml'));
  
  var xml;
  var browserSuites;
  var assemblySuites;
  var namespaceSuites;
  var textFixtures = {};
  var textFixtureResults = {};
  var textFixtureTimings = {};
  var results;
  var pendingFileWritings = 0;
  var fileWritingFinished = function() {};
  var allMessages = [];
  var totalSuccess = 0;
  var totalFailures = 0;
  var totalSkipped = 0;
    
  baseReporterDecorator(this);
  
  this.adapters = [function(msg) {
      allMessages.push(msg);
  }];

	var initializeXmlForBrowser = function(browser) {
    browserSuites[browser.id] = xml.ele('test-suite', {
      name: browser.name,
      type: "Test Project"
    });
    assemblySuites[browser.id] = browserSuites[browser.id].ele('results').ele('test-suite', {
      name: "PlaceholderAssembly",
      type: "Assembly"
    })
    namespaceSuites[browser.id] = assemblySuites[browser.id].ele('results').ele('test-suite', {
      name: namespace,
      type: "Namespace"
    });
    results[browser.id] = namespaceSuites[browser.id] .ele('results');
	};

  var updateSuiteForResult = function(result, suite){
    suite.att('executed', !result.skipped);
    suite.att('result', (result.failed) ? 'Failure' : 'Success');
    suite.att('time', (result.netTime || 0) / 1000);
  };
  
  // the interface methods
  this.onRunStart = function(browsers){
    browserSuites = Object.create(null);
    assemblySuites = Object.create(null);
    namespaceSuites = Object.create(null);
    testFixtures = Object.create(null);
    testFixtureResults = Object.create(null);
    testFixtureTimings = Object.create(null);
    results = Object.create(null);
    
    // create root node.
    xml = builder.create('test-results');
    xml.att('name', pkgName)

    // initialize time and date
    var d = new Date();
    var date = d.toISOString().substr(0, 10);
    var time = d.toISOString().substr(11, 8);
    xml.att('date', date);
    xml.att('time', time);

    // required attr we don't have data for
    xml.att('invalid', 0);
    xml.att('ignored', 0);
    xml.att('inconclusive', 0);
    xml.att('not-run', 0);
    xml.att('errors', 0);

    xml.ele('environment', {
      'nunit-version': 'na', 
      'clr-version': 'na', 
      'os-version': os.release(),
      platform: os.platform(), 
      cwd: config.basePath, 
      user: 'na', 
      'user-domain': 'na',
      'machine-name': os.hostname()
    });

    xml.ele('culture-info', { 'current-culture': 'na', 'current-uiculture': 'na' });

    // TODO(vojta): remove once we don't care about Karma 0.10
    browsers.forEach(initializeXmlForBrowser);
  };

  this.onBrowserStart = function(browser){
    initializeXmlForBrowser(browser);
  };

  this.onBrowserComplete = function(browser){
    var suite = browserSuites[browser.id];

    if (!suite) {
      // This browser did not signal `onBrowserStart`. That happens
      // if the browser timed out during the start phase.
      return;
    }
    
    var result = browser.lastResult;
    updateSuiteForResult(result, suite);
    updateSuiteForResult(result, assemblySuites[browser.id]);
    updateSuiteForResult(result, namespaceSuites[browser.id]);
    
    // Update root node.
    totalSuccess = totalSuccess + result.total;
    totalFailures = totalFailures + result.failed;
    xml.att('total', totalSuccess);
    xml.att('failures', totalFailures);
    xml.att('skipped', totalSkipped);
  };

  this.onRunComplete = function(){
    var xmlToOutput = xml;
    pendingFileWritings++;
    helper.mkdirIfNotExists(path.dirname(outputFile), function() {
      fs.writeFile(outputFile, xmlToOutput.end({pretty: true}), function(err) {
        if (err) {
          log.warn('Cannot write NUnit xml\n\t' + err.message);
        } else {
          log.debug('NUnit results written to "%s".', outputFile);
        }

        if (!--pendingFileWritings) {
          fileWritingFinished();
        }
      });
    });

    browserSuites = xml = null;
    allMessages.length = 0;
  };

  this.specSuccess = this.specSkipped = this.specFailure = function(browser, result){
    // Create test fixture element if not there already
    var fixture;
    var fixtureResults;
    var suiteName = result.suite[0];
    if (!(suiteName in testFixtures)){
      testFixtures[suiteName] = results[browser.id].ele('test-suite', {
        'name': suiteName,
        'type': 'TestFixture',
        'executed' : true,
        'result' : 'Success',
        'time' : 0
      });
      testFixtureResults[suiteName] = testFixtures[suiteName].ele('results');
      testFixtureTimings[suiteName] = 0;
    }
    fixture = testFixtures[suiteName];
    fixtureResults = testFixtureResults[suiteName];
    
    // Initialize test case
    var elapsed = ((result.time || 0) / 1000);
    var spec = fixtureResults.ele('test-case', {
      name: result.description, 
      time: elapsed,
      description: (pkgName ? pkgName + ' ' : '') + browser.name + '.' + result.suite.join(' ').replace(/\./g, '_'),
      executed: result.skipped ? 'False' : 'True',
      success: (result.success || result.skipped) ? 'True' : 'False', // Skipped tests are successful
      result: (result.success || result.skipped) ? 'Success' : 'Failure'
    });

    if (result.skipped) {
      totalSkipped++;
      fixture.att('executed', false);
    }

    if (!result.success && !result.skipped) {
        var failure = spec.ele('failure');
        failure.ele('message').dat(result.log);
        failure.ele('stack-trace').dat(result.suite + ' ' + result.description);
        fixture.att('result', 'Failure');
    }
    
    var currentTime = testFixtureTimings[suiteName];
    fixture.att('time',  currentTime + elapsed);
    testFixtureTimings[suiteName] = currentTime + elapsed;
  };

  this.onExit = function(done) {
      if (pendingFileWritings) {
          fileWritingFinished = done;
      } else { 
          done();
      }
  };
};

CruiseControlReporter.$inject = ['baseReporterDecorator', 'config', 'logger', 'helper', 'formatError'];

// PUBLISH DI MODULE
module.exports = {
  'reporter:cruisecontrol' : ['type', CruiseControlReporter]
};
