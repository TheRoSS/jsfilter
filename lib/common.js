/**
 * common stuff
 * @author Alexey Chistyakov <ross@newmail.ru>
 */

/**
 * Get field from document 'document' by dot-notation selector 'context'
 * @param {string} context
 * @param {object} document
 * @returns {*}
 */
exports.getContextValue = function (context, document) {
    if (!context) {
        return;
    }

    var str = normilizeSquareBrackets(context);
    var keys = splitByDot(str);
    var value = document;

    for (var i = 0; value && i < keys.length; i++) {
        var key = keys[i];
        value = value[key];
    }

    return value;
};

/**
 * Splits dot notation selector by its components
 * Escaped dots are ignored
 * @param {string} str
 * @returns {Array.<string>}
 */
function splitByDot(str) {
    var result = [];
    var s = "";

    for (var i = 0; i < str.length; i++) {
        if (str[i] == "\\" && str[i+1] == ".") {
            i++;
            s += ".";
            continue;
        }

        if (str[i] == ".") {
            result.push(s);
            s = "";
            continue;
        }

        s += str[i];
    }

    if (s) {
        result.push(s);
    }

    return result;
}

var reSqrBrackets = /^(.+)?\[\s*['"]?([^'"\s]+)['"]?\s*\](\..+)?$/;

/**
 * Replaces square brackets notation by escaped dot notation
 * @param {string} str
 * @returns {string}
 */
function normilizeSquareBrackets(str) {
    var m;

    while ((m = reSqrBrackets.exec(str))) {
        var header = m[1] ? m[1] + '.' : '';
        var body = m[2].replace(/\./g, "\\.");
        var footer = m[3] || '';
        str = header + body + footer;
    }

    return str;
}
