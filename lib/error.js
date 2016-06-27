/**
 * error handling
 * @author Alexey Chistyakov <ross@newmail.ru>
 */
var util = require("util");

exports.JFP_CreateOperatorError = JFP_CreateOperatorError;
exports.JFP_ParseOperandError = JFP_ParseOperandError;
exports.JFP_ParseError = JFP_ParseError;
exports.JFP_MatchError = JFP_MatchError;

/**
 * JFP_Error - base error class
 * @param {string} message
 * @constructor
 */
function JFP_Error(message) {
    Error.call(this, message);

    Object.defineProperty(this, "name", {
        value: this.constructor.name
    });

    Object.defineProperty(this, "message", {
        value: message
    });

    if (Error.captureStackTrace) {
        Error.captureStackTrace(this, this.constructor);
    } else {
        Object.defineProperty(this, "stack", {
            value: (new Error()).stack
        });
    }
}
util.inherits(JFP_Error, Error);

/**
 * JFP_CreateOperatorError
 * @param {object} data
 * @param {string} message
 * @constructor
 */
function JFP_CreateOperatorError(data, message) {
    JFP_Error.call(this, message);
    this.data = data;
}
util.inherits(JFP_CreateOperatorError, JFP_Error);

/**
 * JFP_ParseOperandError
 * @param {JsonFilterOperator} operator
 * @param {*} operand
 * @param {string} message
 * @constructor
 */
function JFP_ParseOperandError(operator, operand, message) {
    JFP_Error.call(this, message);
    this.operator = operator;
    this.operand = operand;
}
util.inherits(JFP_ParseOperandError, JFP_Error);

/**
 * JFP_ParseError
 * @param {object} operand
 * @param {string} key
 * @param {string} message
 * @constructor
 */
function JFP_ParseError(operand, key, message) {
    JFP_Error.call(this, message);
    this.operand = operand;
    this.key = key;
}
util.inherits(JFP_ParseError, JFP_Error);

function JFP_MatchError(operator, operand, context, err) {
    if (err instanceof Error) {
        JFP_Error.call(this, err.message);
        this.stack = err.stack;
        this.previous = err;
    } else {
        JFP_Error.call(this, err);
    }

    this.matchOperator = operator;
    this.matchOperand = operand;
    this.matchContext = context;
}
util.inherits(JFP_MatchError, JFP_Error);
