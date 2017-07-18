/**
 * Module dependencies
 */

const isObject = require('lodash.isobject');
const reduce = require('lodash.reduce');
const omit = require('lodash.omit');
const filter = require('lodash.filter');
const each = require('lodash.foreach');
const map = require('lodash.map');
const pick = require('lodash.pick');

/**
 * Project `tuples` on `fields`.
 *
 * @param  { Dictionary[] }  tuples    [i.e. filteredData]
 * @param  { String[]/Dictionary{} }  fields    [i.e. schema]
 * @return { Dictionary[] }
 */
module.exports = function select(tuples, fields)
{

	// Expand splat shortcut syntax
	if (fields === '*')
	{
		fields = {'*': true};
	}

	// If `fields` is not a dictionary or array, don't modify the output.
	// (Just return it as-is.)
	if (typeof fields !== 'object')
	{
		return tuples;
	}

	// If `fields` are specified as an Array, convert them to a dictionary.
	if (Array.isArray(fields))
	{
		fields = reduce(fields, function arrayToDict(memo, attrName)
		{
			memo[attrName] = true;
			return memo;
		}, {});
	}

	// If the '*' key is specified, the projection algorithm is flipped:
	// only keys which are explicitly set to `false` will be excluded--
	// all other keys will be left alone (this lasts until the recursive step.)
	const hasSplat = Boolean(fields['*']);
	const fieldsToExplicitlyOmit = filter(Object.keys(fields), function(key)
	{
		// If value is explicitly false, then this key is a field to omit.
		return fields[key] === false;
	});

	delete fields['*'];

	// Finally, select fields from tuples.
	return map(tuples, function(tuple)
	{

		// Select the requested attributes of the tuple
		if (hasSplat)
		{
			tuple = omit(tuple, function(value, attrName)
			{
				return fieldsToExplicitlyOmit.includes(attrName);
			});
		}
		else
		{
			tuple = pick(tuple, Object.keys(fields));
		}

		// || NOTE THAT THIS APPROACH WILL CHANGE IN AN UPCOMING RELEASE
		// \/ TO MATCH THE CONVENTIONS ESTABLISHED IN WL2.

		// Take recursive step if necessary to support nested
		// SELECT clauses (NOT nested modifiers- more like nested
		// WHEREs)
		//
		// e.g.:
		// like this:
		//   -> { select: { pet: { collarSize: true } } }
		//
		// not this:
		//   -> { select: { pet: { select: { collarSize: true } } } }
		//
		each(fields, function(subselect, attrName)
		{

			// (WARNING: this conditional is true when `subselect` is `null`!)
			// (Leaving it as-is for now to avoid breaking backwards-compatibility.)
			if (typeof subselect === 'object')
			{

				if (Array.isArray(tuple[attrName]))
				{
					tuple[attrName] = select(tuple[attrName], subselect);
				}
				else if (isObject(tuple[attrName]))
				{
					tuple[attrName] = select([tuple[attrName]], subselect)[0];
				}
			}

		});

		return tuple;
	});
};

