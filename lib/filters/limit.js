/**
 * Module dependencies
 */

const slice = require('lodash.slice');

/**
 * Apply a `limit` modifier to `data` using `limit`.
 *
 * @param  { Dictionary[] }  data
 * @param  { Integer }    limit
 * @return { Dictionary[] }
 */
module.exports = function(data, limit)
{
	if (limit === undefined || !data || limit === 0)
	{
		return data;
	}
	return slice(data, 0, limit);
};
