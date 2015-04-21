var os = require('os');
var path = require('path');
var fs = require('fs');
var builder = require('xmlbuilder');

var CruiseControlReporter = function(baseReporterDecorator, config, logger, helper, formatError){
    var allMessages = [];
    this.adapters = [function(msg) {
        allMessages.push(msg);
    }];
    this.onRunStart = function(browsers){

    };

    this.onBrowserStart = function(browser){

    };

    this.onBrowserComplete = function(browser){

    };

    this.onRunComplete = function(){

    };

    this.specSuccess = this.specSkipped = this.specFailure = function(browser, result){

    };

    this.onExit = function(done) {
    };
};

CruiseControlReporter.$inject = ['baseReporterDecorator', 'config', 'logger', 'helper', 'formatError'];

// PUBLISH DI MODULE
module.exports = {
    'reporters:cruisecontrol' : ['type', CruiseControlReporter]
};
