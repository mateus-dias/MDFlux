import {checked} from './core.mjs';
import {plans} from '../../src/domain.mjs';

export function validateRecoveredCheckout(attempt, subscription) {
  const plan=plans[attempt.plan], recurring=subscription.auto_recurring;
  if (!plan || !subscription.id || subscription.external_reference!==attempt.id ||
      (attempt.provider_id && attempt.provider_id!==subscription.id) ||
      !recurring || Number(recurring.transaction_amount)!==plan.price ||
      recurring.currency_id!=='BRL' || recurring.frequency!==1 || recurring.frequency_type!=='months' ||
      !['pending','authorized','paused','cancelled'].includes(subscription.status)) {
    throw new Error('Assinatura não corresponde ao checkout reservado.');
  }
  const checkoutUrl=subscription.init_point||attempt.url;
  // Authorized/canceled resources can omit init_point on GET. They still need
  // binding for payment confirmation, but must not expose an invented URL.
  if(!checkoutUrl && subscription.status!=='pending') return null;
  const url=new URL(checkoutUrl);
  if(url.protocol!=='https:' || !/(^|\.)mercadopago\.(com|com\.br)$/.test(url.hostname)) {
    throw new Error('Checkout inválido');
  }
  return url.href;
}

export async function bindRecoveredCheckout(d,attempt,subscription) {
  const url=validateRecoveredCheckout(attempt,subscription);
  if(attempt.provider_id) return attempt;
  if(attempt.status!=='creating') throw new Error('Reserva de checkout inválida.');
  const bound=await checked(d.from('checkout_attempts').update({
    provider_id:subscription.id,url,status:subscription.status==='cancelled'?'failed':'pending',
  }).eq('id',attempt.id).eq('status','creating').is('provider_id',null).select().maybeSingle());
  if(bound) return bound;
  // A webhook or concurrent retry may have bound/confirmed the same reservation.
  const current=await checked(d.from('checkout_attempts').select('*').eq('id',attempt.id).single());
  if(current.provider_id!==subscription.id) throw new Error('Checkout alterado durante a reconciliação.');
  return current;
}

export async function recoverReservedCheckout(d,attempt,provider) {
  // The provider silently ignores external_reference as a search filter. Use q,
  // then compare the full reference locally; never infer absence means failure.
  const response=await provider('/preapproval/search?q='+encodeURIComponent(attempt.id));
  const matches=(response.results||[]).filter(s=>s.external_reference===attempt.id);
  if(matches.length!==1 || Number(response.paging?.total)>matches.length) return null;
  const subscription=await provider('/preapproval/'+encodeURIComponent(matches[0].id));
  return bindRecoveredCheckout(d,attempt,subscription);
}
