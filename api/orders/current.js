const {createService}=require('../../osuk-server/commerce-router.cjs');
const {reply,wrap}=require('../../osuk-server/http.cjs');
module.exports=wrap('GET',async(req,res)=>{const header=req.headers.authorization||'';const token=header.startsWith('Bearer ')?header.slice(7):'';reply(res,200,await createService().current(token));});
