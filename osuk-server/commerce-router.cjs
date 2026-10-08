'use strict';
const legacy=require('./commerce-service.cjs');
const keyOnly=require('./key-only-commerce.cjs');
function legacyConfigured(env=process.env){return !!(env.DATABASE_URL&&env.GOATPAY_WEBHOOK_SECRET&&env.ORDER_TOKEN_SECRET?.length>=32);}
function createService(options={}){
  const env=options.env||process.env;
  const traditional=()=>legacy.createService(options),simple=()=>keyOnly.createService(options);
  return{
    prepare:(...args)=>legacyConfigured(env)?Promise.resolve({legacy:true}):simple().prepare(...args),
    createOrder:(body,key,ip,token)=>keyOnly.isKeyOnlyToken(token)||!legacyConfigured(env)?simple().createOrder(body,key,ip,token):traditional().createOrder(body,key,ip),
    current:token=>keyOnly.isKeyOnlyToken(token)?simple().current(token):traditional().current(token)
  };
}
module.exports={createService,legacyConfigured};
