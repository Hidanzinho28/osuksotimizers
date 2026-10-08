const {createService}=require('../osuk-server/commerce-router.cjs');
const {reply,wrap,sameOrigin,jsonBody}=require('../osuk-server/http.cjs');
module.exports=wrap('POST',async(req,res)=>{sameOrigin(req);const body=await jsonBody(req);const ip=String(req.headers['x-forwarded-for']||'unknown').split(',')[0].trim();const header=req.headers.authorization||'';reply(res,200,await createService().createOrder(body,req.headers['idempotency-key'],ip,header.startsWith('Bearer ')?header.slice(7):undefined));});
