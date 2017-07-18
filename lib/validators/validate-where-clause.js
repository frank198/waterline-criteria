/**
 * Module dependencies
 */

const util = require('util');
const flaverr = require('flaverr');
const isEqFilter = require('./private/is-eq-filter');
const isUndefined = require('lodash.isundefined');
const isString = require('lodash.isstring');
const isBoolean = require('lodash.isboolean');
const isNumber = require('lodash.isnumber');
const each = require('lodash.foreach');
const isObject = require('lodash.isobject');
const isFunction = require('lodash.isfunction');

// A prefix string to use at the beginning of error messages
// relating to this `where` clause being unparseable.
const E_WHERE_CLAUSE_UNPARSEABLE_MSG_PREFIX =
'Could not parse the provided `where` clause.  Refer to the Sails documentation ' +
'for up-to-date info on supported query language syntax:\n' +
'(http://sailsjs.com/documentation/concepts/models-and-orm/query-language)\n' +
'Details: ';

// Predicate modifiers
const PREDICATE_OPERATORS = [
	'or',
	'and'
];

// "Not in" operators
// (these overlap with sub-attr modifiers-- see below)
const NIN_OPERATORS = [
	'!', 'not'
];

// Sub-attribute modifiers
const SUB_ATTR_MODIFIERS = [
	'<', 'lessThan',
	'<=', 'lessThanOrEqual',
	'>', 'greaterThan',
	'>=', 'greaterThanOrEqual',

	'!', 'not', // << these overlap with `not in` operators

	// The following sub-attribute modifiers also have another,
	// more narrow classification: string search modifiers.
	'like',
	'contains',
	'startsWith',
	'endsWith'
];

// String search modifiers
// (these overlap with sub-attr modifiers-- see above)
const STRING_SEARCH_MODIFIERS = [
	'like',
	'contains',
	'startsWith',
	'endsWith'
];

/**
 * validateWhereClause()
 *
 * Check the `WHERE` clause for obviously unsupported usage.
 *
 * This does not do any schema-aware validation-- its job is merely
 * to check for structural issues, and to provide a better experience
 * when integrating from userland code.
 *
 * @param  {Dictionary} where
 *         A hypothetically well-formed `where` clause from
 *         a Waterline criteria.
 *
 * @throws {Error} If WHERE clause cannot be parsed.
 *         @property {String} `code: 'E_WHERE_CLAUSE_UNPARSEABLE'`
 */
module.exports = function validateWhereClause(where)
{

	if (isUndefined(where))
	{
		throw new Error('Cannot call validateWhereClause() when `where` is undefined.');
	}

	if (!isObject(where) || Array.isArray(where) || isFunction(where))
	{
		throw flaverr('E_WHERE_CLAUSE_UNPARSEABLE', new Error(`${E_WHERE_CLAUSE_UNPARSEABLE_MSG_PREFIX}Expected \`where\` to be a dictionary, but got: \`${util.inspect(where, {depth: null})}\``));
	}

	// Recursively iterate through the provided `where` clause, starting with each top-level key.
	(function _recursiveStep(clause)
	{

		each(clause, function(rhs, key)
		{

			//  ╔═╗╦═╗╔═╗╔╦╗╦╔═╗╔═╗╔╦╗╔═╗
			//  ╠═╝╠╦╝║╣  ║║║║  ╠═╣ ║ ║╣
			//  ╩  ╩╚═╚═╝═╩╝╩╚═╝╩ ╩ ╩ ╚═╝
			//  ┌─    ┌─┐┬─┐     ┌─┐┌┐┌┌┬┐    ─┐
			//  │───  │ │├┬┘     ├─┤│││ ││  ───│
			//  └─    └─┘┴└─  ┘  ┴ ┴┘└┘─┴┘    ─┘
			// If this is an OR or AND predicate...
			if (PREDICATE_OPERATORS.includes(key))
			{

				// RHS of a predicate must always be an array.
				if (!Array.isArray(rhs))
				{
					throw flaverr('E_WHERE_CLAUSE_UNPARSEABLE', new Error(`${E_WHERE_CLAUSE_UNPARSEABLE_MSG_PREFIX}Expected an array at \`${key}\`, but instead got:${util.inspect(rhs, {depth: null})}\n(\`${key}\` should always be provided with an array on the right-hand side.)`));
				}// -•

				// If the array is empty, then this is puzzling.
				// e.g. `{ or: [] }`
				if (Object.keys(rhs).length === 0)
				{
					// But we will tolerate it for now for compatibility.
					// (it's not _exactly_ invalid, per se.)
				}

				// >-
				// Loop over each sub-clause within this OR/AND predicate.
				each(rhs, function(subClause)
				{

					// Check that each sub-clause is a plain dictionary, no funny business.
					if (!isObject(subClause) || Array.isArray(subClause) || isFunction(subClause))
					{
						throw flaverr('E_WHERE_CLAUSE_UNPARSEABLE', new Error(`${E_WHERE_CLAUSE_UNPARSEABLE_MSG_PREFIX}Expected each item within a \`${key}\` predicate's array to be a dictionary, but got: \`${util.inspect(subClause, {depth: null})}\``));
					}

					// Recursive call
					_recursiveStep(subClause);

				});// </each sub-clause inside of predicate>

			}
			//  ╦╔╗╔  ┌─┐┬┬ ┌┬┐┌─┐┬─┐
			//  ║║║║  ├┤ ││  │ ├┤ ├┬┘
			//  ╩╝╚╝  └  ┴┴─┘┴ └─┘┴└─
			// Else if this is an IN (equal to any) filter...
			else if (Array.isArray(rhs))
			{

				// If the array is empty, then this is puzzling.
				// e.g. `{ fullName: [] }`
				if (Object.keys(rhs).length === 0)
				{
					// But we will tolerate it for now for compatibility.
					// (it's not _exactly_ invalid, per se.)
				}

				// Validate each item in the `in` array as an equivalency filter.
				each(rhs, function(subFilter)
				{

					if (!isEqFilter(subFilter))
					{
						throw flaverr('E_WHERE_CLAUSE_UNPARSEABLE', new Error(`${E_WHERE_CLAUSE_UNPARSEABLE_MSG_PREFIX}Unexpected value at \`${key}\`:${util.inspect(subFilter, {depth: null})}\n(Sub-filters within an \`in\` must be provided as primitive values like strings, numbers, booleans, and null.)`));
					}

				});

			}
			//  ╔╦╗╦╔═╗╔╦╗╦╔═╗╔╗╔╔═╗╦═╗╦ ╦  ╔═╗╔═╗  ╔═╗╦ ╦╔╗    ╔═╗╔╦╗╔╦╗╦═╗  ┌┬┐┌─┐┌┬┐┬┌─┐┬┌─┐┬─┐┌─┐
			//   ║║║║   ║ ║║ ║║║║╠═╣╠╦╝╚╦╝  ║ ║╠╣   ╚═╗║ ║╠╩╗───╠═╣ ║  ║ ╠╦╝  ││││ │ │││├┤ │├┤ ├┬┘└─┐
			//  ═╩╝╩╚═╝ ╩ ╩╚═╝╝╚╝╩ ╩╩╚═ ╩   ╚═╝╚    ╚═╝╚═╝╚═╝   ╩ ╩ ╩  ╩ ╩╚═  ┴ ┴└─┘─┴┘┴└  ┴└─┘┴└─└─┘
			//  ┌─    ┌─┐┌─┐┌┐┌┌┬┐┌─┐┬┌┐┌┌─┐   ┬   ┬  ┌─┐┌─┐┌─┐  ┌┬┐┬ ┬┌─┐┌┐┌   ┌─┐┌┬┐┌─┐    ─┐
			//  │───  │  │ ││││ │ ├─┤││││└─┐   │   │  ├┤ └─┐└─┐   │ ├─┤├─┤│││   ├┤  │ │    ───│
			//  └─    └─┘└─┘┘└┘ ┴ ┴ ┴┴┘└┘└─┘┘  o┘  ┴─┘└─┘└─┘└─┘   ┴ ┴ ┴┴ ┴┘└┘┘  └─┘ ┴ └─┘    ─┘
			// Else if the right-hand side is a dictionary...
			else if (isObject(rhs) && !Array.isArray(rhs) && !isFunction(rhs))
			{

				// If the dictionary is empty, then this is puzzling.
				// e.g. { fullName: {} }
				if (Object.keys(rhs).length === 0)
				{
					throw flaverr('E_WHERE_CLAUSE_UNPARSEABLE', new Error(`${E_WHERE_CLAUSE_UNPARSEABLE_MSG_PREFIX}Unexpected value at \`${key}\`:${util.inspect(rhs, {depth: null})}\n(If a dictionary is provided, it is expected to consist of sub-attribute modifiers like \`contains\`, etc.  But this dictionary is empty!)`));
				}

				// Check to verify that it is a valid dictionary with a sub-attribute modifier.
				each(rhs, function(subFilter, subAttrModifierKey)
				{

					// If this is a documented sub-attribute modifier, then validate it as such.
					if (SUB_ATTR_MODIFIERS.includes(subAttrModifierKey))
					{

						// If the sub-filter is an array...
						//
						// > The RHS value for sub-attr modifier is only allowed to be an array for
						// > the `not` modifier. (This is to allow for use as a "NOT IN" filter.)
						// > Otherwise, arrays are prohibited.
						if (Array.isArray(subFilter))
						{

							// If this is _actually_ a `not in` filter (e.g. a "!" with an array on the RHS)...
							// e.g.
							// ```
							// fullName: {
							//   '!': ['murphy brown', 'kermit']
							// }
							// ```
							if (NIN_OPERATORS.includes(subAttrModifierKey))
							{

								// If the array is empty, then this is puzzling.
								// e.g. `{ fullName: { '!': [] } }`
								if (Object.keys(subFilter).length === 0)
								{
									// But we will tolerate it for now for compatibility.
									// (it's not _exactly_ invalid, per se.)
								}

								// Loop over the "not in" values in the array
								each(subFilter, function(blacklistItem)
								{

									// We handle this here as a special case.
									if (!isEqFilter(blacklistItem))
									{
										throw flaverr('E_WHERE_CLAUSE_UNPARSEABLE', new Error(`${E_WHERE_CLAUSE_UNPARSEABLE_MSG_PREFIX}Unexpected value within the blacklist array provided at sub-attribute modifier (\`${subAttrModifierKey}\`) for \`${key}\`:${util.inspect(blacklistItem, {depth: null})}\n(Blacklist items within a \`not in\` array must be provided as primitive values like strings, numbers, booleans, and null.)`));
									}

								});// </each() :: item in the "NOT IN" blacklist array>
							}
							// Otherwise, this is some other attr modifier...which means this is invalid,
							// since arrays are prohibited.
							else
							{
								throw flaverr('E_WHERE_CLAUSE_UNPARSEABLE', new Error(`${E_WHERE_CLAUSE_UNPARSEABLE_MSG_PREFIX}Unexpected array at sub-attribute modifier (\`${subAttrModifierKey}\`) for \`${key}\`:${util.inspect(subFilter, {depth: null})}\n(An array cannot be used as the right-hand side of a \`${subAttrModifierKey}\` sub-attribute modifier.  Instead, try using \`or\` at the top level.  Refer to the Sails docs for details.)`));
							}

						}
						// Otherwise the sub-filter for this sub-attr modifier should
						// be validated according to its modifer.
						else
						{

							// If this sub-attribute modifier is specific to strings
							// (e.g. "contains") then only allow strings, numbers, and booleans.  (Dates and null should not be used.)
							if (STRING_SEARCH_MODIFIERS.includes(subAttrModifierKey))
							{
								if (!isString(subFilter) && !isNumber(subFilter) && !isBoolean(subFilter))
								{
									throw flaverr('E_WHERE_CLAUSE_UNPARSEABLE', new Error(`${E_WHERE_CLAUSE_UNPARSEABLE_MSG_PREFIX}Unexpected value at sub-attribute modifier (\`${subAttrModifierKey}\`) for \`${key}\`:${util.inspect(subFilter, {depth: null})}\n(The right-hand side of a string search modifier like \`${subAttrModifierKey}\` must always be a string, number, or boolean.)`));
								}
							}
							// Otherwise this is a miscellaneous sub-attr modifier,
							// so validate it as an eq filter.
							else
							{
								if (!isEqFilter(subFilter))
								{
									throw flaverr('E_WHERE_CLAUSE_UNPARSEABLE', new Error(`${E_WHERE_CLAUSE_UNPARSEABLE_MSG_PREFIX}Unexpected value at sub-attribute modifier (\`${subAttrModifierKey}\`) for \`${key}\`:${util.inspect(subFilter, {depth: null})}\n(The right-hand side of a \`${subAttrModifierKey}\` must be a primitive value, like a string, number, boolean, or null.)`));
								}
							}// </else (validate this sub-attr modifier's RHS as an eq filter)>

						}// </else (validation rule depends on what modifier this is)>

					}// </if this is a recognized sub-attr modifier>
					//
					// Otherwise, this is NOT a recognized sub-attribute modifier and it makes us uncomfortable.
					else
					{
						throw flaverr('E_WHERE_CLAUSE_UNPARSEABLE', new Error(`${E_WHERE_CLAUSE_UNPARSEABLE_MSG_PREFIX}Unrecognized sub-attribute modifier (\`${subAttrModifierKey}\`) for \`${key}\`.  Make sure to use a recognized sub-attribute modifier such as \`startsWith\`, \`<=\`, \`!\`, etc. )`));
					}

				});// </each sub-attr modifier>

			}// </RHS is a dictionary>
			//
			//  ╔═╗╔═╗ ╦ ╦╦╦  ╦╔═╗╦  ╔═╗╔╗╔╔═╗╦ ╦  ┌─┐┬┬ ┌┬┐┌─┐┬─┐
			//  ║╣ ║═╬╗║ ║║╚╗╔╝╠═╣║  ║╣ ║║║║  ╚╦╝  ├┤ ││  │ ├┤ ├┬┘
			//  ╚═╝╚═╝╚╚═╝╩ ╚╝ ╩ ╩╩═╝╚═╝╝╚╝╚═╝ ╩   └  ┴┴─┘┴ └─┘┴└─
			// Last but not least, when nothing else matches...
			else
			{

				// Check the right-hand side as a normal equivalency filter.
				if (!isEqFilter(rhs))
				{
					throw flaverr('E_WHERE_CLAUSE_UNPARSEABLE', new Error(`${E_WHERE_CLAUSE_UNPARSEABLE_MSG_PREFIX}Unexpected value at \`${key}\`:${util.inspect(rhs, {depth: null})}\n(When filtering by exact match, use a primitive value: a string, number, boolean, or null.)`));
				}

			}// </else:: is normal equivalency filter>

		});// </each() : check each top-level key>

	})(where);

};

