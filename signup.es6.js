
var settings = require('./settings.json');

var MongoClient = require('mongodb').MongoClient;
var assert = require('assert');
var _ = require('underscore');
var importUrl = 'http://api.mixpanel.com/import/';
var engageUrl = 'http://api.mixpanel.com/engage/';
var request = require('request');
var moment = require('moment');

var signup = function(db, cb) {
  var importData = {};
  var users = db.collection('users');
  users.find({ roles : { $in : ['customer'] }}).each(function(err2, user) {
    assert.equal(null, err2);
    if (user) {
      var data = {
        "event" : "Sign up",
        "properties" : {
          "distinct_id" : user._id,
          "time" : user.createdAt,
          "token" : settings.token
        }
      };
      var base64Data = new Buffer(JSON.stringify(data)).toString('base64');
      var url = importUrl + '?data=' + base64Data + '&api_key=' + settings.apiKey;
      request(url, function(error, response, body) {
        if (!error && response.statusCode == 200) {
          if (body === '0') {
            console.log(user.emails[0].address + " failed to signup");
          } else {
            console.log(user.emails[0].address + " succeed in signup");
          }
        } else {
          console.log(JSON.stringify(error));
        }
      });

      var profileData = {
        "token" : settings.token,
        "$distinct_id" : user._id,
        "$set" : {
          "$email" : user.emails[0].address,
          "$first_name" : user.profile.firstname,
          "$last_name" : user.profile.lastname,
          "$name" : user.profile.firstname + " " + user.profile.lastname,
          "$created": user.createdAt
        }
      };
      var base64ProfileData = new Buffer(JSON.stringify(profileData)).toString('base64');
      var profileUrl = engageUrl + '?data=' + base64ProfileData;
      request(profileUrl, function(error, response, body) {
        if (!error && response.statusCode == 200) {
          if (body === '0\n') {
            console.log(user.emails[0].address + " failed to set profile");
          } else {
            console.log(user.emails[0].address + " succeed in set profile");
          }
        } else {
          console.log(JSON.stringify(error));
        }
      });
    } else {
      cb();
    }
  });
};
MongoClient.connect(settings.dbUrl, function(err, db) {
  assert.equal(null, err);
  signup(db, function() {
    db.close();
  });
});
