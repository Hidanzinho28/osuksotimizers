import service from '../../osuk-server/commerce-service.cjs';
import rules from '../../osuk-server/payment-rules.cjs';

// Web Standard handler: os bytes recebidos são preservados para a assinatura.
export default {
  async fetch(request) {
    const headers={'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'};
    try {
      if(request.method!=='POST') {headers.Allow='POST';throw new rules.PaymentError(405,'Método não permitido.');}
      const chunks=[];let size=0;
      if(request.body) {
        const reader=request.body.getReader();
        try {while(true) {const {done,value}=await reader.read();if(done) break;size+=value.byteLength;if(size>65536) {await reader.cancel();throw new rules.PaymentError(413,'Requisição muito grande.');}chunks.push(Buffer.from(value));}}
        finally {reader.releaseLock();}
      }
      const value=await service.createService().webhook(Buffer.concat(chunks),request.headers.get('x-goatpay-signature'));
      return new Response(JSON.stringify(value),{status:200,headers});
    } catch(error) {
      const known=error instanceof rules.PaymentError;
      if(!known) console.error('OSUK: falha ao processar a confirmação de pagamento.');
      return new Response(JSON.stringify({error:known?error.message:'Não foi possível processar a confirmação agora.'}),{status:known?error.status:503,headers});
    }
  }
};
