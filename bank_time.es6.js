var settings = require('./settings.json');

var MongoClient = require('mongodb').MongoClient;
var assert = require('assert');
var _ = require('underscore');
var importUrl = 'http://api.mixpanel.com/import/';
var engageUrl = 'http://api.mixpanel.com/engage/';
var request = require('request');
var moment = require('moment');

var createRequest = function(db, cb) {
  var tasks = db.collection('tasks');
  tasks.find({}).each(function(err2, task) {
    assert.equal(null, err2);
    if (task) {
      var data = {
        "event" : "Create Request",
        "properties" : {
          "distinct_id" : task.requestorId,
          "taskId" : task._id,
          "taskTitle" : task.title,
          "time" : task.createdAt,
          "token" : settings.token
        }
      };
      var base64Data = new Buffer(JSON.stringify(data)).toString('base64');
      var url = importUrl + '?data=' + base64Data + '&api_key=' + settings.apiKey;
      request(url, function(error, response, body) {
        if (!error && response.statusCode == 200) {
          if (body === '0') {
            console.log(task.title + " failed to create");
          } else {
            console.log(task.title + " succeed in create");
          }
        } else {
          console.log(JSON.stringify(error));
        }
      });

      _.each(task.steps, function(step) {
        _.each(step.durations, function(duration) {
          var bankTimeData = {
            "event" : "Bank Time",
            "properties" : {
              "distinct_id" : task.requestorId,
              "taskId" : task._id,
              "taskTitle" : task.title,
              "time" : duration.date,
              "minutesAdded" : Math.ceil(duration.value / 1000 / 60),
              "token" : settings.token
            }
          };
          var base64BankTimeData = new Buffer(JSON.stringify(bankTimeData)).toString('base64');

          var bankTimeUrl = importUrl + '?data=' + base64BankTimeData + '&api_key=' + settings.apiKey;
          request(bankTimeUrl, function(error, response, body) {
            if (!error && response.statusCode == 200) {
              if (body === '0') {
                console.log(task.title + " failed to bank time");
              } else {
                console.log(task.title + " succeed in bank time");
              }
            } else {
              console.log(JSON.stringify(error));
            }
          });
        });
      });

    } else {
      cb();
    }

  });
};
MongoClient.connect(settings.dbUrl, function(err, db) {
  assert.equal(null, err);
  createRequest(db, function() {
    db.close();
  });
});
