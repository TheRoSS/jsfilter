/**
 *
 * @author Alexey Chistyakov <ross@newmail.ru>
 */
var util = require("util");
//var mysql = require("mysql2");
var moment = require("moment");
var expect = require("chai").expect;
var JsonFilter = require("../lib/JsonFilter");
var JsonFilterOperator = require("../lib/JsonFilterOperator");

var defaults = JsonFilterOperator.createDefaults();
defaults.$throw = new JsonFilterOperator("$throw", "value", null, null, function () {throw "aaaa";});

var config = {
    queueRoot: ".",
    metaDb: {
        hostname: "localhost",
        database: "stash",
        user: "root",
        password: ""
    }
};

describe("filters.parse", function () {
    describe("common", function () {
        it("should throw on incorrect json", function () {
            expect(JsonFilter.create.bind(null, "dddd")).to.throw(Error);
        });

        it("should throw on empty object", function () {
            var data = JSON.stringify({});
            expect(JsonFilter.create.bind(null, data)).to.throw(Error);
        });

        it("should throw on unknown operator $inn", function () {
            var data = JSON.stringify({
                "aa": {
                    $inn: {}
                }
            });

            expect(JsonFilter.create.bind(null, data)).to.throw(Error);
        });

        it("relative context is disabled, should throw", function () {
            var data = JSON.stringify({
                "user.weapon": {
                    type: "axe",
                    damage: {$gt: 10}
                }
            });

            expect(JsonFilter.create.bind(null, data)).to.throw(Error);
        });
    });

    describe("$in", function () {
        it("should throw if operand is not array", function () {
            var data = JSON.stringify({
                "aa": {
                    $in: {}
                }
            });

            expect(JsonFilter.create.bind(null, data, defaults)).to.throw(Error);
        });

        it("should throw if not enough operands", function () {
            var data = JSON.stringify({
                "aa": {
                    $in: ["ddd"]
                }
            });

            expect(JsonFilter.create.bind(null, data, defaults)).to.throw(Error);
        });
    });
});

describe("filters.match", function () {
    describe("10 < user.level < 20", function () {
        var filter;

        before(function () {
            filter = JsonFilter.create(JSON.stringify({
                "user.level": {
                    $gt: 10,
                    $lt: 20
                }
            }), defaults);
        });

        it("user.aaaa = 11 should NOT match", function () {
            expect(filter.match({user: {aaaa: 11}})).to.be.false;
        });
        it("user.level = 11 should be ok", function () {
            expect(filter.match({user: {level: 11}})).to.be.true;
        });
        it("user.level = 7 should NOT match", function () {
            expect(filter.match({user: {level: 7}})).to.be.false;
        });
    });

    describe("$in" , function () {
        it("explicit $in", function () {
            var filter = JsonFilter.create(JSON.stringify({
                "user.race": {
                    $in: ["elf", "ork"]
                }
            }), defaults);

            expect(filter.match({user: {race: "ork"}})).to.be.true;
            expect(filter.match({user: {race: "human"}})).to.be.false;
        });

        it("implicit $in", function () {
            var filter = JsonFilter.create(JSON.stringify({
                "user.race": ["elf", "ork"]
            }), defaults);

            expect(filter.match({user: {race: "ork"}})).to.be.true;
            expect(filter.match({user: {race: "human"}})).to.be.false;
        });
    });

    describe("inner operators", function () {
        it("should work for nested $and", function () {
            var filter = JsonFilter.create(JSON.stringify({
                $or: [
                    {
                        $and: [{
                            "user.sex": "male"
                        }, {
                            "user.class": "warrior"
                        }, {
                            "user.age": {$gte: 18}
                        }]
                    },
                    {
                        "user.level": {$gte: 40}
                    }
                ]
            }), defaults);
            var document1 = {
                user: {
                    "level": 40,
                    "class": "mage"
                }
            };
            var document2 = {
                user: {
                    "level": 39,
                    "class": "warrior",
                    "sex": "male",
                    "age": 21
                }
            };
            var document3 = {
                user: {
                    "level": 39,
                    "class": "warrior",
                    "sex": "male",
                    "age": 16
                }
            };
            var document4 = {
                user: {
                    "level": 39,
                    "class": "mage",
                    "sex": "male"
                }
            };
            expect(filter.match(document1)).to.be.true;
            expect(filter.match(document2)).to.be.true;
            expect(filter.match(document3)).to.be.false;
            expect(filter.match(document4)).to.be.false;
        });

        it("implicit $eq", function () {
            var filter = JsonFilter.create(JSON.stringify({
                "user.weapon": "axe"
            }), defaults);

            expect(filter.match({user: {weapon: "sword"}})).to.be.false;
            expect(filter.match({user: {weapon: "axe"}})).to.be.true;
        });

        it("context for implicit $and should pass", function () {
            var filter = JsonFilter.create(JSON.stringify({
                "user.level": {
                    $gt: 10,
                    $lt: 20
                }
            }), defaults);

            expect(filter.match({user: {level: 40}})).to.be.false;
            expect(filter.match({user: {level: 19}})).to.be.true;
        });

        it("context for explicit $and should not override internal commands context", function () {
            var filter = JsonFilter.create(JSON.stringify({
                "user.level": {
                    $gt: 20,
                    $and: [
                        {"user.age": {$gt: 14, $lt: 20}},
                        {"user.sex": "male"}
                    ]
                }
            }), defaults);

            var document1 = {
                user: {
                    level: 22,
                    age: 18,
                    sex: "male"
                }
            };
            var document2 = {
                user: {
                    level: 22,
                    age: 28,
                    sex: "male"
                }
            };

            expect(filter.match(document1)).to.be.true;
            expect(filter.match(document2)).to.be.false;
        });

        it("$val", function () {
            var filter = JsonFilter.create(JSON.stringify({
                "user.age": {
                    $gt: {
                        $val: "user.level"
                    }
                }
            }), defaults);

            expect(filter.match({user: {level: 23, age: 33}})).to.be.true;
            expect(filter.match({user: {level: 23, age: 13}})).to.be.false;
        });

        it("$val with implicit $eq", function () {
            var filter = JsonFilter.create(JSON.stringify({
                "user.age": {$val: "user.level"}
            }), defaults);

            expect(filter.match({user: {level: 23, age: 23}})).to.be.true;
            expect(filter.match({user: {level: 23, age: 13}})).to.be.false;
        });

        it("$empty", function () {
            var filter = JsonFilter.create(JSON.stringify({
                "xyz": {
                    $empty: true
                }
            }), defaults);

            expect(filter.match({})).to.be.true;
            expect(filter.match({xyz: null})).to.be.true;
            expect(filter.match({xyz: undefined})).to.be.true;
            expect(filter.match({xyz: 0})).to.be.true;
            expect(filter.match({xyz: ""})).to.be.true;
            expect(filter.match({xyz: "0"})).to.be.true;
            expect(filter.match({xyz: false})).to.be.true;
            expect(filter.match({xyz: []})).to.be.true;
            expect(filter.match({xyz: {}})).to.be.true;

            expect(filter.match({xyz: 1})).to.be.false;
            expect(filter.match({xyz: "null"})).to.be.false;
            expect(filter.match({xyz: "undefined"})).to.be.false;
            expect(filter.match({xyz: "false"})).to.be.false;
            expect(filter.match({xyz: true})).to.be.false;
            expect(filter.match({xyz: [0]})).to.be.false;
            expect(filter.match({xyz: {a: 1}})).to.be.false;
        });

        it("access to fields with dot in their name", function () {
            var data = '{"user.\\\\.add\\\\.com": "iddqd"}';
            var filter = JsonFilter.create(data, defaults);

            expect(filter.match({user: {".add.com": "iddqd"}})).to.be.true;
            expect(filter.match({user: {".add.com": "iddqd1111"}})).to.be.false;
            expect(filter.match({user: {add: {com: "iddqd"}}})).to.be.false;
            expect(filter.match({user: {"\\": {"add\\": {com: "iddqd"}}}})).to.be.false;
        });

        it("should not fall down on exception in match", function () {
            var filter = JsonFilter.create(JSON.stringify({
                "user": {
                    $throw: "aaaa"
                }
            }), defaults);

            expect(filter.match.bind(filter, {user: {level: 11}})).to.throw(Error);
        });

        it("$regex", function () {
            var filter = JsonFilter.create(JSON.stringify({
                "aaa": {
                    $regex: "baboon"
                }
            }), defaults);

            expect(filter.match({aaa: "baboon"})).to.be.true;
            expect(filter.match({aaa: "baboon has red ass"})).to.be.true;
            expect(filter.match({aaa: "i don't like baboons"})).to.be.true;
            expect(filter.match({aaa: "killdababoonsda"})).to.be.true;
            expect(filter.match({aaa: "babo4on"})).to.be.false;
        });
        it("$regex as RegExp", function () {
            var filter = JsonFilter.create(JSON.stringify({
                "aaa": {
                    $regex: "/baboon/i"
                }
            }), defaults);

            expect(filter.match({aaa: "baboon"})).to.be.true;
            expect(filter.match({aaa: "baBoon has red ass"})).to.be.true;
            expect(filter.match({aaa: "i don't like baboons"})).to.be.true;
            expect(filter.match({aaa: "killdababoonsda"})).to.be.true;
            expect(filter.match({aaa: "babo4on"})).to.be.false;
        });
        it("$regex $or $regex with context (implicit $ctxOr)", function () {
            var filter = JsonFilter.create(JSON.stringify({
                "aaa": [
                    {$regex: "/baboon/i"},
                    {$regex: "/monkey/i"}
                ]
            }), defaults);

            expect(filter.match({aaa: "There are Baboons in Africa"})).to.be.true;
            expect(filter.match({aaa: "There is a lonely Monkey by the Limpopo river"})).to.be.true;
            expect(filter.match({aaa: "All baboons are monkeys"})).to.be.true;
            expect(filter.match({aaa: "babo4on und makakas"})).to.be.false;
        });

        it("$not", function () {
            var filter = JsonFilter.create({
                "aaa": {
                    $not: {$lt: 5}
                }
            }, defaults);

            expect(filter.match({aaa: 10})).to.be.true;
            expect(filter.match({aaa: 5})).to.be.true;
            expect(filter.match({aaa: 1})).to.be.false;
        });

        it("$not $not", function () {
            var filter = JsonFilter.create({
                "aaa": {
                    $not: {$not: {$lt: 5}}
                }
            }, defaults);

            expect(filter.match({aaa: 10})).to.be.false;
            expect(filter.match({aaa: 5})).to.be.false;
            expect(filter.match({aaa: 1})).to.be.true;
        });

        it("$sub", function () {
            var filter = JsonFilter.create({
                "ts": {
                    $sub: {
                        "user.lastLoginTime": {$lt: 300}
                    }
                }
            }, defaults);

            expect(filter.match({ts: 1461764062, user: {lastLoginTime: 1461763862}})).to.be.true;
            expect(filter.match({ts: 1461764062, user: {lastLoginTime: 1461763362}})).to.be.false;
            expect(filter.match({ts: 1461764062})).to.be.false;
            expect(filter.match({user: {lastLoginTime: 1461763362}})).to.be.false;
        });

        describe("$floor", function () {
            it("left-handed $floor with operator as operand", function () {
                var filter = JsonFilter.create({
                    "avg": {$floor: {$gt: 1}}
                }, defaults);

                expect(filter.match({avg: 2.89})).to.be.true;
                expect(filter.match({avg: 1.89})).to.be.false;
                expect(filter.match({avg: 0.89})).to.be.false;
            });
            it("left-handed $floor with value as operand", function () {
                var filter = JsonFilter.create({
                    "avg": {$floor: 1}
                }, defaults);

                expect(filter.match({avg: 2.89})).to.be.false;
                expect(filter.match({avg: 1.89})).to.be.true;
                expect(filter.match({avg: 0.89})).to.be.false;
            });
            it("right-handed $floor with explicit operator", function () {
                var filter = JsonFilter.create({
                    "tm": {
                        $gt: {$floorRH: "avg"}
                    }
                }, defaults);

                expect(filter.match({tm: 2, avg: 2.89})).to.be.false;
                expect(filter.match({tm: 2, avg: 1.89})).to.be.true;
            });
            it("right-handed $floor with implicit $eq", function () {
                var filter = JsonFilter.create({
                    "tm": {$floorRH: "avg"}
                }, defaults);

                expect(filter.match({tm: 1, avg: 2.89})).to.be.false;
                expect(filter.match({tm: 1, avg: 1.89})).to.be.true;
            });
            it("$floorRH used instead of $floor", function () {
                var data = {
                    "avg": {$floorRH: {$gt: 1}}
                };

                expect(JsonFilter.create.bind(null, data, defaults)).to.throw(Error);
            });
        });
    });

    describe("exported operators", function () {
        var defaults;

        before(function () {
            var exported = [{
                name: "$day",
                operandsType: "operator",
                match: "return context < 3600 ? 0 : Math.floor(context / 86400) + 1;"
            }, {
                name: "$daysAfterLogin",
                operandsType: "operator",
                match: "return document.user && document.user.lastLoginTime && Math.floor((document.ts - document.user.lastLoginTime) / 86400);"
            }, {
                name: "$daysAfterReg",
                operandsType: "operator",
                match: "if (!document.user || !document.user.registrationTime) {return;}var dt = document.ts - document.user.registrationTime;return dt < 3600 ? 0 :  Math.floor(dt / 86400) + 1;"
            }, {
                name: "$hoursAfterReg",
                operandsType: "operator",
                match: "return document.user && document.user.registrationTime && Math.floor((document.ts - document.user.registrationTime) / 3600);"
            }, {
                name: "$lastLoginWasNotToday",
                operandsType: "value",
                match: "return (operators.$startOfDay(document.ts) == operators.$startOfDay(document.user.lastLoginTime)) != operand;"
            }, {
                name: "$lastSessionWasNotToday",
                operandsType: "value",
                match: "return (operators.$startOfDay(document.ts) == operators.$startOfDay(document.user.lastSessionStart)) != operand;"
            }, {
                name: "$matchRetargetingGroup",
                operandsType: "value",
                match: "if (!document.info_refType || !document.user) {  return !operand;}var m = document.info_refType.match(/_retarg_(.*)$/);if(!m) {  return !operand;}var group = m[1];return (document.user.retargetingGroup == group) == operand;"
            }, {
                name: "$notRetainedDays",
                operandsType: "value",
                match: "if(!document.user || !document.user.lastLoginTime || !document.user.registrationTime) { return false;}var afterReg = operators.$day(document.ts - document.user.registrationTime);if(operand && afterReg > operand) {  return false;}var lastLoginAfterReg = operators.$day(document.user.lastLoginTime - document.user.registrationTime);if(afterReg === lastLoginAfterReg) {  return false;}return true;"
            }, {
                name: "$notRetainedHours",
                operandsType: "value",
                match: "if(!document.user || !document.user.lastLoginTime || !document.user.registrationTime) {  return false;}var afterReg = Math.floor((document.ts - document.user.registrationTime) / 3600) + 1;if(operand && afterReg > operand) {  return false;}var lastLoginAfterReg = Math.floor((document.user.lastLoginTime - document.user.registrationTime) / 3600) + 1;if(afterReg === lastLoginAfterReg) {  return false;}return true;"
            }, {
                name: "$notRetainedWeeks",
                operandsType: "value",
                match: "if(!document.user || !document.user.lastLoginTime || !document.user.registrationTime) {  return false;}if(operand) {  var afterRegWeek = operators.$week(document.ts - document.user.registrationTime);  if (afterRegWeek > operand) {    return false;  }}return operators.$day(document.ts - document.user.lastLoginTime) > 7;"
            }, {
                name: "$relevance",
                operandsType: "value",
                match: "if (!document.user || !document.user.registrationTime) {  return false;}var del = Math.floor(document.ts - document.user.registrationTime);if(del < 3600) {  return false;}var dar = Math.floor(del / 86400) + 1;return dar == operand;"
            }, {
                name: "$startOfDay",
                operandsType: "operator",
                match: "var ts = parseInt(context, 10);var tm = new Date(ts * 1000);tm.setHours(0, 0, 0, 0);return Math.round(Number(tm) / 1000);"
            }, {
                name: "$week",
                operandsType: "operator",
                match: "return context < 3600 ? 0 : Math.floor(context / 604800) + 1;"
            }];

            defaults = JsonFilterOperator.createDefaults();

            for (var i = 0; i < exported.length; i++) {
                defaults[exported[i].name] = JsonFilterOperator.create(exported[i]);
            }
        });

        it("$day -> [$eq]", function () {
            var filter =  JsonFilter.create({passed: {$day: 3}}, defaults);

            expect(filter.match({passed: 200000})).to.be.true;
            expect(filter.match({passed: 100000})).to.be.false;
        });
        it("$day -> $gt", function () {
            var filter =  JsonFilter.create({passed: {$day: {$gt: 2}}}, defaults);

            expect(filter.match({passed: 200000})).to.be.true;
            expect(filter.match({passed: 100000})).to.be.false;
        });
        it("$day -> $val", function () {
            var filter =  JsonFilter.create({passed: {$day: {$val: "days"}}}, defaults);

            expect(filter.match({passed: 200000, days: 3})).to.be.true;
            expect(filter.match({passed: 200000, days: 2})).to.be.false;
        });

        it("$week", function () {
            var filter =  JsonFilter.create({passed: {$week: {$gt: 2}}}, defaults);

            expect(filter.match({passed: 1500000})).to.be.true;
            expect(filter.match({passed: 1000000})).to.be.false;
        });

        it("$daysAfterLogin", function () {
            var filter =  JsonFilter.create({$daysAfterLogin: {$gt: 4}}, defaults);
            var document1 = {
                ts: moment("2016-01-22").unix(),
                user: {
                    lastLoginTime: moment("2016-01-12").unix()
                }
            };
            var document2 = {
                ts: moment("2016-01-14").unix(),
                user: {
                    lastLoginTime: moment("2016-01-12").unix()
                }
            };

            expect(filter.match(document1)).to.be.true;
            expect(filter.match(document2)).to.be.false;
        });

        it("$daysAfterReg", function () {
            var filter =  JsonFilter.create({$daysAfterReg: {$gt: 4}}, defaults);
            var document1 = {
                ts: moment("2016-01-22").unix(),
                user: {
                    registrationTime: moment("2016-01-12").unix()
                }
            };
            var document2 = {
                ts: moment("2016-01-14").unix(),
                user: {
                    registrationTime: moment("2016-01-12").unix()
                }
            };

            expect(filter.match(document1)).to.be.true;
            expect(filter.match(document2)).to.be.false;
        });

        it("$daysAfterReg:[] should be parsed to implicit $in, not $or", function () {
            var filter =  JsonFilter.create({$daysAfterReg: [7, 28]}, defaults);
            var document1 = {
                ts: moment("2016-01-18").unix(),
                user: {
                    registrationTime: moment("2016-01-12").unix()
                }
            };
            var document2 = {
                ts: moment("2016-01-22").unix(),
                user: {
                    registrationTime: moment("2016-01-12").unix()
                }
            };
            var document3 = {
                ts: moment("2016-02-08").unix(),
                user: {
                    registrationTime: moment("2016-01-12").unix()
                }
            };

            expect(filter.match(document1)).to.be.true;
            expect(filter.match(document2)).to.be.false;
            expect(filter.match(document3)).to.be.true;
        });

        it("$daysAfterReg the same day", function () {
            var filter =  JsonFilter.create({$daysAfterReg: {$lt: 2}}, defaults);
            var document1 = {
                ts: moment("2016-01-12 23:45").unix(),
                user: {
                    registrationTime: moment("2016-01-12 01:15").unix()
                }
            };
            var document2 = {
                ts: moment("2016-01-12 01:16").unix(),
                user: {
                    registrationTime: moment("2016-01-12 01:15").unix()
                }
            };
            var document3 = {
                ts: moment("2016-01-13 01:14").unix(),
                user: {
                    registrationTime: moment("2016-01-12 01:15").unix()
                }
            };
            var document4 = {
                ts: moment("2016-01-13 01:16").unix(),
                user: {
                    registrationTime: moment("2016-01-12 01:15").unix()
                }
            };

            expect(filter.match(document1)).to.be.true;
            expect(filter.match(document2)).to.be.true;
            expect(filter.match(document3)).to.be.true;
            expect(filter.match(document4)).to.be.false;
        });


        it("$startOfDay", function () {
            var ts1 = moment("2016-01-22").unix();
            var ts2 = moment("2016-01-22 09:30").unix();
            var ts3 = moment("2016-01-23 09:30").unix();
            var startOfDay = moment("2016-01-22 09:30").startOf("day").unix();

            var filter =  JsonFilter.create({ts: {$startOfDay: startOfDay}}, defaults);

            expect(filter.match({ts: ts1})).to.be.true;
            expect(filter.match({ts: ts2})).to.be.true;
            expect(filter.match({ts: ts3})).to.be.false;
        });

        it("$lastLoginWasNotToday", function () {
            var ts1 = moment("2016-01-22 09:30").unix();
            var ts2 = moment("2016-01-23 09:30").unix();
            var ts3 = moment("2016-01-23 19:30").unix();

            var filter =  JsonFilter.create({$lastLoginWasNotToday: true}, defaults);

            expect(filter.match({ts: ts3, user: {lastLoginTime: ts1}})).to.be.true;
            expect(filter.match({ts: ts3, user: {lastLoginTime: ts2}})).to.be.false;
        });

        it("$notRetainedDays", function () {
            var regTs = moment("2015-01-22 09:30").unix();
            var logTs1 = moment("2016-01-22 09:30").unix();
            var logTs2 = moment("2016-01-23 09:30").unix();
            var ts = moment("2016-01-23 19:30").unix();

            var filter =  JsonFilter.create({$notRetainedDays: 0}, defaults);
            var document1 = {
                ts: ts,
                user: {
                    lastLoginTime: logTs1,
                    registrationTime: regTs
                }
            };
            var document2 = {
                ts: ts,
                user: {
                    lastLoginTime: logTs2,
                    registrationTime: regTs
                }
            };

            expect(filter.match(document1)).to.be.true;
            expect(filter.match(document2)).to.be.false;
        });

        it("$notRetainedDays with expiring", function () {
            var regTs1 = moment("2015-01-22 09:30").unix();
            var regTs2 = moment("2015-11-22 09:30").unix();
            var logTs1 = moment("2016-01-22 09:30").unix();
            var logTs2 = moment("2016-01-23 09:30").unix();
            var ts = moment("2016-01-23 19:30").unix();

            var filter =  JsonFilter.create({$notRetainedDays: 100}, defaults);
            var document1 = {
                ts: ts,
                user: {
                    lastLoginTime: logTs1,
                    registrationTime: regTs1
                }
            };
            var document2 = {
                ts: ts,
                user: {
                    lastLoginTime: logTs2,
                    registrationTime: regTs1
                }
            };
            var document3 = {
                ts: ts,
                user: {
                    lastLoginTime: logTs1,
                    registrationTime: regTs2
                }
            };
            var document4 = {
                ts: ts,
                user: {
                    lastLoginTime: logTs2,
                    registrationTime: regTs2
                }
            };

            expect(filter.match(document1)).to.be.false;
            expect(filter.match(document2)).to.be.false;
            expect(filter.match(document3)).to.be.true;
            expect(filter.match(document4)).to.be.false;
        });

        it("$notRetainedWeeks", function () {
            var regTs  = moment("2015-01-22 09:30").unix();
            var ts1    = moment("2016-01-23 19:30").unix(); // afterReg: 366 days, diff.weeks: 52, $week: 53, $day: 367
            var ts2    = moment("2016-02-23 19:30").unix(); // afterReg: 397 days, diff.weeks: 56, $week: 57, $day: 398
            var logTs1 = moment("2016-01-02 09:30").unix(); // lastLoginAfterReg: 345 days, diff.weeks: 49, $week: 50, $day: 346
            var logTs2 = moment("2016-01-18 09:30").unix(); // lastLoginAfterReg: 361 days, diff.weeks: 51, $week: 52, $day: 362

            var filter =  JsonFilter.create({$notRetainedWeeks: 55}, defaults);
            var document1 = {
                ts: ts1,
                user: {
                    lastLoginTime: logTs1,
                    registrationTime: regTs
                }
            };
            var document2 = {
                ts: ts1,
                user: {
                    lastLoginTime: logTs2,
                    registrationTime: regTs
                }
            };
            var document3 = {
                ts: ts2,
                user: {
                    lastLoginTime: logTs1,
                    registrationTime: regTs
                }
            };

            expect(filter.match(document1)).to.be.true;
            expect(filter.match(document2)).to.be.false;
            expect(filter.match(document3)).to.be.false;
        });

        describe("query filters", function () {
            it("1164", function () {
                var ts = 1461764062.118;
                var filter = JsonFilter.create({
                    "user.registrationTime": {
                        "$empty": false,
                        "$ne": {"$floorRH": "ts"},
                        "$eq": {"$val": "user.lastLoginTime"}
                    },
                    "$hoursAfterReg": {
                        "$lte": 3
                    }
                }, defaults);

                // true
                expect(filter.match({
                    ts: ts,
                    user: {
                        registrationTime: 1461764000,
                        lastLoginTime: 1461764000
                    }
                })).to.be.true;

                // empty
                expect(filter.match({
                    ts: ts,
                    user: {}
                })).to.be.false;
                // $eq
                expect(filter.match({
                    ts: ts,
                    user: {
                        registrationTime: 1461764000,
                        lastLoginTime: 1461764001
                    }
                })).to.be.false;
                // $ne
                expect(filter.match({
                    ts: ts,
                    user: {
                        registrationTime: 1461764062,
                        lastLoginTime: 1461764062
                    }
                })).to.be.false;
                // $hoursAfterReg
                expect(filter.match({
                    ts: ts,
                    user: {
                        registrationTime: 1461744062,
                        lastLoginTime: 1461744062
                    }
                })).to.be.false;
            });

            it("1695", function () {
                var filter = JsonFilter.create(JSON.stringify({
                    "info_type": {"$ne": "supersonic"},
                    "$or": [{
                        "type": {"$ne": ".user.freePayment"}
                    }, {
                        "$not": {"info_type": {"$regex": "/tapjoy/i"}}
                    }]
                }), defaults);

                expect(filter.match({type: ".user.payment", info_type: "aaaa"})).to.be.true;
                expect(filter.match({type: ".user.payment", info_type: "tapjoy"})).to.be.true;
                expect(filter.match({type: ".user.payment", info_type: "TaPjoY"})).to.be.true;
                expect(filter.match({type: ".user.payment", info_type: "supersonic"})).to.be.false;
                expect(filter.match({type: ".user.freePayment", info_type: "aaaa"})).to.be.true;
                expect(filter.match({type: ".user.freePayment", info_type: "supersonic"})).to.be.false;
                expect(filter.match({type: ".user.freePayment", info_type: "tapjoy"})).to.be.false;
                expect(filter.match({type: ".user.freePayment", info_type: "  tApjoyUUUU"})).to.be.false;
            });
        });
    });
});
