/**
 * Module dependencies
 */

const isString = require('lodash.isstring');
const cloneDeep = require('lodash.clonedeep');
const reduce = require('lodash.reduce');
const X_ISO_DATE = require('./X_ISO_DATE.constant');

/**
 * Sort the tuples in `data` using `comparator`.
 *
 * @param  { Dictionary[] }  data
 * @param  { Dictionary }    comparator
 * @param  { Function }    when
 * @return { Dictionary[] }
 */
module.exports = function(data, comparator, when)
{
	if (!comparator || !data)
	{
		return data;
	}

	// Equivalent to a SQL "WHEN"
	when = when || function rankSpecialCase(record, attrName)
	{

		// `null` ranks lower than anything else
		if (typeof record[attrName] === 'undefined' || record[attrName] === null)
		{
			return false;
		}

		return true;

	};

	return sortData(cloneDeep(data), comparator, when);
};

// ////////////////////////
// /
// / private methods   ||
// /                   \/
// /
// ////////////////////////

/**
 * Sort `data` (tuples) using `sortVector` (comparator obj)
 *
 * Based on method described here:
 * http://stackoverflow.com/a/4760279/909625
 *
 * @param  { Dictionary[] } data         [tuples]
 * @param  { Dictionary }   sortVector [mongo-style comparator Dictionary]
 * @return { Dictionary[] }
 */

function sortData(data, sortVector, when)
{

	// Constants
	const GREATER_THAN = 1;
	const LESS_THAN = -1;
	const EQUAL = 0;

	return data.sort(function _compare(a, b)
	{
		return reduce(sortVector, function(flagSoFar, sortDirection, attrName)
		{

			let outcome;

			// Handle special cases (defined by WHEN):
			let $a = when(a, attrName);
			let $b = when(b, attrName);
			if (!$a && !$b) outcome = EQUAL;
			else if (!$a && $b) outcome = LESS_THAN;
			else if ($a && !$b) outcome = GREATER_THAN;

			// General case:
			else
			{
				// Coerce types
				$a = a[attrName];
				$b = b[attrName];
				if ($a < $b) outcome = LESS_THAN;
				else if ($a > $b) outcome = GREATER_THAN;
				else outcome = EQUAL;
			}

			// Less-Than case (-1)
			// (leaves flagSoFar untouched if it has been set, otherwise sets it)
			if (outcome === LESS_THAN)
			{
				return flagSoFar || -sortDirection;
			}
			// Greater-Than case (1)
			// (leaves flagSoFar untouched if it has been set, otherwise sets it)
			else if (outcome === GREATER_THAN)
			{
				return flagSoFar || sortDirection;
			}
			// Equals case (0)
			// (always leaves flagSoFar untouched)
			return flagSoFar;

		}, 0);// </reduce>
	});// </data.sort()>
}

/**
 * Coerce a value to its probable intended type for sorting.
 *
 * @param  {???} x
 * @return {???}
 */
function coerceIntoBestGuessType(x)
{
	switch (guessType(x))
	{
		case 'booleanish': return (x === 'true') ? true : false;
		case 'numberish': return Number(x);
		case 'dateish': return new Date(x);
		default: return x;
	}
}

function guessType(x)
{

	if (!isString(x))
	{
		return typeof x;
	}

	// Probably meant to be a boolean
	else if (x === 'true' || x === 'false')
	{
		return 'booleanish';
	}

	// Probably meant to be a number
	else if (Number(x) === x)
	{
		return 'numberish';
	}

	// Probably meant to be a date
	else if (x.match(X_ISO_DATE))
	{
		return 'dateish';
	}

	// Just another string
	return typeof x;
}
