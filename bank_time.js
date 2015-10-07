var settings = require('./settings.json');

var MongoClient = require('mongodb').MongoClient;
var assert = require('assert');
var _ = require('underscore');
var importUrl = 'http://api.mixpanel.com/import/';
var engageUrl = 'http://api.mixpanel.com/engage/';
var request = require('request');

MongoClient.connect(settings.dbUrl, function(err, db) {
    assert.equal(null, err);
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
    signup(db, function() {
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
        createRequest(db, function() {
            db.close();
        })
    });
});
