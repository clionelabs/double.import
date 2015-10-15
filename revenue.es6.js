var settings = require('./settings.json');

var MongoClient = require('mongodb').MongoClient;
var assert = require('assert');
var _ = require('underscore');
var importUrl = 'http://api.mixpanel.com/import/';
var engageUrl = 'http://api.mixpanel.com/engage/';
var request = require('request');
var moment = require('moment');

var Invoice = {
  ProtoType: {
    roundedInSecondTotalDuration() {
      //round up to nearest second
      return _.reduce(this.timeBasedItems, function (memo, timeBasedItem) {
        return memo + timeBasedItem.roundedInSecondTotalDuration();
      }, 0);
    },
    totalAdjustedDuration() {
      //round up to nearest second
      return _.reduce(this.adjustments, function (memo, adjustment) {
        return memo + adjustment.duration;
      }, 0);
    },
    timePayable() {
      return Math.max(0, ( this.roundedInSecondTotalDuration() - this.credit + this.totalAdjustedDuration() ));
    },
    minutePayable() {
      return this.timePayable() / 1000 / 60;
    },
    timeBasedItemsTotal() {
      return this.minutePayable() * this.effectiveRate;
    },
    oneTimePurchasesTotal() {
      return _.reduce(this.oneTimePurchases, (memo, oneTimePurchase) => {
        return memo + oneTimePurchase.amount;
      }, 0);
    },
    isEditable() {
      return this.isStatic !== undefined ? false : this.status === Invoice.Status.Draft;
    },
    oneTimePurchaseIsRevenueTotal() {
      return _.reduce(this.oneTimePurchases, (memo, oneTimePurchase) => {
        return memo + (oneTimePurchase.isOnBehalf ? 0 : oneTimePurchase.amount);
      }, 0);
    },
    revenue() {
      return this.timeBasedItemsTotal() + this.oneTimePurchaseIsRevenueTotal();
    },
    debit() {
      return this.timeBasedItemsTotal() + this.oneTimePurchasesTotal();
    }
  },
  TimeBasedItem : {
    ProtoType: {
      roundedInSecondTotalDuration() {
        return Math.ceil(this.totalDuration / 1000) * 1000;
      }
    }
  }
};

var charge = (db, cb) => {
  var invoices = db.collection('invoices');
  invoices.find({'status' : 'charged' }).each(function(err2, invoice) {
    if (invoice) {
      _.extend(invoice, Invoice.ProtoType);
      if (invoice.timeBasedItems && invoice.timeBasedItems.length !== 0) {
        _.each(invoice.timeBasedItems, function (timeBasedItem) {
          _.extend(timeBasedItem, Invoice.TimeBasedItem.ProtoType);
        });
      }

      var increaseRevenueData = {
        "$append": {
          "$transactions": {
            "$time": moment(invoice.to).format('YYYY-MM-DDTHH:mm:ss'),
            "$amount": invoice.revenue()
          }
        },
        "$token" : settings.token,
        "$distinct_id" : invoice.customerId
      };

      var base64IncreaseRevenueData = new Buffer(JSON.stringify(increaseRevenueData)).toString('base64');

      var increaseRevenueUrl = engageUrl + '?data=' + base64IncreaseRevenueData + '&api_key=' + settings.apiKey;
      request(increaseRevenueUrl, function (error, response, body) {
        if (!error && response.statusCode == 200) {
          if (body === '0') {
            console.log(invoice._id + " failed to increase revenue");
          } else {
            console.log(invoice._id + " succeed in increase revenue");
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
  charge(db, function() {
    db.close();
  });
});
