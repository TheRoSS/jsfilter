/**
 * JsonFilterOperator class
 * @author Alexey Chistyakov <ross@newmail.ru>
 */
var util = require("util");
var common = require("./common");
var getContextValue = common.getContextValue;
var JsonFilterError = common.JsonFilterError;

var REGEX_NAME = /^\$\w+$/;
var REGEX_RE = /^\/(.*)\/(\w*)$/;
var OPERAND_TYPES = ["array", "regex", "value", "operator", "context"];

/**
 * @class JsonFilterOperator
 * @param {string} name Operator's name
 * @param {string} operandsType Type of operand from enum OPERAND_TYPES
 * @param {number} operandsCountMin Minimum number of operands for operandsType 'array'
 * @param {number} operandsCountMax Maximum number of operands for operandsType 'array'
 * @param {function} match Function with arguments (context, operand, document, operators)
 * @returns {*}
 * @constructor
 */
function JsonFilterOperator(name, operandsType, operandsCountMin, operandsCountMax, match) {
    if (name[0] != '$') {
        throw new JsonFilterError("Filter operator name should begin with symbol $: " + name);
    }

    /*jslint evil: true */
    var f = Function("return function "+name+"() {return arguments.callee.match.apply(arguments.callee, arguments)}")();

    Object.setPrototypeOf(f, JsonFilterOperator.prototype);

    //f.name = name;
    f.operandsType = operandsType;
    f.operandsCountMin = operandsCountMin;
    f.operandsCountMax = operandsCountMax;
    f.rightHanded = false;
    f.match = match;

    return f;
}

JsonFilterOperator.prototype.toString = inspect;
JsonFilterOperator.prototype.inspect = inspect;

/**
 * Parses operand to construct operator
 * @param {*} operand
 * @param {function} parse Function with arguments (operand, operators)
 * @param {array.<JsonFilterOperator>} operators List of available operators
 * @returns {*}
 */
JsonFilterOperator.prototype.parse = function (operand, parse, operators) {
    switch (this.operandsType) {
        case "array":
            if (!Array.isArray(operand)) {
                throw new JsonFilterError(util.format("JsonFilterOperator.parse: %s expects array, got: ", this.name, operand));
            }
            if (this.operandsCountMin && operand.length < this.operandsCountMin) {
                throw new JsonFilterError(util.format("%s expects minimum %d arguments, got %d:",
                    this.name, this.operandsCountMin, operand.length, operand));
            }
            if (this.operandsCountMax && operand.length > this.operandsCountMax) {
                throw new JsonFilterError(util.format("%s expects maximum %d arguments, got %d:",
                    this.name, this.operandsCountMax, operand.length, operand));
            }

            var parts = [];

            for (var i = 0; i < operand.length; i++) {
                parts[i] = parse(operand[i], operators);
            }

            return parts;

        case "regex":
            var pattern, flags;
            if (typeof operand == "string") {
                var match = operand.match(REGEX_RE);
                if (match) {
                    pattern = match[1];
                    flags = match[2];
                } else {
                    pattern = operand;
                }
            } else {
                pattern = parse(operand, operators);
            }
            return new RegExp(pattern, flags);

        case "operator":    // $not
            if (typeof operand != "object") {
                operand = {$eq: operand};
            }

            operand = parse(operand, operators);
            if (operand.operator.rightHanded && !this.rightHanded) {
                operand = {$eq: operand};
            }

            return parse(operand, operators, true);

        case "context":
            if (typeof operand != "string") {
                throw new JsonFilterError(util.format("%s expects string operand, got:", this.name, operand));
            }

            return operand;

        default:
            return parse(operand, operators);
    }
};

/**
 * Creates filter operator from data object (generally loaded from db)
 * @param {object} data
 * @returns {JsonFilterOperator}
 * @static
 */
JsonFilterOperator.create = function (data) {
    if (!data.name || !data.name.match(REGEX_NAME)) {
        throw new JsonFilterError(util.format("Incorrect selector name format: '%s'", data.name));
    }

    if (OPERAND_TYPES.indexOf(data.operandsType) == -1) {
        throw new JsonFilterError("JsonFilterOperator.operandsType, unknown type: " + data.operandsType);
    }

    var operandsCountMin = parseInt(data.operandsCountMin, 10);
    var operandsCountMax = parseInt(data.operandsCountMax, 10);

    /*jslint evil: true */
    var match = new Function("context", "operand", "document", "operators", data.match);

    return new JsonFilterOperator(data.name, data.operandsType, operandsCountMin, operandsCountMax, match);
};

/**
 * Creates default set of operators
 * @param {object} [data] Object to load data from (default: JsonFilterOperator.defaults)
 * @returns {object} Default operators by its names
 * @static
 */
JsonFilterOperator.createDefaults = function (data) {
    var defaults = {};

    if (!data) {
        data = JsonFilterOperator.defaults;
    }

    for (var name in data) {
        if (data.hasOwnProperty(name)) {
            var opData = data[name];

            var operator = new JsonFilterOperator(
                name,
                opData.operandsType || "value",
                opData.operandsCountMin,
                opData.operandsCountMax,
                typeof opData == "function" ? opData : opData.match
            );

            if (opData.rightHanded) {
                operator.rightHanded = true;
            }

            defaults[operator.name] = operator;
        }
    }

    return defaults;
};

/**
 * Default set of rules to define inner operators
 * @type {object}
 * @static
 */
JsonFilterOperator.defaults = {
    $gt: function (context, operand) {
        return context > operand;
    },
    $gte: function (context, operand) {
        return context >= operand;
    },
    $lt: function (context, operand) {
        return context < operand;
    },
    $lte: function (context, operand) {
        return context <= operand;
    },
    $ne: function (context, operand, document,  operators) {
        return !operators.$eq(context, operand, document, operators);
    },
    $eq: function (context, operand, document, operators) {
        if (Array.isArray(operand)) {
            if (!Array.isArray(context)) {
                return false;
            }
            if (context.length != operand.length) {
                return false;
            }
            for (var i = 0; i < operand.length; i++) {
                if (!operators.$eq(context[i], operand[i], document, operators)) {
                    return false;
                }
            }
            return true;
        }

        if (operand && typeof operand == "object") {
            if (!context) {
                return false;
            }
            if (typeof context != "object") {
                return false;
            }
            for (var vKey in context) {
                if (context.hasOwnProperty(vKey) && !operand.hasOwnProperty(vKey)) {
                    return false;
                }
            }
            for (var oKey in operand) {
                if (operand.hasOwnProperty(oKey)) {
                    if (!context.hasOwnProperty(oKey)) {
                        return false;
                    }
                    if (!operators.$eq(context[oKey], operand[oKey], document, operators)) {
                        return false;
                    }
                }
            }
            return true;
        }

        return context == operand;
    },

    $mod: {
        operandsType: "array",
        operandsCountMin: 2,
        operandsCountMax: 2,
        match: function (context, operands) {
            return (context % operands[0]) === operands[1];
        }
    },
    $regex: {
        operandsType: "regex",
        match: function (context, re) {
            return typeof context == "string" && context.match(re) !== null;
        }
    },

    $exists: function (context, operand) {
        return (context !== undefined) == operand;
    },
    $empty: function (context, operand) {
        if (Array.isArray(context)) {
            return (context.length === 0) == operand;
        }

        if (typeof context == "object") {
            for (var key in context) {
                if (context.hasOwnProperty(key)) {
                    return !operand;
                }
            }

            return Boolean(operand);
        }

        if (typeof context == "string" && context === "0") {
            return Boolean(operand);
        }

        return Boolean(context) != operand;
    },

    $in: {
        operandsType: "array",
        operandsCountMin: 2,
        match: function (context, operands, document, operators) {
            if (!Array.isArray(context)) {
                context = [context];
            }
            for (var i = 0; i < operands.length; i++) {
                for (var k = 0; k < context.length; k++) {
                    if (operators.$eq(context[k], operands[i], document, operators)) {
                        return true;
                    }
                }
            }
            return false;
        }
    },
    $nin: {
        operandsType: "array",
        operandsCountMin: 2,
        match: function (context, operands, document, operators) {
            if (!Array.isArray(context)) {
                context = [context];
            }
            for (var i = 0; i < operands.length; i++) {
                for (var k = 0; k < context.length; k++) {
                    if (operators.$eq(context[k], operands[i], document, operators)) {
                        return false;
                    }
                }
            }
            return true;
        }
    },
    $all: {
        operandsType: "array",
        operandsCountMin: 2,
        match: function (context, operands, document, operators) {
            if (!Array.isArray(context)) {
                context = [context];
            }
            for (var k = 0; k < context.length; k++) {
                var found = false;
                for (var i = 0; i < operands.length; i++) {
                    if (operators.$eq(context[k], operands[i], document, operators)) {
                        found = true;
                        break;
                    }
                }
                if (!found) {
                    return false;
                }
            }
            return true;
        }
    },


    $val: {
        rightHanded: true,
        operandsType: "context",
        match: function (_, selector, document) {
            return getContextValue(selector, document);
        }
    },
    $round: {
        operandsType: "operator",
        match: function (context) {
            return Math.round(context);
        }
    },
    $floor: {
        operandsType: "operator",
        match: function (context) {
            return Math.floor(context);
        }
    },
    $ceil: {
        operandsType: "operator",
        match: function (context) {
            return Math.ceil(context);
        }
    },
    $roundRH: {
        rightHanded: true,
        operandsType: "context",
        match: function (_, selector, document) {
            return Math.round(getContextValue(selector, document));
        }
    },
    $floorRH: {
        rightHanded: true,
        operandsType: "context",
        match: function (_, selector, document) {
            return Math.floor(getContextValue(selector, document));
        }
    },
    $ceilRH: {
        rightHanded: true,
        operandsType: "context",
        match: function (_, selector, document) {
            return Math.ceil(getContextValue(selector, document));
        }
    },

    $not: {
        rightHanded: true,
        operandsType: "operator",
        match: function (context, operand) {
            return !operand;
        }
    },
    $ctxAnd: {
        operandsType: "array",
        operandsCountMin: 2,
        match: function (context, operands, document) {
            for (var i = 0; i < operands.length; i++) {
                if (!operands[i].match(context, document)) {
                    return false;
                }
            }
            return true;
        }
    },
    $ctxOr: {
        operandsType: "array",
        operandsCountMin: 2,
        match: function (context, operands, document) {
            for (var i = 0; i < operands.length; i++) {
                if (operands[i].match(context, document)) {
                    return true;
                }
            }
            return false;
        }
    },
    $and: {
        operandsType: "array",
        operandsCountMin: 2,
        match: function (context, operands, document) {
            for (var i = 0; i < operands.length; i++) {
                if (!operands[i].match(null, document)) {
                    return false;
                }
            }
            return true;
        }
    },
    $or: {
        operandsType: "array",
        operandsCountMin: 2,
        match: function (context, operands, document) {
            for (var i = 0; i < operands.length; i++) {
                if (operands[i].match(null, document)) {
                    return true;
                }
            }
            return false;
        }
    },
    $nor: {
        operandsType: "array",
        operandsCountMin: 2,
        match: function (context, operands, document) {
            for (var i = 0; i < operands.length; i++) {
                if (operands[i].match(null, document)) {
                    return false;
                }
            }
            return true;
        }
    },

    $sub: {
        match: function (context, operand, document) {
            var operandContext = getContextValue(operand.context, document);
            return context - operandContext;
        }
    }
};

function inspect() {
    return this.name;
}

module.exports = JsonFilterOperator;
