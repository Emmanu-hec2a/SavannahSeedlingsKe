import assert from 'node:assert/strict';
import { ApiError, errorMessage } from '../src/services/apiErrors.js';

assert.equal(errorMessage({response:{status:400,data:{email:['Already registered.']}}}), 'Email: Already registered.');
assert.equal(errorMessage({response:{status:400,data:{non_field_errors:['Please sign in instead.']}}}), 'Please sign in instead.');
assert.equal(errorMessage({response:{status:400,data:{password1:['Too short.'],password2:['Does not match.']}}}), 'Password: Too short. Confirm password: Does not match.');
assert.equal(errorMessage({response:{status:400,data:{items:[{quantity:['Too many seedlings.']}]}}}), 'Too many seedlings.');
assert.equal(errorMessage({response:{status:503,data:{detail:'Private server trace'}}}, 'Please retry.'), 'Please retry.');
assert.equal(errorMessage({response:{status:502,data:'<html>Proxy failure</html>'}}, 'Please retry.'), 'Please retry.');
assert.equal(errorMessage(new Error('Network internals'), 'Connection failed.'), 'Connection failed.');
assert.equal(errorMessage(undefined, 'Google sign-in failed.'), 'Google sign-in failed.');
const data = {items:'Please update your cart.',stock_issues:[{product_name:'QA Seedling',available:'0',requested:'2'}]};
const error = new ApiError(400, data);
assert.equal(error.message, 'Please update your cart.');
assert.equal(error.status, 400);
assert.deepEqual(error.data.stock_issues, data.stock_issues);
assert.equal(errorMessage(error), 'Please update your cart.');
console.log('12 API-error formatting and payload-preservation checks passed.');
