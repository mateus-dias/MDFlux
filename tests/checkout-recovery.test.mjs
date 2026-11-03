import test from 'node:test';
import assert from 'node:assert/strict';
import {validateRecoveredCheckout,recoverReservedCheckout,bindRecoveredCheckout} from '../netlify/lib/checkout-recovery.mjs';
const attempt={id:'reserved-reference',plan:'profissional',status:'creating',provider_id:null};
const subscription={id:'provider-id',external_reference:attempt.id,status:'authorized',init_point:'https://www.mercadopago.com.br/subscriptions/checkout?preapproval_id=provider-id',auto_recurring:{transaction_amount:99.9,currency_id:'BRL',frequency:1,frequency_type:'months'}};
test('recovery accepts only the exact reference, provider, monthly price and secure checkout',()=>{
 assert.ok(validateRecoveredCheckout(attempt,subscription));
 for(const sub of [
  {...subscription,external_reference:'another-reference'},
  {...subscription,init_point:'https://mercadopago.com.br.evil.example/'},
  {...subscription,init_point:'http://www.mercadopago.com.br/'},
  {...subscription,auto_recurring:{...subscription.auto_recurring,transaction_amount:1}},
  {...subscription,auto_recurring:{...subscription.auto_recurring,currency_id:'USD'}},
  {...subscription,auto_recurring:{...subscription.auto_recurring,frequency:2}},
 ])assert.throws(()=>validateRecoveredCheckout(attempt,sub));
 assert.throws(()=>validateRecoveredCheckout({...attempt,provider_id:'another-provider'},subscription));
});
test('zero or ambiguous search results never fail the reservation or create a new subscription',async()=>{
 for(const response of [{results:[],paging:{total:0}},{results:[subscription,subscription],paging:{total:2}},{results:[subscription],paging:{total:2}},{results:[{...subscription,external_reference:'other'}],paging:{total:1}}]) {
  const calls=[];
  assert.equal(await recoverReservedCheckout(null,attempt,async path=>{calls.push(path);return response;}),null);
  assert.deepEqual(calls,['/preapproval/search?q=reserved-reference']);
 }
});
function adapter(updated,current) {
 const predicates=[],patches=[];
 const d={from:()=>({update(p){patches.push(p);return this;},eq(k,v){predicates.push([k,v]);return this;},is(k,v){predicates.push([k,v]);return this;},select(){return this;},maybeSingle:async()=>({data:updated,error:null}),single:async()=>({data:current,error:null})})};
 return {d,predicates,patches};
}
test('recovery binds only a still-creating, unbound attempt',async()=>{
 const bound={...attempt,provider_id:subscription.id,status:'pending',url:subscription.init_point};
 const a=adapter(bound);
 const calls=[];
 const result=await recoverReservedCheckout(a.d,attempt,async path=>{calls.push(path);return path.includes('/search')?{results:[subscription],paging:{total:1}}:subscription;});
 assert.equal(result,bound);
 assert.deepEqual(a.predicates,[['id',attempt.id],['status','creating'],['provider_id',null]]);
 assert.equal(a.patches[0].provider_id,subscription.id);
 assert.equal(calls[1],'/preapproval/provider-id');
});
test('a concurrent confirmation is preserved instead of overwritten',async()=>{
 const confirmed={...attempt,provider_id:subscription.id,status:'confirmed'};
 const a=adapter(null,confirmed);
 assert.equal(await bindRecoveredCheckout(a.d,attempt,subscription),confirmed);
});
test('a concurrent conflicting binding is rejected',async()=>{
 const a=adapter(null,{...attempt,provider_id:'different-provider'});
 await assert.rejects(()=>bindRecoveredCheckout(a.d,attempt,subscription));
});
test('a canceled remote checkout is released as failed without granting access',async()=>{
 const a=adapter({...attempt,status:'failed',provider_id:subscription.id});
 await bindRecoveredCheckout(a.d,attempt,{...subscription,status:'cancelled'});
 assert.equal(a.patches[0].status,'failed');
 assert.equal(validateRecoveredCheckout(attempt,{...subscription,init_point:undefined,status:'cancelled'}),null);
});
