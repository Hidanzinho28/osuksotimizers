const {reply,wrap}=require('../osuk-server/http.cjs');
const {legacyConfigured}=require('../osuk-server/commerce-router.cjs');
module.exports=wrap('GET',async(req,res)=>{const missing=process.env.GOATPAY_API_KEY?.trim()?[]:['GOATPAY_API_KEY'];reply(res,missing.length?503:200,{status:missing.length?'configuration_required':'configuration_present',missing,mode:legacyConfigured()?'database_webhook':'api_confirmation',paymentVerified:false});});
