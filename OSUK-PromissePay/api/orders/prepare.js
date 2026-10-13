const {createService}=require('../../osuk-server/commerce-router.cjs');
const {reply,wrap,sameOrigin,jsonBody}=require('../../osuk-server/http.cjs');
module.exports=wrap('POST',async(req,res)=>{sameOrigin(req);const ip=String(req.headers['x-forwarded-for']||'unknown').split(',')[0].trim();reply(res,200,await createService().prepare(await jsonBody(req),req.headers['idempotency-key'],ip));});
