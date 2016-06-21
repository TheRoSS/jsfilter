/**
 * JsonFilter class
 * @author Alexey Chistyakov <ross@newmail.ru>
 */
var util = require("util");
var common = require("./common");
var JsonFilterOperator = require("./JsonFilterOperator");
var getContextValue = common.getContextValue;
var JsonFilterError = common.JsonFilterError;

var defaults;

/**
 * @class JsonFilter
 * @param {string|null} context Dot-notation selector
 * @param {JsonFilterOperator} operator
 * @param {*} operand Operator's operand
 * @param {array.<JsonFilterOperator>} operators List of available operators to make them available inside operators bodies
 * @constructor
 */
function JsonFilter(context, operator, operand, operators) {
    this.context = context;
    this.operator = operator;
    this.operand = operand;

    Object.defineProperty(this, "operators", {
        value: operators
    });
}

/**
 * Match document against filter
 * Does not throw exceptions, instead logs to console.error and returns false
 * @param {*} [context] Calculated from selector or passed from other operator context
 * @param {object} document
 * @returns {boolean}
 */
JsonFilter.prototype.match = function (context, document) {
    if (!document) {
        document = context;
        context = null;
    }
    if (!context && this.context) {
        context = getContextValue(this.context, document);
    }

    try {
        if (this.operand instanceof JsonFilter) {
            if (this.operator.rightHanded || this.operand.operator.rightHanded) {    // $val
                var operand = this.operand.match(context, document);
                return this.operator.match(context, operand, document, this.operators);
            } else {                            // others
                context = this.operator.match(context, this.operand, document, this.operators);
                return this.operand.match(context, document);
            }
        } else {
            return this.operator.match(context, this.operand, document, this.operators);
        }
    } catch (e) {
        console.error("JsonFilter.match throws - operator:",
            this.operator,
            ", context:",
            context,
            ", operand:",
            this.operand,
            ",",
            e.stack
        );
        return false;
    }
};

/**
 * Creates filter from data object (generally loaded from db)
 * @param {string|object} data
 * @param {array.<JsonFilterOperator>} operators List of available operators
 * @returns {JsonFilter|null}
 * @static
 */
JsonFilter.create = function (data, operators) {
    var parsed;

    if (!data) {
        return null;
    }

    if (operators === undefined) {
        operators = JsonFilter.getDefaults();
    }

    // string -> object
    if (typeof data == "string") {
        data = data.trim();
        if (data) {
            if (data[0] != "{" && data[0] != "[") {
                data = "{" + data + "}";
            }

            parsed = JSON.parse(data);
        }

    } else if (typeof data == "object") {
        parsed = data;

    } else {
        throw new JsonFilterError("Unknown data type: ", util.inspect(data));
    }

    return JsonFilter.parse(parsed, operators);
};

/**
 * Parses input value 'operand' and creates JsonFilter
 * Do not use this method to create filters. Use 'create' instead
 * @param {*} operand
 * @param {array.<JsonFilterOperator>} operators
 * @param {boolean} contextDisabled Used for operators where no context is expected
 * @returns {*}
 * @static
 */
JsonFilter.parse = function (operand, operators, contextDisabled) {
    if (!operand || typeof operand != "object" || operand instanceof JsonFilter) {
        return operand;
    }

    // converting implicit $or to explicit form
    if (Array.isArray(operand)) {
        operand = {$or: operand};
    }

    var parts = [];

    for (var key in operand) {
        if (!operand.hasOwnProperty(key)) {
            continue;
        }

        var part, parsedOperand;

        var operator = operators[key];
        if (operator) {         // logical operators (context inherited)
            parsedOperand = operator.parse(operand[key], JsonFilter.parse, operators);
            part = new JsonFilter(null, operator, parsedOperand, operators);

        } else {                // context operators (context = key)
            if (contextDisabled) {
                throw new JsonFilterError("Incorrect context placement: " + key);
            }

            var inner = operand[key];


            // implicit $in (if you need objects and arrays comparison, use $eq operator)
            if (Array.isArray(inner)) {
                if (typeof inner[0] == "object") {
                    inner = {$ctxOr: inner};
                } else {
                    inner = {$in: inner};
                }
            }

            // just a value
            if (!inner || typeof inner != "object") {
                inner = {$eq: inner};
            }

            // context operators
            var innerParts = [];
            for (var innerKey in inner) {
                if (inner.hasOwnProperty(innerKey)) {
                    var innerOperator = operators[innerKey];
                    if (!innerOperator) {
                        throw new JsonFilterError("No such operator: " + innerKey);
                    }

                    var innerOperand = inner[innerKey];
                    if (innerOperator.rightHanded && innerOperator.operandsType == "context") {
                        innerOperand = {};
                        innerOperand[innerKey] = inner[innerKey];
                        innerOperator = operators.$eq;

                    }

                    parsedOperand = innerOperator.parse(innerOperand, JsonFilter.parse, operators);
                    innerParts.push(new JsonFilter(null, innerOperator, parsedOperand, operators));
                }
            }

            if (innerParts.length == 1) {
                part = innerParts[0];
                part.context = key;
            } else {
                part = new JsonFilter(key, operators.$ctxAnd, innerParts, operators);
            }
        }

        parts.push(part);
    }

    if (!parts.length) {
        throw new JsonFilterError("Operator with no command: {}");
    }

    if (parts.length == 1) {
        return parts[0];
    } else {
        return new JsonFilter(null, operators.$ctxAnd, parts);
    }
};

JsonFilter.getDefaults = function () {
    if (!defaults) {
        defaults = JsonFilterOperator.createDefaults();
    }

    return defaults;
};

module.exports = JsonFilter;