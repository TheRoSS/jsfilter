# JSON filter

Match a javascript object against a json filter. 
The filter syntax is like a mongodb query language. 
There is a support for creation of the user defined filter operators.


## Content

### [Usage](#useFilter)

[__Common usage__](#usage)

[__Filter definition object__](#fdo)

[__Error handling__](#errors)

### [Custom operator creation](#createFilter)

### [Built-in operators](#filters)

__Comparison operators__

* [$empty](#$empty) Check for _false_
* [$exists](#$exists) The field does not exist
* [$eq](#$eq) Equal to
* [$gt](#$gt) Greater than
* [$gte](#$gte) Greater than or equal to
* [$lt](#$lt) Lesser than
* [$lte](#$lte) Lesser than or equal to
* [$ne](#$ne) Not equal to
* [$regex](#$regex) Match to regular expression

__Other context operators__

* [$ceil](#$ceil) The next highest integer
* [$floor](#$floor) The next lowest integer
* [$round](#$round) Round to integer
* [$ceilRH](#$ceilRH) The next highest integer. Right handed
* [$floorRH](#$floorRH) The next lowest integer. Right handed
* [$roundRH](#$roundRH) Round to integer. Right handed
* [$mod](#$mod) Remainder of the division (modulo)
* [$sub](#$sub) Difference
* [$val](#$val) The document selector value

__Array operators__

* [$all](#$all) All values are in the given array
* [$in](#$in) The value is in the given array
* [$nin](#$nin) The value is not in the given array

__Logical operators__

* [$and](#$and) AND
* [$or](#$or) OR
* [$nor](#$nor) NOR
* [$not](#$not) NOT
* [$ctxAnd](#$ctxAnd) Context AND
* [$ctxOr](#$ctxOr) Context OR


<a id="useFilter" />

## Usage

<a id="usage" />

### Common usage:

The filter can be defined as JSON string:

```javascript
var filterData = '{"src": "io"}';
```

or as a plain javascript object:

```javascript
var filterData = {
    src: "io"
};
```

The factory _JsonFilter.create_ must be called to create filter instance.
Do not use constructors. They are for internal purposes.

```javascript
var JsonFilter = require("jsfilter").JsonFilter;
var filter = JsonFilter.create(filterData);
```

Match the document against the filter instance:

```javascript
if (filter.match(document)) {
    // ...
}
```

<a id="fdo" />

### Filter definition object

The filter definition object is a plain javascript object.
It is used to create filter instance by the factory call _JsonFilter.create_.
It can be defined also as a valid JSON string.

The keys in the filter object are dot notation selectors for data in the input document.
The dots in the key names must be escaped with symbol '\'.
The square brackets notation is supported too 
but it is less efficient and internally converted to escaped dot notation.
So prefer to use dot notation.
The values of the filter object are filter operators 
that will be applied to document data selected by the corresponding selector.
Filter operators are JSON objects and its names begin with symbol '$'.

__filter example:__

```javascript
{
    "src": "io",
    "user.loginsCount": {"$gt": 0},
    "user[.ref.type]": "bbbb",
    "user.ref\.type": "uuuu"
}
```

The filter in the example allows only those documents that satisfy all following requirements:
- field _src_ is equal to _io_
- field _loginsCount_ of the object _user_ is greater than 0
- field _.ref.type_ of _user_ is equal to "bbbb"
- field _ref.type_ of _user_ is equal to "uuuu"

__document example:__

```javascript
{
    src: "io",
    user: {
        loginsCount: 100500,
        ".ref.type": "bbbb",
        "ref.type": "uuuu"
    }
}
```

<a id="errors" />

### Error handling

There are following exceptions in the package:

__JFP_Error__

The base package exception is inherited from _Error_. 
All other exceptions in the package inherit this one.
In corrects standard fields _message_, _name_ and _stack_.

No additional fields are set.

__JFP_CreateOperatorError__

Filter operator creation error.

Additional fields:

* _data_ - the data that was used to construct the operator

__JFP_ParseOperandError__

Operator's operands parser error. 
Checks whether the operand defined in the filter is correct.

Additional fields:

* _operator_ - the operator instance that owns the given operand
* _operand_ - operand's definition

__JFP_ParseError__

Filter structure parse error.

Additional fields:

* _key_ - the filter object key that holds the erroneous data
* _operand_ - the erroneous data

__JFP_MatchError__

Filter match error.

Additional fields:

* _matchOperator_ - the failed filter operator
* _matchOperand_ - the failed operator's operand
* _matchContext_ - the failed operator's context


<a id="createFilter" />

## Custom operator creation

To create your own filter operator your have to: 

1. Create javascript object with parameters of the operator to be created.
The fields of this object are:

    * _name_ - Operator's name. Must begin with '$' symbol.
    * _operandsType_ - Type of the expected operand:
        - _array_ - array
        - _regex_ - regular expression
        - _operator_ - other operator
        - _context_ - document context selector
        - _value_ - all except the above types
    * _operandsCountMin_ - minimum array elements count for _array_ type
    * _operandsCountMax_ - maximum array elements count for _array_ type
    * _match_ - the string with matching function body

    The fields _name_, _operandsType_ and _match_ are required.
    
    Parameter _match_ is used for javascript _Function_ constructor as follows:
    
    ```javascript
    new Function("context", "operand", "document", "operators", data.match);
    ```
    
    where:
    
    * _context_ - document context for the operator
    * _operand_ - operand
    * _document_ - hole document
    * _operators_ - object with all operators by its names (example: _operators.$eq_)
    
    Consider an example:
    
    ```javascript
    {
        "user.age": {"$gt": 12}
    }
    ```

    Here for operator _$gt_ the _context_ is "user.age" and the _operand_ is 12.

2. Create operator instance with factory _JsonFilterOperator.create_

    ```javascript
    var data = {
        name: "$gt",
        operandsType: "value",
        match: "return context > operand"
    };
    
    var operator = JsonFilterOperator.create(data);
    ```

3. Create an object to hold your operators or get default one

    Create new empty object (built-in operators will be unavailable)
    
    ```javascript
    var defaults = {};
    ```
    
    or create new object with a set of built-in operators
    
    ```javascript
    var defaults = JsonFilterOperator.createDefaults();
    ```
    
    or get static system defaults
    
    ```javascript
    var defaults = JsonFilter.getDefaults();
    ```
    
4. Add your operator to this object

    ```javascript
    defaults[operator.name] = operator
    ```

5. Create your filters with custom defaults

    ```javascript
    JsonFilter.create({smth: {$gt: 3}}, defaults);
    ```
    
    If you add your operator to system defaults (got with _JsonFilter.getDefaults_)
    than the second argument can be omitted
    
    ```javascript
    JsonFilter.create({smth: {$gt: 3}});
    ```


<a id="filters" />

## Built-in operators


<a id="$empty" />

__$empty__

Checks whether the context is an _empty_ value

```javascript
{
    "user.loginsCount": {"$empty": true}
}
```

The next values are considered to be _empty_:
- 0
- null
- undefined
- ''
- false
- '0'
- []
- {}

<a id="$exists" />

__$exists__

Checks whether the field exists in the document (check for _undefined_)

```javascript
{
    "user.registrationTime": {"$exists": false}
}
```

<a id="$eq" />

__$eq__

Checks for non-strict equality. Arrays and objects are compared recursively.

```javascript
{
    "user.loginsCount": {"$eq": 5},
    "user.rates": {"$eq": {"2x2": 100, "5x5": 200}}
    "user.jobs": {"$eq": ["newbie", "farmer"]}
}
```

If you compare with primitive types than the operator expression can be simplified.
You can write just the value instead of operator construction.
This form will be converted to full operator form internally.

```javascript
{
    "user.loginsCount": 5
}
```

<a id="$ne" />

__$ne__

Checks for non-strict equality (not equal to). Arrays and objects are compared recursively.

```javascript
{
    "user.loginsCount": {"$ne": 5}
}
```

<a id="$gt" />

__$gt__

Greater than

```javascript
{
    "user.loginsCount": {"$gt": 5}
}
```

<a id="$gte" />

__$gte__

Greater than or equal to

```javascript
{
    "user.loginsCount": {"$gte": 5}
}
```

<a id="$lt" />

__$lt__

Less than

```javascript
{
    "user.loginsCount": {"$lt": 5}
}
```

<a id="$lte" />

__$lte__

Less than or equal to

```javascript
{
    "user.loginsCount": {"$lte": 5}
}
```

<a id="$regex" />

__$regex__

Checks for match with regular expression

```javascript
{
    "user.class": {"$regex": "^fighter"},
    "user.clan.duties": {"$regex": "/newbie/i"}
}
```

If you do not need to use the regular expression flags (case insensitivity, for example), 
than the bound symbols '/' can be omitted.

<a id="$ceil" />

__$ceil__

The next highest integer

```javascript
{
    "user.average": {"$ceil": 4}
}
```

<a id="$floor" />

__$floor__

The next lowest integer

```javascript
{
    "user.average": {"$floor": 3}
}
```

<a id="$round" />

__$round__

Round to integer

```javascript
{
    "user.average": {"$round": 3}
}
```

<a id="$ceilRH" />

__$ceilRH__

The next highest integer. This is a right handed operator 
that is its operand is taken from the right part of the operator expression.

```javascript
{
    "tm": {
        "$gt": {"$ceilRH": "user.avg"}
    }
}
```

The simplified form with an implicit _$eq_

```javascript
"tm": {"$ceilRH": "user.avg"}
```

<a id="$floorRH" />

__$floorRH__

The next lowest integer. This is a right handed operator 
that is its operand is taken from the right part of the operator expression.

```javascript
{
    "tm": {
        "$gt": {"$floorRH": "user.avg"}
    }
}
```

The simplified form with an implicit _$eq_

```javascript
"tm": {"$floorRH": "user.avg"}
```

<a id="$roundRH" />

__$roundRH__

Round to integer. This is a right handed operator 
that is its operand is taken from the right part of the operator expression.

```javascript
{
    "tm": {
        "$gt": {"$roundRH": "user.avg"}
    }
}
```

The simplified form with an implicit _$eq_

```javascript
{
    "tm": {"$roundRH": "user.avg"}
}
```

<a id="$mod" />

__$mod__

Remainder of the integer division (modulo).
The operand must be an array of two numbers: divisor and expected remainder.

```javascript
{
    "user.purchases": {"$mod": [5, 0]}
}
```

<a id="$sub" />

__$sub__

Difference between two context values

```javascript
{
    "ts": {
        "$sub": {
            "user.lastLoginTime": {"$lt": 300}
        }
    }
}
```

<a id="$val" />

__$val__

Get the context value. This is a right handed operator 
that is its operand is taken from the right part of the operator expression.

```javascript
{
    "ts": {
        "$eq": {"$val": "user.lastLoginTime"}
    }
}
```

The simplified form with an implicit _$eq_

```javascript
{
    "ts": {"$val": "user.lastLoginTime"}
}
```


<a id="$all" />

__$all__

All elements of the array document context value must be members of the given operand array.
If the document context value is not an array than the operator is equivalent to _$in_.

```javascript
{
    "user.roles": {
        "$all": ["cleaner", "washer", "cook"]
    }
}
```

<a id="$in" />

__$in__

The document context value must be a member of the given operand array.
If the document context value is an array than the operator checks
that at least one of its elements must be a member of the given operand array.

```javascript
{
    "user.role": {
        "$in": ["cleaner", "washer", "cook"]
    }
}
```

The simplified form with an implicit _$in_

```javascript
{
    "user.role": ["cleaner", "washer", "cook"]
}
```

<a id="$nin" />

__$nin__

The document context value must not be a member of the given operand array.
If the document context value is an array than the operator checks
that no one of its elements is not a member of the given operand array.

```javascript
{
    "user.role": {
        "$nin": ["cleaner", "washer", "cook"]
    }
}
```

<a id="$and" />

__$and__

Logical AND to combine independent conditions.
The document must satisfy all the combined conditions.

```javascript
{
    "$and": [
        {"user.sex": "male"},
        {"user.class": "warrior"}
    ]
}
```

The simplified form with an implicit _$and_

```javascript
{
    "user.sex": "male",
    "user.class": "warrior"
}
```


<a id="$or" />

__$or__

Logical OR to combine independent conditions.
The document must satisfy at least one of the combined conditions.

```javascript
{
    "$or": [
        {"user.sex": "male"},
        {"user.class": "warrior"}
    ]
}
```

The simplified form with an implicit _$or_

```javascript
[
    {"user.sex": "male"},
    {"user.class": "warrior"}
]
```

<a id="$nor" />

__$nor__

Logical NOR to combine independent conditions.
The document must not satisfy any of the combined conditions.

```javascript
{
    "$nor": [
        {"user.sex": "male"},
        {"user.class": "warrior"},
        {"user.age": {"$lt": 12}}
    ]
}
```

<a id="$not" />

__$not__

Logical NOT to negate the result of the previous logical operation.
The operator context is passed to the next operator without changes.

```javascript
"user.age": {
    $not: {$lt: 12}
}
```

<a id="$ctxAnd" />

__$ctxAnd__

Logical AND to combine operations with shared context.
The document must satisfy all the combined conditions.

```javascript
{
    "user.age": {
        "$ctxAnd": [
            {"$lt": 45},
            {"$gt": 12}
        ]
    }
}
```

The simplified form with an implicit _$ctxAnd_

```javascript
{
    "user.age": {
        "$lt": 45,
        "$gt": 12
    }
}
```

<a id="$ctxOr" />

__$ctxOr__

Logical OR to combine operations with shared context.
The document must satisfy at least one of the combined conditions.

```javascript
{
    "user.role": {
        "$ctxOr": [
            {"$regex": "newbie"},
            {"$regex": "baboon"}
        ]
    }
}
```

The simplified form with an implicit _$ctxOr_

```javascript
{
    "user.role": [
        {"$regex": "newbie"},
        {"$regex": "baboon"}
    ]
}
```
