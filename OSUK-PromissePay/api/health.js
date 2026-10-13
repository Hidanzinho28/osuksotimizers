const {reply,wrap}=require('../osuk-server/http.cjs');
module.exports=wrap('GET',async(req,res)=>{const missing=process.env.PROMISSEPAY_API_KEY?.trim()?[]:['PROMISSEPAY_API_KEY'];reply(res,missing.length?503:200,{status:missing.length?'configuration_required':'configuration_present',missing,provider:'PromissePay',mode:'api_confirmation',paymentVerified:false});});
