'use strict';
const legacy=require('./commerce-service.cjs');
const keyOnly=require('./key-only-commerce.cjs');
const promisse=require('./promissepay-commerce.cjs');
function legacyConfigured(env=process.env){return !!(env.DATABASE_URL&&env.GOATPAY_WEBHOOK_SECRET&&env.ORDER_TOKEN_SECRET?.length>=32);}
function createService(options={}){
  const env=options.env||process.env;
  const traditional=()=>legacy.createService(options),simple=()=>keyOnly.createService(options),next=()=>promisse.createService(options);
  return{
    prepare:(...args)=>next().prepare(...args),
    createOrder:(body,key,ip,token)=>keyOnly.isKeyOnlyToken(token)?simple().createOrder(body,key,ip,token):next().createOrder(body,key,ip,token),
    current:token=>promisse.isPromisseToken(token)?next().current(token):keyOnly.isKeyOnlyToken(token)?simple().current(token):traditional().current(token)
  };
}
module.exports={createService,legacyConfigured};
